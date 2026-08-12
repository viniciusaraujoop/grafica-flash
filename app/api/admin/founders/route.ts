import {
  createHash,
  randomBytes,
} from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  auditPlatformAction,
  canPlatform,
  requireOfficialPlatformOwner,
  requirePlatformAdmin,
} from '@/lib/platform-admin'
import {
  normalizeFounderPlan,
} from '@/lib/founder-program'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function newInviteToken() {
  return randomBytes(32).toString('hex')
}

function tokenHash(token: string) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

function expiresAt() {
  return new Date(Date.now() + INVITE_TTL_MS).toISOString()
}

function activationPath(token: string) {
  return `/fundadores/ativar?token=${encodeURIComponent(token)}`
}

function databaseMessage(message: string) {
  const cases: Array<[string, string]> = [
    ['FOUNDER_NUMBER_TAKEN', 'Esse número Founder acabou de ser reservado por outro convite.'],
    ['FOUNDER_SLOTS_EXHAUSTED', 'As 10 vagas reais de Cliente Fundador já estão ocupadas.'],
    ['FOUNDER_INVITE_ALREADY_EXISTS', 'Esse prospect/e-mail já possui um convite Founder ativo.'],
    ['FOUNDER_LEAD_NOT_OWNED', 'Esse prospect não pertence mais à sua carteira.'],
    ['FOUNDER_LEAD_NOT_ELIGIBLE', 'Esse prospect não pode receber um convite Founder nesse estado.'],
    ['FOUNDER_TEST_OWNER_ONLY', 'O Founder #00 é exclusivo do Owner oficial.'],
    ['FOUNDER_TEST_SLOT_TAKEN', 'Já existe um convite Founder #00 ativo.'],
    ['FOUNDER_INVITE_NOT_OWNED', 'Esse convite não pertence mais à sua carteira.'],
    ['FOUNDER_INVITE_NOT_PENDING', 'Somente convites pendentes podem ser alterados.'],
    ['FOUNDER_INVITE_NOT_FOUND', 'Convite Founder não encontrado.'],
    ['INVALID_FOUNDER_PLAN', 'Plano Founder inválido.'],
    ['INVALID_FOUNDER_NUMBER', 'Número Founder inválido.'],
  ]

  for (const [code, friendly] of cases) {
    if (message.includes(code)) return friendly
  }

  if (message.includes('duplicate key')) {
    return 'Outro convite ocupou esse e-mail, prospect ou número no mesmo instante. Atualize e tente novamente.'
  }

  return message
}

function normalizeRequestedNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    return undefined
  }

  return parsed
}

