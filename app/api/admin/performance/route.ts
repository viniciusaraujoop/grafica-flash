import {
  NextRequest,
  NextResponse,
} from 'next/server'
import {
  canPlatform,
  requirePlatformAdmin,
} from '@/lib/platform-admin'
import {
  PERFORMANCE_STAGES,
  parsePerformancePeriod,
  performancePeriodStart,
  safeRate,
  type PerformanceStage,
} from '@/lib/sales-performance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LeadRow = {
  id: string
  sales_stage: string | null
  assigned_to_admin_id: string | null
  created_by_admin_id: string | null
  sales_next_action_at: string | null
  sales_last_contact_at: string | null
  created_at: string | null
  sales_stage_updated_at: string | null
}

type FollowupRow = {
  id: string
  lead_id: string
  created_by_admin_id: string | null
  sales_event_type: string | null
  channel: string | null
  raw_data: unknown
  created_at: string | null
}

type InviteRow = {
  id: string
  founder_number: number
  status: string
  created_by_admin_id: string | null
  invited_at: string | null
  activated_at: string | null
  sales_lead_id: string | null
}

type TeamMember = {
  id: string
  nome: string | null
  email: string
  role: string
}

type PageResult<T> = {
  data?: T[] | null
  error?: { message?: string } | null
}

const CLOSED_STAGES = new Set([
  'cliente',
  'perdido',
])

function record(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {} as Record<string, unknown>
  }

  return value as Record<string, unknown>
}

function validDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function inPeriod(
  value: string | null | undefined,
  start: Date | null,
) {
  const parsed = validDate(value)
  if (!parsed) return false
  return start ? parsed >= start : true
}

async function fetchPaged<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<unknown>,
  maxRows = 20000,
) {
  const pageSize = 1000
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const result = (await loadPage(
      from,
      from + pageSize - 1,
    )) as PageResult<T>

    if (result.error) {
      throw new Error(
        result.error.message ||
          'Falha ao carregar métricas comerciais.',
      )
    }

    const page = result.data || []
    rows.push(...page)

    if (page.length < pageSize) {
      return rows
    }
  }

  throw new Error(
    'O volume de dados comerciais excedeu o limite seguro do dashboard.',
  )
}

function stageFromFollowup(item: FollowupRow) {
  const payload = record(item.raw_data)
  return String(payload.to_stage || '').trim()
}

function systemEvent(item: FollowupRow) {
  const payload = record(item.raw_data)
  return String(payload.event || '').trim()
}

function buildPipeline(leads: LeadRow[]) {
  const result = Object.fromEntries(
    PERFORMANCE_STAGES.map((stage) => [stage, 0]),
  ) as Record<PerformanceStage, number>

  for (const lead of leads) {
    const stage = String(
      lead.sales_stage || 'novo',
    ) as PerformanceStage

    if (stage in result) {
      result[stage] += 1
    }
  }

  return result
}

function activeLeads(leads: LeadRow[]) {
  return leads.filter(
    (lead) =>
      !CLOSED_STAGES.has(
        String(lead.sales_stage || 'novo'),
      ),
  )
}

