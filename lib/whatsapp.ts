import crypto from 'node:crypto'
import { resolveWhatsAppCredentials } from '@/lib/whatsapp-credentials'

type SupabaseAdmin = any

export function sanitizePhone(value: unknown) {
  let phone = String(value || '').replace(/\D/g, '')
  if (!phone) return ''
  if (!phone.startsWith('55') && phone.length >= 10 && phone.length <= 11) phone = `55${phone}`
  return phone
}

export function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function shortId(value: unknown) {
  return String(value || '').slice(0, 8).toUpperCase()
}

export function getWhatsAppGraphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader?: string | null) {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim()
  if (!appSecret) {
    return process.env.NODE_ENV !== 'production' && process.env.WHATSAPP_ALLOW_UNSIGNED_WEBHOOK === 'true'
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  try {
    const actualBuffer = Buffer.from(signatureHeader)
    const expectedBuffer = Buffer.from(expected)
    if (actualBuffer.length !== expectedBuffer.length) return false
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  } catch {
    return false
  }
}

export async function getWhatsAppSettings(supabaseAdmin: SupabaseAdmin, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from('company_whatsapp_settings').select('*').eq('company_id', companyId).maybeSingle()
  if (error) throw error
  return {
    company_id: companyId,
    enabled: Boolean(data?.enabled),
    ai_enabled: Boolean(data?.ai_enabled),
    notify_owner_new_order: data?.notify_owner_new_order !== false,
    notify_client_new_order: data?.notify_client_new_order !== false,
    notify_client_order_status: data?.notify_client_order_status !== false,
    notify_client_proposal: data?.notify_client_proposal !== false,
    notify_owner_proposal: data?.notify_owner_proposal !== false,
    owner_phone: data?.owner_phone || null,
    phone_number_id: data?.phone_number_id || null,
    business_account_id: data?.business_account_id || null,
    template_order_created: data?.template_order_created || null,
    template_order_status: data?.template_order_status || null,
    template_proposal_update: data?.template_proposal_update || null,
    template_payment_update: data?.template_payment_update || null,
    template_language: data?.template_language || 'pt_BR',
    fallback_message: data?.fallback_message || 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
    ai_prompt: data?.ai_prompt || null,
  }
}

async function ensureConversation(supabaseAdmin: SupabaseAdmin, payload: {
  companyId: string
  phone: string
  name?: string | null
  lastMessage?: string | null
  direction: 'inbound' | 'outbound'
}) {
  const now = new Date().toISOString()
  const values: Record<string, unknown> = {
    company_id: payload.companyId,
    phone: payload.phone,
    customer_name: payload.name || null,
    last_message: payload.lastMessage || null,
    updated_at: now,
  }

  if (payload.direction === 'inbound') values.last_inbound_at = now
  else values.last_outbound_at = now

  const { data, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .upsert(values, { onConflict: 'company_id,phone' })
    .select('id,company_id,phone,customer_name,last_inbound_at,last_outbound_at,last_message,updated_at')
    .single()

  if (error) throw error
  return data
}

async function logMessage(supabaseAdmin: SupabaseAdmin, payload: any) {
  let conversationId = payload.conversationId || null
  const conversationPhone = sanitizePhone(payload.direction === 'inbound' ? payload.fromPhone : payload.toPhone)

  if (!conversationId && payload.companyId && conversationPhone) {
    const conversation = await ensureConversation(supabaseAdmin, {
      companyId: payload.companyId,
      phone: conversationPhone,
      name: payload.customerName || null,
      lastMessage: payload.content || null,
      direction: payload.direction,
    })
    conversationId = conversation?.id || null
  }

  const { data, error } = await supabaseAdmin.from('whatsapp_message_logs').insert({
    company_id: payload.companyId || null,
    conversation_id: conversationId,
    order_id: payload.orderId || null,
    proposal_id: payload.proposalId || null,
    direction: payload.direction,
    event_type: payload.eventType || null,
    to_phone: payload.toPhone || null,
    from_phone: payload.fromPhone || null,
    message_type: payload.messageType || 'text',
    content: payload.content || null,
    status: payload.status || 'pending',
    meta_message_id: payload.metaMessageId || null,
    provider_timestamp: payload.providerTimestamp || null,
    raw_payload: payload.rawPayload || null,
    raw_response: payload.rawResponse || null,
    error: payload.error || null,
    updated_at: new Date().toISOString(),
  }).select('id,conversation_id').single()

  if (error) throw error
  return data
}

function textPayload(to: string, text: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: true, body: text.slice(0, 4096) },
  }
}