async function loadWorkspace(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'founders.view_own',
  )

  if (!session.ok) return session

  const canViewAll = canPlatform(
    session.admin,
    'founders.view_all',
  )

  const expireResult = await session.supabaseAdmin.rpc(
    'expire_pending_founder_invites',
  )

  if (expireResult.error) {
    throw expireResult.error
  }

  let inviteQuery = session.supabaseAdmin
    .from('founder_invites')
    .select(
      'id,email,founder_number,plan_key,founder_price_cents,status,token_expires_at,invited_at,activated_at,revoked_at,token_rotated_at,sales_lead_id,created_by_admin_id,created_by_email,revocation_reason,created_at,updated_at',
    )
    .order('founder_number', { ascending: true })
    .order('invited_at', { ascending: false })

  if (!canViewAll) {
    inviteQuery = inviteQuery.eq(
      'created_by_admin_id',
      session.admin.id,
    )
  }

  const { data: invites, error: inviteError } =
    await inviteQuery.limit(100)

  if (inviteError) throw inviteError

  const { data: allLive, error: liveError } =
    await session.supabaseAdmin
      .from('founder_invites')
      .select('founder_number,sales_lead_id')
      .in('status', ['pending', 'activated'])

  if (liveError) throw liveError

  let prospectQuery = session.supabaseAdmin
    .from('signup_leads')
    .select(
      'id,email,empresa_nome,nome_responsavel,whatsapp,segmento,cidade,estado,sales_stage,assigned_to_admin_id,plano,updated_at',
    )
    .is('converted_company_id', null)
    .in('sales_stage', [
      'novo',
      'contatado',
      'interessado',
      'demonstracao',
      'convite_fundador',
    ])
    .order('updated_at', { ascending: false })
    .limit(300)

  if (!canViewAll) {
    prospectQuery = prospectQuery.eq(
      'assigned_to_admin_id',
      session.admin.id,
    )
  }

  const { data: prospectRows, error: prospectError } =
    await prospectQuery

  if (prospectError) throw prospectError

  const liveLeadIds = new Set(
    (allLive || [])
      .map((item) => item.sales_lead_id)
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0,
      ),
  )

  const prospects = (prospectRows || []).filter(
    (item) => !liveLeadIds.has(item.id),
  )

  const creatorIds = Array.from(
    new Set(
      (invites || [])
        .map((item) => item.created_by_admin_id)
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ),
    ),
  )

  const creatorById: Record<
    string,
    { id: string; nome: string; email: string; role: string }
  > = {}

  if (creatorIds.length > 0) {
    const { data: creators, error: creatorError } =
      await session.supabaseAdmin
        .from('platform_admins')
        .select('id,nome,email,role')
        .in('id', creatorIds)

    if (creatorError) throw creatorError

    for (const creator of creators || []) {
      creatorById[creator.id] = creator
    }
  }

  const leadIds = Array.from(
    new Set(
      (invites || [])
        .map((item) => item.sales_lead_id)
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ),
    ),
  )

  const leadById: Record<
    string,
    { id: string; empresa_nome: string; nome_responsavel: string | null }
  > = {}

  if (leadIds.length > 0) {
    const { data: linkedLeads, error: leadError } =
      await session.supabaseAdmin
        .from('signup_leads')
        .select('id,empresa_nome,nome_responsavel')
        .in('id', leadIds)

    if (leadError) throw leadError

    for (const lead of linkedLeads || []) {
      leadById[lead.id] = lead
    }
  }

  const usedRealNumbers = new Set(
    (allLive || [])
      .map((item) => item.founder_number)
      .filter(
        (value): value is number =>
          typeof value === 'number' &&
          value >= 1 &&
          value <= 10,
      ),
  )

  return {
    ok: true as const,
    session,
    canViewAll,
    invites: (invites || []).map((invite) => ({
      ...invite,
      creator: invite.created_by_admin_id
        ? creatorById[invite.created_by_admin_id] || null
        : null,
      prospect: invite.sales_lead_id
        ? leadById[invite.sales_lead_id] || null
        : null,
    })),
    prospects,
    availableNumbers: Array.from(
      { length: 10 },
      (_, index) => index + 1,
    ).filter((number) => !usedRealNumbers.has(number)),
    testSlotAvailable: !(allLive || []).some(
      (item) => item.founder_number === 0,
    ),
  }
}