function buildActivity(args: {
  leads: LeadRow[]
  followups: FollowupRow[]
  invites: InviteRow[]
  periodStart: Date | null
}) {
  const { leads, followups, invites, periodStart } = args

  const prospectsCreated = leads.filter(
    (lead) =>
      Boolean(lead.created_by_admin_id) &&
      inPeriod(lead.created_at, periodStart),
  ).length

  const contacts = followups.filter(
    (item) => item.sales_event_type === 'contact',
  ).length

  const interested = followups.filter(
    (item) =>
      item.sales_event_type === 'stage_change' &&
      stageFromFollowup(item) === 'interessado',
  ).length

  const demonstrations = followups.filter(
    (item) =>
      item.sales_event_type === 'stage_change' &&
      stageFromFollowup(item) === 'demonstracao',
  ).length

  const lost = followups.filter(
    (item) =>
      item.sales_event_type === 'stage_change' &&
      stageFromFollowup(item) === 'perdido',
  ).length

  const realInvites = invites.filter(
    (invite) =>
      invite.founder_number >= 1 &&
      invite.founder_number <= 10,
  )

  const invitesCreated = realInvites.filter(
    (invite) =>
      inPeriod(invite.invited_at, periodStart),
  )

  const activations = realInvites.filter(
    (invite) =>
      inPeriod(invite.activated_at, periodStart),
  ).length

  const customers = followups.filter(
    (item) =>
      item.sales_event_type === 'system' &&
      systemEvent(item) === 'first_payment_approved',
  ).length

  const activatedCohort = invitesCreated.filter(
    (invite) => invite.status === 'activated',
  ).length

  return {
    prospects_created: prospectsCreated,
    contacts,
    interested,
    demonstrations,
    founder_invites: invitesCreated.length,
    founder_activations: activations,
    customers,
    lost,
    invite_activation_rate: safeRate(
      activatedCohort,
      invitesCreated.length,
    ),
  }
}

function buildHealth(leads: LeadRow[], now: Date) {
  const active = activeLeads(leads)
  const nextSevenDays = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  )

  const overdue = active.filter((lead) => {
    const date = validDate(lead.sales_next_action_at)
    return Boolean(date && date < now)
  }).length

  const upcoming = active.filter((lead) => {
    const date = validDate(lead.sales_next_action_at)
    return Boolean(
      date && date >= now && date <= nextSevenDays,
    )
  }).length

  const neverContacted = active.filter(
    (lead) => !validDate(lead.sales_last_contact_at),
  ).length

  const customers = leads.filter(
    (lead) => lead.sales_stage === 'cliente',
  ).length
  const lost = leads.filter(
    (lead) => lead.sales_stage === 'perdido',
  ).length

  return {
    portfolio: leads.length,
    active_portfolio: active.length,
    overdue_actions: overdue,
    upcoming_actions_7d: upcoming,
    never_contacted: neverContacted,
    closing_rate: safeRate(
      customers,
      customers + lost,
    ),
  }
}

