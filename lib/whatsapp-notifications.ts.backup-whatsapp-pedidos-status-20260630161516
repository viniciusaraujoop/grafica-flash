import { getWhatsAppSettings, money, sanitizePhone, sendWhatsAppMessage, shortId } from '@/lib/whatsapp'

type SupabaseAdmin = any

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://orcaly.com.br').replace(/\/$/, '')
}

function orderUrl(order: any) {
  return order?.id ? `${siteUrl()}/painel/orcamento/${order.id}` : `${siteUrl()}/painel`
}

async function safeSend(supabaseAdmin: SupabaseAdmin, options: any) {
  try { return await sendWhatsAppMessage(supabaseAdmin, options) }
  catch (error) { console.error('[Orçaly WhatsApp]', error); return { ok: false } }
}

export async function notifyNewOrder(supabaseAdmin: SupabaseAdmin, payload: { company: any, order: any, cliente?: any, total?: number, resumo?: string }) {
  const { company, order } = payload
  if (!company?.id || !order?.id) return

  const settings = await getWhatsAppSettings(supabaseAdmin, company.id)
  if (!settings.enabled) return

  const numero = `#${shortId(order.id)}`
  const total = Number(payload.total || order.valor_total || order.preco_estimado || 0)
  const resumo = payload.resumo || order.itens_resumo || order.produto || 'Pedido'

  if (settings.notify_owner_new_order) {
    const to = sanitizePhone(settings.owner_phone || company.whatsapp)
    if (to) {
      await safeSend(supabaseAdmin, {
        companyId: company.id, orderId: order.id, eventType: 'owner_new_order', to,
        text: `Novo pedido recebido no Orçaly.\\n\\nPedido: ${numero}\\nCliente: ${order.nome || payload.cliente?.nome || 'Cliente'}\\nWhatsApp: ${order.telefone || payload.cliente?.telefone || 'não informado'}\\nItens: ${resumo}\\nValor: ${money(total)}\\n\\nAbrir: ${orderUrl(order)}`,
        templateName: settings.template_order_created,
        templateParams: [company.nome || 'Empresa', numero, order.nome || payload.cliente?.nome || 'Cliente', money(total), orderUrl(order)],
        templateLanguage: settings.template_language,
        phoneNumberId: settings.phone_number_id,
      })
    }
  }

  if (settings.notify_client_new_order) {
    const to = sanitizePhone(order.telefone || payload.cliente?.telefone)
    if (to) {
      await safeSend(supabaseAdmin, {
        companyId: company.id, orderId: order.id, eventType: 'client_new_order', to,
        text: `Olá, ${order.nome || payload.cliente?.nome || 'tudo bem'}!\\n\\nRecebemos seu pedido ${numero} em ${company.nome || 'nossa empresa'}.\\nItens: ${resumo}\\nValor estimado: ${money(total)}\\n\\nNossa equipe vai analisar e seguir com o atendimento.`,
        templateName: settings.template_order_created,
        templateParams: [order.nome || payload.cliente?.nome || 'Cliente', numero, company.nome || 'Empresa', money(total)],
        templateLanguage: settings.template_language,
        phoneNumberId: settings.phone_number_id,
      })
    }
  }
}

export async function notifyOrderStatus(supabaseAdmin: SupabaseAdmin, payload: { company: any, order: any, status: string, source?: string }) {
  const { company, order } = payload
  if (!company?.id || !order?.id) return

  const settings = await getWhatsAppSettings(supabaseAdmin, company.id)
  if (!settings.enabled || !settings.notify_client_order_status) return

  const to = sanitizePhone(order.telefone || order.customer_whatsapp)
  if (!to) return

  const numero = `#${shortId(order.id)}`
  await safeSend(supabaseAdmin, {
    companyId: company.id, orderId: order.id, eventType: `client_order_status_${payload.source || 'manual'}`, to,
    text: `Atualização do seu pedido ${numero}\\n\\nStatus: ${payload.status}\\nEmpresa: ${company.nome || 'Empresa'}\\n\\nQualquer dúvida, responda esta mensagem.`,
    templateName: settings.template_order_status,
    templateParams: [order.nome || order.customer_name || 'Cliente', numero, payload.status, company.nome || 'Empresa'],
    templateLanguage: settings.template_language,
    phoneNumberId: settings.phone_number_id,
  })
}

export async function notifyProposalAction(supabaseAdmin: SupabaseAdmin, payload: { company: any, proposal: any, event: 'sent' | 'approved' | 'change_requested' | 'rejected', note?: string | null, pixValor?: number | null }) {
  const { company, proposal } = payload
  if (!company?.id || !proposal?.id) return

  const settings = await getWhatsAppSettings(supabaseAdmin, company.id)
  if (!settings.enabled) return

  const numero = proposal.proposta_numero || `#${shortId(proposal.id)}`
  const valor = money(proposal.valor_total || 0)
  const label: Record<string, string> = {
    sent: 'Proposta enviada',
    approved: 'Proposta aprovada',
    change_requested: 'Alteração solicitada',
    rejected: 'Proposta recusada',
  }

  if (settings.notify_owner_proposal) {
    const to = sanitizePhone(settings.owner_phone || company.whatsapp)
    if (to) {
      await safeSend(supabaseAdmin, {
        companyId: company.id, orderId: proposal.order_id, proposalId: proposal.id, eventType: `owner_proposal_${payload.event}`, to,
        text: `${label[payload.event]} no Orçaly.\\n\\nProposta: ${numero}\\nCliente: ${proposal.cliente_nome || 'Cliente'}\\nValor: ${valor}${payload.note ? `\\nObservação: ${payload.note}` : ''}`,
        templateName: settings.template_proposal_update,
        templateParams: [company.nome || 'Empresa', numero, label[payload.event], proposal.cliente_nome || 'Cliente', valor],
        templateLanguage: settings.template_language,
        phoneNumberId: settings.phone_number_id,
      })
    }
  }

  if (settings.notify_client_proposal) {
    const to = sanitizePhone(proposal.cliente_whatsapp)
    if (to) {
      await safeSend(supabaseAdmin, {
        companyId: company.id, orderId: proposal.order_id, proposalId: proposal.id, eventType: `client_proposal_${payload.event}`, to,
        text: `${label[payload.event]}: ${numero}\\n\\nValor: ${valor}\\nEmpresa: ${company.nome || 'Empresa'}\\n${proposal.token ? `${siteUrl()}/proposta/${proposal.token}` : ''}`,
        templateName: settings.template_proposal_update,
        templateParams: [proposal.cliente_nome || 'Cliente', numero, label[payload.event], valor, company.nome || 'Empresa'],
        templateLanguage: settings.template_language,
        phoneNumberId: settings.phone_number_id,
      })
    }
  }
}
