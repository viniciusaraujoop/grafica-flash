import { NextRequest, NextResponse } from 'next/server'
import {
  auditPlatformAction,
  requireOfficialPlatformOwner,
  sanitizeProspectorPermissions,
} from '@/lib/platform-admin'
import {
  PLATFORM_ADMIN_INVITE_TTL_DAYS,
  buildPlatformAdminActivationUrl,
  createPlatformAdminInviteToken,
  findAuthUserByEmail,
  hashPlatformAdminInviteToken,
  normalizeTeamInviteEmail,
  platformAdminInviteExpiresAt,
  validTeamInviteEmail,
} from '@/lib/platform-admin-invites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return String(value || '').trim()
}

function responseError(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function GET(request: NextRequest) {
  const session =
    await requireOfficialPlatformOwner(request)

  if (!session.ok) {
    return responseError(session.error, session.status)
  }

  const now = new Date().toISOString()
  const staleClaimBefore = new Date(
    Date.now() - 10 * 60 * 1000,
  ).toISOString()

  await session.supabaseAdmin
    .from('platform_admin_invites')
    .update({
      status: 'pending',
      claimed_at: null,
      activation_claim_id: null,
    })
    .eq('status', 'activating')
    .lt('claimed_at', staleClaimBefore)
    .gt('expires_at', now)

  await session.supabaseAdmin
    .from('platform_admin_invites')
    .update({
      status: 'expired',
      claimed_at: null,
      activation_claim_id: null,
    })
    .eq('status', 'activating')
    .lt('claimed_at', staleClaimBefore)
    .lte('expires_at', now)

  await session.supabaseAdmin
    .from('platform_admin_invites')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lte('expires_at', now)

  const { data, error } = await session.supabaseAdmin
    .from('platform_admin_invites')
    .select(
      'id,email,email_normalized,nome,role,area,permissions,observacoes,status,expires_at,invited_at,activated_at,revoked_at,user_id,platform_admin_id,created_by_email,last_token_rotated_at,created_at,updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(250)

  if (error) {
    return responseError(error.message, 500)
  }

  return NextResponse.json({
    invites: data || [],
    ttlDays: PLATFORM_ADMIN_INVITE_TTL_DAYS,
  })
}

export async function POST(request: NextRequest) {
  const session =
    await requireOfficialPlatformOwner(request)

  if (!session.ok) {
    return responseError(session.error, session.status)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const action = text(body.action)

    if (action === 'create') {
      const targetEmail =
        normalizeTeamInviteEmail(body.email)
      const nome = text(body.nome)
      const observacoes =
        text(body.observacoes).slice(0, 500) || null

      if (!validTeamInviteEmail(targetEmail)) {
        return responseError('Informe um e-mail válido.')
      }

      if (nome.length < 2 || nome.length > 160) {
        return responseError(
          'Informe o nome do Prospector.',
        )
      }

      const { data: existingAdmin, error: adminError } =
        await session.supabaseAdmin
          .from('platform_admins')
          .select('id,email,role,is_active')
          .ilike('email', targetEmail)
          .limit(1)
          .maybeSingle()

      if (adminError) throw adminError

      if (existingAdmin?.id) {
        return responseError(
          'Esse e-mail já pertence a um usuário interno do Orçaly.',
          409,
        )
      }

      const existingAuth = await findAuthUserByEmail(
        session.supabaseAdmin,
        targetEmail,
      )

      if (existingAuth?.id) {
        return responseError(
          'Esse e-mail já possui uma conta no Orçaly. Use um e-mail exclusivo para o acesso interno.',
          409,
        )
      }

      const { data: liveInvite, error: inviteError } =
        await session.supabaseAdmin
          .from('platform_admin_invites')
          .select('id,status')
          .eq('email_normalized', targetEmail)
          .in('status', ['pending', 'activating'])
          .limit(1)
          .maybeSingle()

      if (inviteError) throw inviteError

      if (liveInvite?.id) {
        return responseError(
          'Já existe um convite ativo para esse e-mail. Gere um novo link no convite existente.',
          409,
        )
      }

      const token = createPlatformAdminInviteToken()
      const tokenHash =
        hashPlatformAdminInviteToken(token)

      if (!tokenHash) {
        throw new Error(
          'Não foi possível gerar o token do convite.',
        )
      }

      const permissions =
        sanitizeProspectorPermissions({})

      const { data: invite, error } =
        await session.supabaseAdmin
          .from('platform_admin_invites')
          .insert({
            email: targetEmail,
            nome,
            role: 'prospector',
            area: 'Comercial',
            permissions,
            observacoes,
            token_hash: tokenHash,
            status: 'pending',
            expires_at: platformAdminInviteExpiresAt(),
            created_by_admin_id: session.admin.id,
            created_by_email: session.admin.email,
          })
          .select(
            'id,email,nome,role,area,status,expires_at,invited_at,created_at',
          )
          .single()

      if (error) throw error

      const activationUrl =
        buildPlatformAdminActivationUrl(request, token)

      await auditPlatformAction(
        session.admin.email,
        'prospector_invite_created',
        {
          targetType: 'platform_admin_invite',
          targetId: invite.id,
          targetLabel: targetEmail,
          payload: {
            role: 'prospector',
            expires_at: invite.expires_at,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        invite,
        activationUrl,
        message:
          'Convite criado. O link é exibido somente agora; o token em claro não é armazenado.',
      })
    }

    const id = text(body.id)

    if (!id) {
      return responseError('Convite não informado.')
    }

    const { data: invite, error: loadError } =
      await session.supabaseAdmin
        .from('platform_admin_invites')
        .select(
          'id,email,email_normalized,nome,status,expires_at,platform_admin_id',
        )
        .eq('id', id)
        .maybeSingle()

    if (loadError) throw loadError

    if (!invite?.id) {
      return responseError(
        'Convite não encontrado.',
        404,
      )
    }

    if (action === 'resend') {
      if (
        invite.status === 'activated' ||
        invite.status === 'activating' ||
        invite.status === 'revoked'
      ) {
        return responseError(
          'Esse convite não pode gerar um novo link nesse estado.',
          409,
        )
      }

      const token = createPlatformAdminInviteToken()
      const tokenHash =
        hashPlatformAdminInviteToken(token)

      if (!tokenHash) {
        throw new Error(
          'Não foi possível gerar o novo token.',
        )
      }

      const now = new Date().toISOString()

      const { data: updated, error } =
        await session.supabaseAdmin
          .from('platform_admin_invites')
          .update({
            token_hash: tokenHash,
            status: 'pending',
            expires_at: platformAdminInviteExpiresAt(),
            invited_at: now,
            claimed_at: null,
            activation_claim_id: null,
            activated_at: null,
            revoked_at: null,
            user_id: null,
            platform_admin_id: null,
            last_token_rotated_at: now,
          })
          .eq('id', invite.id)
          .in('status', ['pending', 'expired'])
          .select(
            'id,email,nome,status,expires_at,invited_at,last_token_rotated_at',
          )
          .single()

      if (error) throw error

      const activationUrl =
        buildPlatformAdminActivationUrl(request, token)

      await auditPlatformAction(
        session.admin.email,
        'prospector_invite_rotated',
        {
          targetType: 'platform_admin_invite',
          targetId: invite.id,
          targetLabel: invite.email,
        },
      )

      return NextResponse.json({
        ok: true,
        invite: updated,
        activationUrl,
        message:
          'Novo link gerado. O link anterior deixou de funcionar.',
      })
    }

    if (action === 'revoke') {
      if (
        invite.status === 'activated' ||
        invite.status === 'activating' ||
        invite.status === 'revoked'
      ) {
        return responseError(
          'Esse convite não pode ser revogado nesse estado.',
          409,
        )
      }

      const now = new Date().toISOString()

      const { error } = await session.supabaseAdmin
        .from('platform_admin_invites')
        .update({
          status: 'revoked',
          revoked_at: now,
          claimed_at: null,
          activation_claim_id: null,
        })
        .eq('id', invite.id)
        .in('status', ['pending', 'expired'])

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'prospector_invite_revoked',
        {
          targetType: 'platform_admin_invite',
          targetId: invite.id,
          targetLabel: invite.email,
        },
      )

      return NextResponse.json({
        ok: true,
        message: 'Convite revogado.',
      })
    }

    return responseError('Ação inválida.')
  } catch (error) {
    return responseError(
      error instanceof Error
        ? error.message
        : 'Não foi possível concluir a operação.',
      500,
    )
  }
}
