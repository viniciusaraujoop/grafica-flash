import { createNotification } from '@/lib/orcaly-audit'

type SupabaseAdmin = any

export type SmartNotificationSettings = {
  new_order_enabled: boolean
  order_stuck_enabled: boolean
  order_stuck_days: number
  task_due_today_enabled: boolean
  lead_idle_enabled: boolean
  lead_idle_days: number
  proposal_idle_enabled: boolean
  proposal_idle_days: number
  coupon_expiring_enabled: boolean
  coupon_expiring_days: number
  product_without_image_enabled: boolean
  site_without_logo_enabled: boolean
  subscription_expiring_enabled: boolean
  subscription_expiring_days: number
}

export type SmartNotificationResult = {
  company_id: string
  created: number
  skipped: number
  errors: string[]
  events: Array<{
    type: string
    title: string
    link_url?: string
    created: boolean
  }>
}

const DEFAULT_SETTINGS: SmartNotificationSettings = {
  new_order_enabled: true,
  order_stuck_enabled: true,
  order_stuck_days: 3,
  task_due_today_enabled: true,
  lead_idle_enabled: true,
  lead_idle_days: 3,
  proposal_idle_enabled: true,
  proposal_idle_days: 3,
  coupon_expiring_enabled: true,
  coupon_expiring_days: 3,
  product_without_image_enabled: true,
  site_without_logo_enabled: true,
  subscription_expiring_enabled: true,
  subscription_expiring_days: 7,
}

function nowMs() {
  return Date.now()
}

function daysAgoMs(days: number) {
  return nowMs() - Math.max(1, Number(days || 1)) * 24 * 60 * 60 * 1000
}