export async function GET(request: NextRequest) {
  try {
    const workspace = await loadWorkspace(request)

    if (!workspace.ok) {
      return NextResponse.json(
        { error: workspace.error },
        { status: workspace.status },
      )
    }

    return NextResponse.json({
      viewer: {
        id: workspace.session.admin.id,
        email: workspace.session.admin.email,
        role: workspace.session.admin.role,
        canViewAll: workspace.canViewAll,
        canCreate: canPlatform(
          workspace.session.admin,
          'founders.create_invite',
        ),
        canRotate: canPlatform(
          workspace.session.admin,
          'founders.resend_invite',
        ),
        canRevoke: canPlatform(
          workspace.session.admin,
          'founders.revoke_pending',
        ),
      },
      invites: workspace.invites,
      prospects: workspace.prospects,
      availableNumbers: workspace.availableNumbers,
      testSlotAvailable: workspace.testSlotAvailable,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? databaseMessage(error.message)
            : 'Não foi possível carregar o Programa Founder.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'founders.view_own',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const body = await request.json().catch(() => ({}))
  const action = text(body.action, 40)

  try {
    if (action === 'create') {
      if (
        !canPlatform(
          session.admin,
          'founders.create_invite',
        )
      ) {
        return NextResponse.json(
          { error: 'Seu perfil não pode criar convites Founder.' },
          { status: 403 },
        )
      }

      const leadId = text(body.lead_id, 80)
      const plan = normalizeFounderPlan(body.plan)
      const requestedNumber =
        normalizeRequestedNumber(body.founder_number)

      if (!leadId) {
        return NextResponse.json(
          { error: 'Selecione um prospect.' },
          { status: 400 },
        )
      }

      if (!plan) {
        return NextResponse.json(
          { error: 'Selecione um plano Founder válido.' },
          { status: 400 },
        )
      }

      if (requestedNumber === undefined) {
        return NextResponse.json(
          { error: 'Número Founder inválido.' },
          { status: 400 },
        )
      }

      const token = newInviteToken()
      const { data, error } =
        await session.supabaseAdmin.rpc(
          'create_founder_invite_for_sales_lead',
          {
            p_actor_admin_id: session.admin.id,
            p_lead_id: leadId,
            p_plan_key: plan,
            p_token_hash: tokenHash(token),
            p_token_expires_at: expiresAt(),
            p_requested_founder_number: requestedNumber,
          },
        )

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'founder_invite_created',
        {
          targetType: 'founder_invite',
          targetId: data?.id,
          targetLabel: data?.email,
          payload: {
            founder_number: data?.founder_number,
            plan_key: data?.plan_key,
            sales_lead_id: leadId,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        invite: data,
        activationPath: activationPath(token),
        message:
          'Convite Founder reservado. O token em claro só é mostrado nesta resposta.',
      })
    }

    if (action === 'create_test') {
      const owner = await requireOfficialPlatformOwner(request)

      if (!owner.ok) {
        return NextResponse.json(
          { error: owner.error },
          { status: owner.status },
        )
      }

      const targetEmail = text(body.email, 320).toLowerCase()
      const plan = normalizeFounderPlan(body.plan)

      if (
        !targetEmail ||
        !targetEmail.includes('@')
      ) {
        return NextResponse.json(
          { error: 'Informe um e-mail de teste válido.' },
          { status: 400 },
        )
      }

      if (!plan) {
        return NextResponse.json(
          { error: 'Selecione um plano Founder válido.' },
          { status: 400 },
        )
      }

      const token = newInviteToken()
      const { data, error } =
        await owner.supabaseAdmin.rpc(
          'create_founder_test_invite',
          {
            p_actor_admin_id: owner.admin.id,
            p_email: targetEmail,
            p_plan_key: plan,
            p_token_hash: tokenHash(token),
            p_token_expires_at: expiresAt(),
          },
        )

      if (error) throw error

      await auditPlatformAction(
        owner.admin.email,
        'founder_test_invite_created',
        {
          targetType: 'founder_invite',
          targetId: data?.id,
          targetLabel: targetEmail,
          payload: {
            founder_number: 0,
            plan_key: data?.plan_key,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        invite: data,
        activationPath: activationPath(token),
        message: 'Convite técnico Founder #00 criado.',
      })
    }

    if (action === 'rotate') {
      if (
        !canPlatform(
          session.admin,
          'founders.resend_invite',
        )
      ) {
        return NextResponse.json(
          { error: 'Seu perfil não pode renovar convites Founder.' },
          { status: 403 },
        )
      }

      const inviteId = text(body.id, 80)
      const token = newInviteToken()

      const { data, error } =
        await session.supabaseAdmin.rpc(
          'rotate_founder_invite_token',
          {
            p_actor_admin_id: session.admin.id,
            p_invite_id: inviteId,
            p_token_hash: tokenHash(token),
            p_token_expires_at: expiresAt(),
          },
        )

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'founder_invite_rotated',
        {
          targetType: 'founder_invite',
          targetId: data?.id || inviteId,
          targetLabel: data?.email,
        },
      )

      return NextResponse.json({
        ok: true,
        invite: data,
        activationPath: activationPath(token),
        message:
          'Novo link gerado. O link anterior deixou de ser válido.',
      })
    }

    if (action === 'revoke') {
      if (
        !canPlatform(
          session.admin,
          'founders.revoke_pending',
        )
      ) {
        return NextResponse.json(
          { error: 'Seu perfil não pode revogar convites Founder.' },
          { status: 403 },
        )
      }

      const inviteId = text(body.id, 80)
      const reason = text(body.reason, 500)

      const { data, error } =
        await session.supabaseAdmin.rpc(
          'revoke_founder_invite',
          {
            p_actor_admin_id: session.admin.id,
            p_invite_id: inviteId,
            p_reason: reason || null,
          },
        )

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'founder_invite_revoked',
        {
          targetType: 'founder_invite',
          targetId: data?.id || inviteId,
          targetLabel: data?.email,
          payload: { reason: reason || null },
        },
      )

      return NextResponse.json({
        ok: true,
        invite: data,
        message: 'Convite Founder revogado.',
      })
    }

    return NextResponse.json(
      { error: 'Ação inválida.' },
      { status: 400 },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? databaseMessage(error.message)
        : 'Não foi possível concluir a operação.'

    const conflict =
      message.includes('já') ||
      message.includes('ocupad') ||
      message.includes('reservad')

    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 500 },
    )
  }
}