function templatePayload(to: string, templateName: string, language: string, params: string[]) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'pt_BR' },
      components: params.length
        ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text || '').slice(0, 1024) })) }]
        : [],
    },
  }
}

export async function sendWhatsAppMessage(supabaseAdmin: SupabaseAdmin, options: {
  companyId?: string | null
  orderId?: string | null
  proposalId?: string | null
  eventType: string
  to: string
  text: string
  templateName?: string | null
  templateParams?: string[]
  templateLanguage?: string | null
  phoneNumberId?: string | null
}) {
  const to = sanitizePhone(options.to)
  const credentials = await resolveWhatsAppCredentials(supabaseAdmin, {
    companyId: options.companyId,
    phoneNumberId: options.phoneNumberId,
  })

  if (!to || !credentials.configured) {
    await logMessage(supabaseAdmin, {
      ...options,
      direction: 'outbound',
      toPhone: to || options.to,
      content: options.text,
      status: 'skipped',
      error: 'WhatsApp não configurado ou telefone inválido.',
    })
    return { ok: false, skipped: true, error: 'WhatsApp não configurado ou telefone inválido.' }
  }

  const useTemplate = Boolean(options.templateName)
  const payload = useTemplate
    ? templatePayload(to, String(options.templateName), options.templateLanguage || 'pt_BR', options.templateParams || [])
    : textPayload(to, options.text)

  try {
    const response = await fetch(
      `https://graph.facebook.com/${getWhatsAppGraphVersion()}/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    )

    const data = await response.json().catch(() => ({}))
    const metaMessageId = data?.messages?.[0]?.id || null

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Erro WhatsApp ${response.status}`
      await logMessage(supabaseAdmin, {
        ...options,
        direction: 'outbound',
        toPhone: to,
        messageType: useTemplate ? 'template' : 'text',
        content: options.text,
        status: 'failed',
        rawPayload: payload,
        rawResponse: data,
        error: errorMessage,
      })
      return { ok: false, error: errorMessage, response: data }
    }

    const log = await logMessage(supabaseAdmin, {
      ...options,
      direction: 'outbound',
      toPhone: to,
      messageType: useTemplate ? 'template' : 'text',
      content: options.text,
      status: 'sent',
      metaMessageId,
      rawPayload: payload,
      rawResponse: data,
    })

    return {
      ok: true,
      messageId: metaMessageId,
      logId: log?.id || null,
      conversationId: log?.conversation_id || null,
      credentialSource: credentials.source,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar WhatsApp.'
    await logMessage(supabaseAdmin, {
      ...options,
      direction: 'outbound',
      toPhone: to,
      content: options.text,
      status: 'failed',
      rawPayload: payload,
      error: errorMessage,
    })
    return { ok: false, error: errorMessage }
  }
}

export async function getCompanyByWhatsAppPhoneNumberId(supabaseAdmin: SupabaseAdmin, phoneNumberId: string) {
  const normalizedId = String(phoneNumberId || '').trim()
  if (!normalizedId) return null

  const { data: connection, error: connectionError } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('company_id')
    .eq('phone_number_id', normalizedId)
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle()
  if (connectionError) throw connectionError

  let companyId = connection?.company_id || null

  if (!companyId) {
    const { data: setting, error: settingError } = await supabaseAdmin
      .from('company_whatsapp_settings')
      .select('company_id')
      .eq('phone_number_id', normalizedId)
      .eq('enabled', true)
      .limit(1)
      .maybeSingle()
    if (settingError) throw settingError
    companyId = setting?.company_id || null
  }

  if (!companyId) return null
  const { data, error } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).maybeSingle()
  if (error) throw error
  return data || null
}