function daysAheadMs(days: number) {
  return nowMs() + Math.max(1, Number(days || 1)) * 24 * 60 * 60 * 1000
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function toMs(value: unknown) {
  if (!value) return 0
  const date = new Date(String(value))
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function isFinalOrder(status: unknown) {
  const value = String(status || '').toLowerCase()
  return value.includes('entregue') || value.includes('cancel') || value.includes('finaliz')
}

function isClosedLead(lead: any) {
  const etapa = String(lead?.etapa || '').toLowerCase()
  const status = String(lead?.status || '').toLowerCase()

  return etapa.includes('fechado')
    || etapa.includes('perdido')
    || status.includes('inativo')
    || status.includes('perdido')
    || status.includes('fechado')
}

function isClosedProposal(proposal: any) {
  const status = String(proposal?.status || '').toLowerCase()

  return status.includes('aprov')
    || status.includes('aceit')
    || status.includes('fech')
    || status.includes('cancel')
    || status.includes('perd')
}

function hasProductImage(product: any) {
  if (Array.isArray(product?.image_urls) && product.image_urls.filter(Boolean).length > 0) return true
  if (product?.imagem_url) return true
  if (product?.foto_url) return true
  if (product?.image_url) return true
  if (product?.arquivo_url) return true
  return false
}

async function safeRows(
  supabaseAdmin: SupabaseAdmin,
  result: SmartNotificationResult,
  label: string,
  query: any
) {
  try {
    const { data, error } = await query

    if (error) {
      result.errors.push(`${label}: ${error.message}`)
      return []
    }

    return data || []
  } catch (error) {
    result.errors.push(`${label}: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
    return []
  }
}

async function getSettings(
  supabaseAdmin: SupabaseAdmin,
  companyId: string
): Promise<SmartNotificationSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('smart_notification_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      await supabaseAdmin
        .from('smart_notification_settings')
        .insert({ company_id: companyId })

      return DEFAULT_SETTINGS
    }

    return {
      ...DEFAULT_SETTINGS,
      ...data,
      order_stuck_days: Number(data.order_stuck_days || DEFAULT_SETTINGS.order_stuck_days),
      lead_idle_days: Number(data.lead_idle_days || DEFAULT_SETTINGS.lead_idle_days),
      proposal_idle_days: Number(data.proposal_idle_days || DEFAULT_SETTINGS.proposal_idle_days),
      coupon_expiring_days: Number(data.coupon_expiring_days || DEFAULT_SETTINGS.coupon_expiring_days),
      subscription_expiring_days: Number(data.subscription_expiring_days || DEFAULT_SETTINGS.subscription_expiring_days),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function createOnce(
  supabaseAdmin: SupabaseAdmin,
  result: SmartNotificationResult,
  input: {
    company_id: string
    event_key: string
    event_type: string
    entity?: string
    entity_id?: string
    titulo: string
    mensagem: string
    link_url?: string
    tipo?: string
    payload?: Record<string, any>
  }
) {
  try {
    const { error } = await supabaseAdmin
      .from('smart_notification_events')
      .insert({
        company_id: input.company_id,
        event_key: input.event_key,
        event_type: input.event_type,
        entity: input.entity || null,
        entity_id: input.entity_id || null,
      })

    if (error) {
      if (error.code === '23505') {
        result.skipped += 1
        result.events.push({
          type: input.event_type,
          title: input.titulo,
          link_url: input.link_url,
          created: false,
        })
        return false
      }

      result.errors.push(`${input.event_type}: ${error.message}`)
      return false
    }

    await createNotification(supabaseAdmin, {
      company_id: input.company_id,
      tipo: input.tipo || 'smart',
      titulo: input.titulo,
      mensagem: input.mensagem,
      link_url: input.link_url,
      payload: {
        smart: true,
        event_key: input.event_key,
        event_type: input.event_type,
        ...(input.payload || {}),
      },
    })

    result.created += 1
    result.events.push({
      type: input.event_type,
      title: input.titulo,
      link_url: input.link_url,
      created: true,
    })

    return true
  } catch (error) {
    result.errors.push(`${input.event_type}: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
    return false
  }
}

export async function scanCompanySmartNotifications(
  supabaseAdmin: SupabaseAdmin,
  company: any
): Promise<SmartNotificationResult> {
  const companyId = String(company?.id || '')
  const settings = await getSettings(supabaseAdmin, companyId)

  const result: SmartNotificationResult = {
    company_id: companyId,
    created: 0,
    skipped: 0,
    errors: [],
    events: [],
  }

  if (!companyId) {
    result.errors.push('Empresa sem ID.')
    return result
  }

  if (settings.new_order_enabled) {
    const orders = await safeRows(
      supabaseAdmin,
      result,
      'novos pedidos',
      supabaseAdmin
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', new Date(daysAgoMs(1)).toISOString())
        .limit(80)
    )

    for (const order of orders) {
      if (isFinalOrder(order.status)) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `new_order:${order.id}`,
        event_type: 'new_order',
        entity: 'orders',
        entity_id: String(order.id),
        tipo: 'order',
        titulo: 'Novo pedido recebido',
        mensagem: `${order.nome || 'Cliente'} enviou um pedido${order.produto ? `: ${order.produto}` : '.'}`,
        link_url: `/painel/pedidos/${order.id}`,
        payload: { order_id: order.id },
      })
    }
  }

  if (settings.order_stuck_enabled) {
    const openOrders = await safeRows(
      supabaseAdmin,
      result,
      'pedidos parados',
      supabaseAdmin
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .limit(250)
    )

    const cutoff = daysAgoMs(settings.order_stuck_days)

    for (const order of openOrders) {
      if (isFinalOrder(order.status)) continue

      const ref = toMs(order.updated_at || order.created_at)
      if (!ref || ref > cutoff) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `order_stuck:${order.id}:${order.status || 'sem_status'}`,
        event_type: 'order_stuck',
        entity: 'orders',
        entity_id: String(order.id),
        tipo: 'order',
        titulo: 'Pedido parado há alguns dias',
        mensagem: `${order.nome || 'Cliente'} está com pedido em "${order.status || 'sem status'}" há ${settings.order_stuck_days}+ dias.`,
        link_url: `/painel/pedidos/${order.id}`,
        payload: { order_id: order.id, status: order.status },
      })
    }
  }

  if (settings.task_due_today_enabled) {
    const tasks = await safeRows(
      supabaseAdmin,
      result,
      'tarefas vencendo hoje',
      supabaseAdmin
        .from('internal_tasks')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'concluida')
        .limit(200)
    )

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const key = dayKey(start)

    for (const task of tasks) {
      const due = toMs(task.due_at)
      if (!due || due < start.getTime() || due > end.getTime()) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `task_due_today:${task.id}:${key}`,
        event_type: 'task_due_today',
        entity: 'internal_tasks',
        entity_id: String(task.id),
        tipo: 'task',
        titulo: 'Tarefa vence hoje',
        mensagem: task.titulo || 'Uma tarefa precisa de atenção hoje.',
        link_url: '/painel/tarefas',
        payload: { task_id: task.id },
      })
    }
  }

  if (settings.lead_idle_enabled) {
    const leads = await safeRows(
      supabaseAdmin,
      result,
      'leads sem contato',
      supabaseAdmin
        .from('crm_leads')
        .select('*')
        .eq('company_id', companyId)
        .limit(250)
    )

    const cutoff = daysAgoMs(settings.lead_idle_days)

    for (const lead of leads) {
      if (isClosedLead(lead)) continue

      const nextContact = toMs(lead.proximo_contato_em)
      const ref = nextContact || toMs(lead.updated_at || lead.created_at)

      if (!ref || ref > cutoff) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `lead_idle:${lead.id}:${lead.etapa || 'etapa'}`,
        event_type: 'lead_idle',
        entity: 'crm_leads',
        entity_id: String(lead.id),
        tipo: 'crm',
        titulo: 'Lead sem contato há alguns dias',
        mensagem: `${lead.nome || 'Lead'} precisa de retorno. Etapa atual: ${lead.etapa || 'não definida'}.`,
        link_url: '/painel/crm',
        payload: { lead_id: lead.id },
      })
    }
  }

  if (settings.proposal_idle_enabled) {
    const proposals = await safeRows(
      supabaseAdmin,
      result,
      'propostas sem resposta',
      supabaseAdmin
        .from('proposals')
        .select('*')
        .eq('company_id', companyId)
        .limit(250)
    )

    const cutoff = daysAgoMs(settings.proposal_idle_days)

    for (const proposal of proposals) {
      if (isClosedProposal(proposal)) continue

      const ref = toMs(proposal.updated_at || proposal.created_at)
      if (!ref || ref > cutoff) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `proposal_idle:${proposal.id}:${proposal.status || 'status'}`,
        event_type: 'proposal_idle',
        entity: 'proposals',
        entity_id: String(proposal.id),
        tipo: 'proposal',
        titulo: 'Proposta sem resposta',
        mensagem: `${proposal.titulo || proposal.cliente_nome || 'Uma proposta'} está sem resposta há ${settings.proposal_idle_days}+ dias.`,
        link_url: '/painel/propostas',
        payload: { proposal_id: proposal.id },
      })
    }
  }

  if (settings.coupon_expiring_enabled) {
    const coupons = await safeRows(
      supabaseAdmin,
      result,
      'cupons perto de expirar',
      supabaseAdmin
        .from('marketplace_coupons')
        .select('*')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .limit(200)
    )

    const limit = daysAheadMs(settings.coupon_expiring_days)

    for (const coupon of coupons) {
      const ends = toMs(coupon.ends_at)
      if (!ends || ends < nowMs() || ends > limit) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `coupon_expiring:${coupon.id}:${String(coupon.ends_at).slice(0, 10)}`,
        event_type: 'coupon_expiring',
        entity: 'marketplace_coupons',
        entity_id: String(coupon.id),
        tipo: 'coupon',
        titulo: 'Cupom perto de expirar',
        mensagem: `O cupom ${coupon.codigo || coupon.codigo_normalizado || 'sem código'} expira em breve.`,
        link_url: '/painel/cupons',
        payload: { coupon_id: coupon.id },
      })
    }
  }

  if (settings.product_without_image_enabled) {
    const products = await safeRows(
      supabaseAdmin,
      result,
      'produtos sem imagem',
      supabaseAdmin
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .limit(250)
    )

    for (const product of products) {
      if (product.arquivado || product.oculto || product.ativo === false) continue
      if (hasProductImage(product)) continue

      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `product_no_image:${product.id}`,
        event_type: 'product_no_image',
        entity: 'products',
        entity_id: String(product.id),
        tipo: 'product',
        titulo: 'Produto sem imagem',
        mensagem: `${product.nome || 'Um produto'} está sem imagem no catálogo.`,
        link_url: `/painel/produtos/${product.id}`,
        payload: { product_id: product.id },
      })
    }
  }

  if (settings.site_without_logo_enabled && !company.logo_url) {
    await createOnce(supabaseAdmin, result, {
      company_id: companyId,
      event_key: `site_no_logo:${companyId}`,
      event_type: 'site_no_logo',
      entity: 'companies',
      entity_id: companyId,
      tipo: 'site',
      titulo: 'Site sem logo',
      mensagem: 'O site público ainda não tem logo. Isso deixa a página com cara de obra inacabada.',
      link_url: '/painel/site',
      payload: { company_id: companyId },
    })
  }

  if (settings.subscription_expiring_enabled && company.assinatura_expira_em) {
    const expiration = toMs(company.assinatura_expira_em)

    if (expiration && expiration >= nowMs() && expiration <= daysAheadMs(settings.subscription_expiring_days)) {
      await createOnce(supabaseAdmin, result, {
        company_id: companyId,
        event_key: `subscription_expiring:${companyId}:${String(company.assinatura_expira_em).slice(0, 10)}`,
        event_type: 'subscription_expiring',
        entity: 'companies',
        entity_id: companyId,
        tipo: 'subscription',
        titulo: 'Assinatura perto de vencer',
        mensagem: `A assinatura vence em até ${settings.subscription_expiring_days} dias.`,
        link_url: '/assinatura',
        payload: { company_id: companyId },
      })
    }
  }

  return result
}