function teamRow(args: {
  member: TeamMember
  leads: LeadRow[]
  followups: FollowupRow[]
  invites: InviteRow[]
  periodStart: Date | null
  now: Date
}) {
  const { member, leads, followups, invites, periodStart, now } = args

  const memberLeads = leads.filter(
    (lead) =>
      lead.assigned_to_admin_id === member.id,
  )
  const memberFollowups = followups.filter(
    (item) =>
      item.created_by_admin_id === member.id,
  )
  const memberInvites = invites.filter(
    (invite) =>
      invite.created_by_admin_id === member.id,
  )

  return {
    id: member.id,
    nome: member.nome || member.email,
    email: member.email,
    ...buildHealth(memberLeads, now),
    ...buildActivity({
      leads: leads.filter(
        (lead) =>
          lead.created_by_admin_id === member.id,
      ),
      followups: memberFollowups,
      invites: memberInvites,
      periodStart,
    }),
  }
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'performance.view_own',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const canViewOwn = canPlatform(
    session.admin,
    'performance.view_own',
  )
  const canViewAll = canPlatform(
    session.admin,
    'performance.view_all',
  )

  if (!canViewOwn && !canViewAll) {
    return NextResponse.json(
      {
        error:
          'Seu perfil não pode consultar desempenho comercial.',
      },
      { status: 403 },
    )
  }

  const period = parsePerformancePeriod(
    request.nextUrl.searchParams.get('period'),
  )
  const now = new Date()
  const periodStart = performancePeriodStart(
    period,
    now,
  )
  const periodStartIso =
    periodStart?.toISOString() || null

  try {
    const leadsPromise = fetchPaged<LeadRow>(
      (from, to) => {
        let query = session.supabaseAdmin
          .from('signup_leads')
          .select(
            'id,sales_stage,assigned_to_admin_id,created_by_admin_id,sales_next_action_at,sales_last_contact_at,created_at,sales_stage_updated_at',
          )
          .order('created_at', { ascending: false })

        if (!canViewAll) {
          query = query.eq(
            'assigned_to_admin_id',
            session.admin.id,
          )
        }

        return query.range(from, to)
      },
    )

    const followupsPromise = fetchPaged<FollowupRow>(
      (from, to) => {
        let query = session.supabaseAdmin
          .from('signup_lead_followups')
          .select(
            'id,lead_id,created_by_admin_id,sales_event_type,channel,raw_data,created_at',
          )
          .order('created_at', { ascending: false })

        if (!canViewAll) {
          query = query.eq(
            'created_by_admin_id',
            session.admin.id,
          )
        }

        if (periodStartIso) {
          query = query.gte(
            'created_at',
            periodStartIso,
          )
        }

        return query.range(from, to)
      },
    )

    const invitesPromise = fetchPaged<InviteRow>(
      (from, to) => {
        let query = session.supabaseAdmin
          .from('founder_invites')
          .select(
            'id,founder_number,status,created_by_admin_id,invited_at,activated_at,sales_lead_id',
          )
          .order('invited_at', { ascending: false })

        if (!canViewAll) {
          query = query.eq(
            'created_by_admin_id',
            session.admin.id,
          )
        }

        return query.range(from, to)
      },
      1000,
    )

    const teamPromise = canViewAll
      ? fetchPaged<TeamMember>(
          (from, to) =>
            session.supabaseAdmin
              .from('platform_admins')
              .select('id,nome,email,role')
              .eq('is_active', true)
              .eq('role', 'prospector')
              .order('nome', { ascending: true })
              .range(from, to),
          1000,
        )
      : Promise.resolve([] as TeamMember[])

    const [leads, followups, invites, team] =
      await Promise.all([
        leadsPromise,
        followupsPromise,
        invitesPromise,
        teamPromise,
      ])

    const activity = buildActivity({
      leads,
      followups,
      invites,
      periodStart,
    })

    if (!canViewAll) {
      let createdCountQuery = session.supabaseAdmin
        .from('signup_leads')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq(
          'created_by_admin_id',
          session.admin.id,
        )

      if (periodStartIso) {
        createdCountQuery = createdCountQuery.gte(
          'created_at',
          periodStartIso,
        )
      }

      const {
        count: ownCreatedCount,
        error: ownCreatedError,
      } = await createdCountQuery

      if (ownCreatedError) throw ownCreatedError

      activity.prospects_created =
        ownCreatedCount || 0
    }

    const health = buildHealth(leads, now)
    const pipeline = buildPipeline(leads)

    const teamRows = canViewAll
      ? team
          .map((member) =>
            teamRow({
              member,
              leads,
              followups,
              invites,
              periodStart,
              now,
            }),
          )
          .sort((a, b) =>
            b.customers - a.customers ||
            b.founder_activations -
              a.founder_activations ||
            b.founder_invites - a.founder_invites ||
            b.contacts - a.contacts ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
          )
      : []

    return NextResponse.json({
      period,
      period_start: periodStartIso,
      generated_at: now.toISOString(),
      viewer: {
        id: session.admin.id,
        nome:
          session.admin.nome || session.admin.email,
        role: session.admin.role,
        can_view_all: canViewAll,
      },
      pipeline,
      activity,
      health,
      owner: canViewAll
        ? {
            unassigned_leads: leads.filter(
              (lead) =>
                !lead.assigned_to_admin_id,
            ).length,
            active_prospectors: team.length,
          }
        : null,
      team: teamRows,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível calcular o desempenho comercial.',
      },
      { status: 500 },
    )
  }
}
