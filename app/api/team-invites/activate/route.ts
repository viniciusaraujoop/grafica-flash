import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auditPlatformAction } from '@/lib/platform-admin'
import { getSupabaseAdmin } from '@/lib/company-access'
import {
  findAuthUserByEmail,
  hashPlatformAdminInviteToken,
  maskTeamInviteEmail,
  normalizeTeamInviteEmail,
  validTeamInviteEmail,
  validTeamInvitePassword,
} from '@/lib/platform-admin-invites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

async function releaseClaim(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  claimId: string,
) {
  await supabaseAdmin.rpc(
    'release_platform_admin_invite_claim',
    { p_claim_id: claimId },
  )
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const tokenHash =
    hashPlatformAdminInviteToken(token)

  if (!tokenHash) {
    return errorResponse(
      'Convite inválido ou incompleto.',
      400,
    )
  }

  const supabaseAdmin = getSupabaseAdmin()
  const now = new Date().toISOString()

  await supabaseAdmin
    .from('platform_admin_invites')
    .update({ status: 'expired' })
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .lte('expires_at', now)

  const { data: invite, error } = await supabaseAdmin
    .from('platform_admin_invites')
    .select(
      'id,nome,email_normalized,role,status,expires_at',
    )
    .eq('token_hash', tokenHash)
    .limit(1)
    .maybeSingle()

  if (error) {
    return errorResponse(
      'Não foi possível validar o convite.',
      500,
    )
  }

  if (
    !invite?.id ||
    invite.status !== 'pending'
  ) {
    return errorResponse(
      'Este convite expirou, foi usado ou foi revogado.',
      410,
    )
  }

  return NextResponse.json({
    invite: {
      nome: invite.nome,
      emailMasked: maskTeamInviteEmail(
        invite.email_normalized,
      ),
      role: 'Prospector',
      expiresAt: invite.expires_at,
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tokenHash =
    hashPlatformAdminInviteToken(body.token)
  const targetEmail =
    normalizeTeamInviteEmail(body.email)
  const password = String(body.password || '')

  if (!tokenHash) {
    return errorResponse('Convite inválido.', 400)
  }

  if (!validTeamInviteEmail(targetEmail)) {
    return errorResponse(
      'Confirme o e-mail que recebeu o convite.',
    )
  }

  if (!validTeamInvitePassword(password)) {
    return errorResponse(
      'A senha precisa ter de 10 a 128 caracteres, com pelo menos uma letra e um número.',
    )
  }

  const supabaseAdmin = getSupabaseAdmin()
  const claimId = randomUUID()

  const { data: claimRows, error: claimError } =
    await supabaseAdmin.rpc(
      'claim_platform_admin_invite',
      {
        p_token_hash: tokenHash,
        p_claim_id: claimId,
      },
    )

  if (claimError) {
    return errorResponse(
      'Não foi possível reivindicar o convite.',
      500,
    )
  }

  const invite = Array.isArray(claimRows)
    ? claimRows[0]
    : claimRows

  if (!invite?.id) {
    return errorResponse(
      'Este convite expirou, foi usado ou está em processamento.',
      410,
    )
  }

  if (
    normalizeTeamInviteEmail(
      invite.email_normalized || invite.email,
    ) !== targetEmail
  ) {
    await releaseClaim(supabaseAdmin, claimId)
    return errorResponse(
      'O e-mail informado não corresponde ao convite.',
      400,
    )
  }

  let createdUserId = ''

  try {
    const existingAuth = await findAuthUserByEmail(
      supabaseAdmin,
      targetEmail,
    )

    if (existingAuth?.id) {
      await releaseClaim(supabaseAdmin, claimId)
      return errorResponse(
        'Este e-mail já possui uma conta no Orçaly. Solicite um novo convite com um e-mail exclusivo.',
        409,
      )
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password,
        email_confirm: true,
        app_metadata: {
          orcaly_role: 'prospector',
        },
        user_metadata: {
          nome: String(invite.nome || '').trim(),
          portal: 'admin',
        },
      })

    if (authError || !authData.user?.id) {
      throw (
        authError ||
        new Error(
          'Não foi possível criar a conta de acesso.',
        )
      )
    }

    createdUserId = authData.user.id

    const { data: adminRows, error: completeError } =
      await supabaseAdmin.rpc(
        'complete_platform_admin_invite',
        {
          p_claim_id: claimId,
          p_user_id: createdUserId,
        },
      )

    const admin = Array.isArray(adminRows)
      ? adminRows[0]
      : adminRows

    if (completeError || !admin?.id) {
      throw (
        completeError ||
        new Error(
          'Não foi possível concluir o vínculo interno.',
        )
      )
    }

    await auditPlatformAction(
      'system:team_invite',
      'prospector_invite_activated',
      {
        targetType: 'platform_admin',
        targetId: admin.id,
        targetLabel: targetEmail,
        payload: {
          invite_id: invite.id,
          created_by: invite.created_by_email,
        },
      },
    )

    return NextResponse.json({
      ok: true,
      redirectTo: '/admin/login?activated=prospector',
    })
  } catch (error) {
    if (createdUserId) {
      const deletion =
        await supabaseAdmin.auth.admin.deleteUser(
          createdUserId,
        )

      if (deletion.error) {
        await supabaseAdmin.auth.admin
          .updateUserById(createdUserId, {
            ban_duration: '876000h',
            app_metadata: {
              orcaly_role:
                'orphaned_platform_invite',
            },
          })
          .catch(() => undefined)
      }
    }

    await releaseClaim(supabaseAdmin, claimId)

    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Não foi possível ativar o convite.',
      500,
    )
  }
}
