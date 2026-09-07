import { NextRequest, NextResponse } from 'next/server'
import {
  auditPlatformAction,
  canPlatform,
  requirePlatformAdmin,
  type PlatformAdmin,
} from '@/lib/platform-admin'
import { getSupabaseAdmin } from '@/lib/company-access'
import {
  isContactChannel,
  isManualSalesStage,
} from '@/lib/prospecting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function email(value: unknown) {
  return text(value, 320).toLowerCase()
}

function nullableText(value: unknown, max = 500) {
  const valueText = text(value, max)
  return valueText || null
}

function nullableDate(value: unknown) {
  const valueText = text(value, 100)
  if (!valueText) return null

  const parsed = new Date(valueText)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toISOString()
}

function databaseMessage(message: string) {
  if (message.includes('PROSPECT_ALREADY_ASSIGNED')) {
    return 'Esse contato já pertence a outro responsável comercial.'
  }

  if (message.includes('PROSPECT_ALREADY_CUSTOMER')) {
    return 'Esse e-mail já pertence a um cliente convertido e não pode ser assumido como novo prospect.'
  }

  if (message.includes('SYSTEM_STAGE_ONLY')) {
    return 'Essa etapa é controlada pelo sistema e não pode ser marcada manualmente por um Prospector.'
  }

  if (message.includes('LEAD_NOT_OWNED')) {
    return 'Esse prospect não pertence à sua carteira.'
  }

  if (message.includes('LOST_REASON_REQUIRED')) {
    return 'Informe o motivo da perda.'
  }

  if (message.includes('INVALID_ASSIGNEE')) {
    return 'O responsável comercial informado não está disponível.'
  }

  if (message.includes('INVALID_EMAIL')) {
    return 'Informe um e-mail válido.'
  }

  if (message.includes('COMPANY_NAME_REQUIRED')) {
    return 'Informe o nome da empresa.'
  }

  return message
}