export async function claimWhatsAppWebhookEvent(supabaseAdmin: SupabaseAdmin, payload: {
  companyId?: string | null
  eventKey: string
  eventType: string
  raw: unknown
}) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload.raw ?? null)).digest('hex')
  const { error } = await supabaseAdmin.from('whatsapp_webhook_events').insert({
    company_id: payload.companyId || null,
    event_key: payload.eventKey,
    event_type: payload.eventType,
    payload_hash: hash,
    processing_status: 'processing',
  })

  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

export async function finishWhatsAppWebhookEvent(supabaseAdmin: SupabaseAdmin, eventKey: string, options?: {
  status?: 'processed' | 'ignored' | 'failed'
  error?: string | null
}) {
  await supabaseAdmin
    .from('whatsapp_webhook_events')
    .update({
      processing_status: options?.status || 'processed',
      processed_at: new Date().toISOString(),
      error_message: options?.error || null,
    })
    .eq('event_key', eventKey)
}

export async function saveInbound(supabaseAdmin: SupabaseAdmin, payload: {
  companyId: string
  from: string
  to?: string
  name?: string | null
  text: string
  metaMessageId?: string | null
  providerTimestamp?: string | null
  raw?: any
}) {
  const phone = sanitizePhone(payload.from)
  if (!phone) return null

  return logMessage(supabaseAdmin, {
    companyId: payload.companyId,
    direction: 'inbound',
    eventType: 'inbound_message',
    fromPhone: phone,
    toPhone: payload.to,
    customerName: payload.name || null,
    content: payload.text,
    status: 'received',
    metaMessageId: payload.metaMessageId || null,
    providerTimestamp: payload.providerTimestamp || null,
    rawPayload: payload.raw,
  })
}

export async function updateWhatsAppMessageStatus(supabaseAdmin: SupabaseAdmin, payload: {
  companyId: string
  metaMessageId: string
  recipientPhone?: string | null
  status: string
  providerTimestamp?: string | null
  raw?: any
}) {
  const update = {
    status: payload.status,
    provider_timestamp: payload.providerTimestamp || null,
    raw_response: payload.raw || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_message_logs')
    .update(update)
    .eq('company_id', payload.companyId)
    .eq('meta_message_id', payload.metaMessageId)
    .eq('direction', 'outbound')
    .select('id')

  if (error) throw error
  if (Array.isArray(data) && data.length) return data[0]

  return logMessage(supabaseAdmin, {
    companyId: payload.companyId,
    direction: 'outbound',
    eventType: 'status_callback',
    toPhone: sanitizePhone(payload.recipientPhone || ''),
    messageType: 'status',
    content: payload.status,
    status: payload.status,
    metaMessageId: payload.metaMessageId,
    providerTimestamp: payload.providerTimestamp || null,
    rawPayload: payload.raw,
  })
}

export async function generateAiReply(context: { company: any, settings: any, inboundText: string, products?: any[] }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return context.settings.fallback_message

  const products = (context.products || [])
    .slice(0, 30)
    .map((p) => `- ${p.nome}: ${Number(p.preco || 0) > 0 ? money(p.preco) : 'sob consulta'}${p.descricao ? ` — ${p.descricao}` : ''}`)
    .join('\n')

  const prompt = `
Você é atendente automático da empresa "${context.company?.nome || 'Empresa'}" no Orçaly.
Responda em português brasileiro, curto, educado e comercial.
Não invente valores fora do catálogo.
Se faltar informação para orçamento, peça medidas, quantidade, prazo e arquivo/referência.
Se o cliente pedir humano, diga que a equipe seguirá o atendimento.
Produtos/serviços:
${products || 'Catálogo não informado.'}

Instruções da empresa:
${context.settings.ai_prompt || 'Conduza o cliente para um orçamento.'}
`.trim()

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ORCALY_AI_MODEL || 'gpt-4.1-mini',
      input: [{ role: 'system', content: prompt }, { role: 'user', content: context.inboundText }],
      max_output_tokens: 450,
    }),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) return context.settings.fallback_message
  return String(data.output_text || '').trim() || context.settings.fallback_message
}