async function visibleLead(
  supabaseAdmin: SupabaseAdmin,
  admin: PlatformAdmin,
  leadId: string,
  canViewAll: boolean,
) {
  let query = supabaseAdmin
    .from('signup_leads')
    .select(
      'id,nome_responsavel,email,whatsapp,empresa_nome,segmento,cidade,estado,plano,status,lead_source,payment_status,converted_user_id,converted_company_id,followup_count,last_followup_at,next_followup_at,sales_stage,assigned_to_admin_id,created_by_admin_id,sales_notes,sales_stage_updated_at,sales_last_contact_at,sales_next_action_at,sales_lost_reason,created_at,updated_at',
    )
    .eq('id', leadId)

  if (!canViewAll) {
    query = query.eq('assigned_to_admin_id', admin.id)
  }

  const { data, error } = await query.maybeSingle()

  if (error) throw error
  return data
}

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'prospecting.access',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const canViewAll = canPlatform(
    session.admin,
    'prospecting.view_all',
  )
  const canViewOwn = canPlatform(
    session.admin,
    'prospecting.view_own',
  )

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json(
      { error: 'Seu perfil não pode consultar prospects.' },
      { status: 403 },
    )
  }

  const leadId = text(
    request.nextUrl.searchParams.get('lead_id'),
    80,
  )

  try {
    if (leadId) {
      const lead = await visibleLead(
        session.supabaseAdmin,
        session.admin,
        leadId,
        canViewAll,
      )

      if (!lead) {
        return NextResponse.json(
          { error: 'Prospect não encontrado.' },
          { status: 404 },
        )
      }

      const { data: followups, error: followupError } =
        await session.supabaseAdmin
          .from('signup_lead_followups')
          .select(
            'id,lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data,created_at',
          )
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(100)

      if (followupError) throw followupError

      return NextResponse.json({
        prospect: lead,
        followups: followups || [],
      })
    }

    const stage = text(
      request.nextUrl.searchParams.get('stage'),
      40,
    )

    let query = session.supabaseAdmin
      .from('signup_leads')
      .select(
        'id,nome_responsavel,email,whatsapp,empresa_nome,segmento,cidade,estado,plano,status,lead_source,payment_status,converted_company_id,followup_count,last_followup_at,sales_stage,assigned_to_admin_id,created_by_admin_id,sales_stage_updated_at,sales_last_contact_at,sales_next_action_at,sales_lost_reason,created_at,updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(300)

    if (!canViewAll) {
      query = query.eq(
        'assigned_to_admin_id',
        session.admin.id,
      )
    }

    if (stage) {
      query = query.eq('sales_stage', stage)
    }

    const { data, error } = await query

    if (error) throw error

    const prospects = data || []
    const adminIds = Array.from(
      new Set(
        prospects
          .map((item) => item.assigned_to_admin_id)
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.length > 0,
          ),
      ),
    )

    const assigneeById: Record<
      string,
      { id: string; nome: string; email: string; role: string }
    > = {}

    if (adminIds.length > 0) {
      const { data: admins, error: adminError } =
        await session.supabaseAdmin
          .from('platform_admins')
          .select('id,nome,email,role')
          .in('id', adminIds)

      if (adminError) throw adminError

      for (const item of admins || []) {
        assigneeById[String(item.id)] = {
          id: String(item.id),
          nome: String(item.nome || item.email || ''),
          email: String(item.email || ''),
          role: String(item.role || ''),
        }
      }
    }

    let assignees: Array<{
      id: string
      nome: string
      email: string
      role: string
    }> = []

    if (canViewAll) {
      const { data: team, error: teamError } =
        await session.supabaseAdmin
          .from('platform_admins')
          .select('id,nome,email,role')
          .eq('is_active', true)
          .in('role', ['owner', 'prospector'])
          .order('nome', { ascending: true })

      if (teamError) throw teamError

      assignees = (team || []).map((item) => ({
        id: String(item.id),
        nome: String(item.nome || item.email || ''),
        email: String(item.email || ''),
        role: String(item.role || ''),
      }))
    }

    return NextResponse.json({
      prospects: prospects.map((item) => ({
        ...item,
        assignee: item.assigned_to_admin_id
          ? assigneeById[String(item.assigned_to_admin_id)] || null
          : null,
      })),
      assignees,
      viewer: {
        id: session.admin.id,
        role: session.admin.role,
        canViewAll,
        canCreate: canPlatform(
          session.admin,
          'prospecting.create',
        ),
        canEditOwn: canPlatform(
          session.admin,
          'prospecting.edit_own',
        ),
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? databaseMessage(error.message)
            : 'Não foi possível carregar a prospecção.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await requirePlatformAdmin(
    request,
    'prospecting.access',
  )

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  const canViewAll = canPlatform(
    session.admin,
    'prospecting.view_all',
  )

  try {
    const body = await request.json().catch(() => ({}))
    const action = text(body.action, 40)

    if (action === 'create') {
      if (
        !canPlatform(session.admin, 'prospecting.create')
      ) {
        return NextResponse.json(
          { error: 'Seu perfil não pode criar prospects.' },
          { status: 403 },
        )
      }

      const targetEmail = email(body.email)
      const companyName = text(body.empresa_nome, 180)
      const requestedAssignee = text(
        body.assigned_to_admin_id,
        80,
      )
      const assignedTo = canViewAll
        ? requestedAssignee || session.admin.id
        : session.admin.id

      const { data: leadId, error } =
        await session.supabaseAdmin.rpc(
          'create_or_claim_sales_prospect',
          {
            p_actor_admin_id: session.admin.id,
            p_assigned_admin_id: assignedTo,
            p_email: targetEmail,
            p_empresa_nome: companyName,
            p_nome_responsavel: nullableText(
              body.nome_responsavel,
              160,
            ),
            p_whatsapp: nullableText(body.whatsapp, 40),
            p_segmento: nullableText(body.segmento, 120),
            p_cidade: nullableText(body.cidade, 120),
            p_estado: nullableText(body.estado, 40),
          },
        )

      if (error) {
        return NextResponse.json(
          { error: databaseMessage(error.message) },
          { status: 409 },
        )
      }

      await auditPlatformAction(
        session.admin.email,
        'sales_prospect_created_or_claimed',
        {
          targetType: 'signup_lead',
          targetId: String(leadId),
          targetLabel: targetEmail,
          payload: {
            assigned_to_admin_id: assignedTo,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        leadId,
        message: 'Prospect salvo na carteira comercial.',
      })
    }

    const leadId = text(body.lead_id, 80)

    if (!leadId) {
      return NextResponse.json(
        { error: 'Prospect não informado.' },
        { status: 400 },
      )
    }

    const lead = await visibleLead(
      session.supabaseAdmin,
      session.admin,
      leadId,
      canViewAll,
    )

    if (!lead) {
      return NextResponse.json(
        { error: 'Prospect não encontrado na sua carteira.' },
        { status: 404 },
      )
    }

    if (action === 'update') {
      if (
        !canViewAll &&
        !canPlatform(session.admin, 'prospecting.edit_own')
      ) {
        return NextResponse.json(
          { error: 'Seu perfil não pode editar prospects.' },
          { status: 403 },
        )
      }

      const patch = {
        nome_responsavel: nullableText(
          body.nome_responsavel,
          160,
        ),
        whatsapp: nullableText(body.whatsapp, 40),
        empresa_nome:
          text(body.empresa_nome, 180) ||
          String(lead.empresa_nome || ''),
        segmento: nullableText(body.segmento, 120),
        cidade: nullableText(body.cidade, 120),
        estado: nullableText(body.estado, 40),
        sales_notes: nullableText(body.sales_notes, 4000),
        sales_next_action_at: nullableDate(
          body.sales_next_action_at,
        ),
        updated_at: new Date().toISOString(),
      }

      let update = session.supabaseAdmin
        .from('signup_leads')
        .update(patch)
        .eq('id', leadId)

      if (!canViewAll) {
        update = update.eq(
          'assigned_to_admin_id',
          session.admin.id,
        )
      }

      const { data, error } = await update
        .select('id')
        .maybeSingle()

      if (error) throw error

      if (!data?.id) {
        return NextResponse.json(
          {
            error:
              'O prospect mudou de responsável antes da edição ser salva.',
          },
          { status: 409 },
        )
      }

      await auditPlatformAction(
        session.admin.email,
        'sales_prospect_updated',
        {
          targetType: 'signup_lead',
          targetId: leadId,
          targetLabel: String(lead.email || ''),
        },
      )

      return NextResponse.json({ ok: true })
    }

    if (action === 'stage') {
      if (!isManualSalesStage(body.stage)) {
        return NextResponse.json(
          {
            error:
              'Essa etapa é automática ou não pode ser escolhida manualmente.',
          },
          { status: 400 },
        )
      }

      const { error } = await session.supabaseAdmin.rpc(
        'change_signup_lead_sales_stage',
        {
          p_lead_id: leadId,
          p_actor_admin_id: session.admin.id,
          p_stage: body.stage,
          p_note: nullableText(body.note, 1000),
          p_lost_reason:
            body.stage === 'perdido'
              ? nullableText(body.lost_reason, 800)
              : null,
        },
      )

      if (error) {
        return NextResponse.json(
          { error: databaseMessage(error.message) },
          { status: 409 },
        )
      }

      await auditPlatformAction(
        session.admin.email,
        'sales_stage_changed',
        {
          targetType: 'signup_lead',
          targetId: leadId,
          targetLabel: String(lead.email || ''),
          payload: {
            from: lead.sales_stage,
            to: body.stage,
          },
        },
      )

      return NextResponse.json({ ok: true })
    }

    if (action === 'contact') {
      if (!isContactChannel(body.channel)) {
        return NextResponse.json(
          { error: 'Canal de contato inválido.' },
          { status: 400 },
        )
      }

      const message = text(body.message, 3000)

      if (!message) {
        return NextResponse.json(
          { error: 'Descreva o contato realizado.' },
          { status: 400 },
        )
      }

      const { data: followupId, error } =
        await session.supabaseAdmin.rpc(
          'record_signup_lead_sales_followup',
          {
            p_lead_id: leadId,
            p_actor_admin_id: session.admin.id,
            p_channel: body.channel,
            p_message: message,
            p_next_action_at: nullableDate(
              body.next_action_at,
            ),
          },
        )

      if (error) {
        return NextResponse.json(
          { error: databaseMessage(error.message) },
          { status: 409 },
        )
      }

      return NextResponse.json({
        ok: true,
        followupId,
        message: 'Contato registrado.',
      })
    }

    if (action === 'assign') {
      if (!canViewAll) {
        return NextResponse.json(
          {
            error:
              'Somente o Owner pode redistribuir a carteira comercial.',
          },
          { status: 403 },
        )
      }

      const assigneeId = text(
        body.assigned_to_admin_id,
        80,
      )

      if (!assigneeId) {
        return NextResponse.json(
          { error: 'Selecione o responsável.' },
          { status: 400 },
        )
      }

      const { data: assignee, error: assigneeError } =
        await session.supabaseAdmin
          .from('platform_admins')
          .select('id,nome,email,role,is_active')
          .eq('id', assigneeId)
          .eq('is_active', true)
          .in('role', ['owner', 'prospector'])
          .maybeSingle()

      if (assigneeError) throw assigneeError

      if (!assignee?.id) {
        return NextResponse.json(
          {
            error:
              'Responsável comercial inválido ou desativado.',
          },
          { status: 400 },
        )
      }

      const { data, error } = await session.supabaseAdmin
        .from('signup_leads')
        .update({
          assigned_to_admin_id: assignee.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select('id')
        .single()

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'sales_prospect_assigned',
        {
          targetType: 'signup_lead',
          targetId: data.id,
          targetLabel: String(lead.email || ''),
          payload: {
            from: lead.assigned_to_admin_id,
            to: assignee.id,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        message: `Prospect atribuído a ${
          assignee.nome || assignee.email
        }.`,
      })
    }

    return NextResponse.json(
      { error: 'Ação comercial inválida.' },
      { status: 400 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? databaseMessage(error.message)
            : 'Não foi possível concluir a operação comercial.',
      },
      { status: 500 },
    )
  }
}
