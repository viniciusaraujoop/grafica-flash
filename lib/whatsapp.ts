import crypto from 'crypto'

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

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'
}

function token() {
  return process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || ''
}

function defaultPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || ''
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader?: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) return true
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader)) } catch { return false }
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
    template_order_created: data?.template_order_created || null,
    template_order_status: data?.template_order_status || null,
    template_proposal_update: data?.template_proposal_update || null,
    template_payment_update: data?.template_payment_update || null,
    template_language: data?.template_language || 'pt_BR',
    fallback_message: data?.fallback_message || 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
    ai_prompt: data?.ai_prompt || null,
  }
}

async function logMessage(supabaseAdmin: SupabaseAdmin, payload: any) {
  await supabaseAdmin.from('whatsapp_message_logs').insert({
    company_id: payload.companyId || null,
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
    raw_payload: payload.rawPayload || null,
    raw_response: payload.rawResponse || null,
    error: payload.error || null,
  })
}

function textPayload(to: string, text: string) {
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: true, body: text.slice(0, 4096) } }
}

function templatePayload(to: string, templateName: string, language: string, params: string[]) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language || 'pt_BR' },
      components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text || '').slice(0, 1024) })) }] : [],
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
  const accessToken = token()
  const phoneNumberId = options.phoneNumberId || defaultPhoneNumberId()

  if (!to || !accessToken || !phoneNumberId) {
    await logMessage(supabaseAdmin, { ...options, direction: 'outbound', toPhone: to || options.to, content: options.text, status: 'skipped', error: 'WhatsApp não configurado ou telefone inválido.' })
    return { ok: false, skipped: true }
  }

  const useTemplate = Boolean(options.templateName)
  const payload = useTemplate
    ? templatePayload(to, String(options.templateName), options.templateLanguage || 'pt_BR', options.templateParams || [])
    : textPayload(to, options.text)

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    const metaMessageId = data?.messages?.[0]?.id || null

    if (!response.ok) {
      const errorMessage = data?.error?.message || `Erro WhatsApp ${response.status}`
      await logMessage(supabaseAdmin, { ...options, direction: 'outbound', toPhone: to, messageType: useTemplate ? 'template' : 'text', content: options.text, status: 'failed', rawPayload: payload, rawResponse: data, error: errorMessage })
      return { ok: false, error: errorMessage, response: data }
    }

    await logMessage(supabaseAdmin, { ...options, direction: 'outbound', toPhone: to, messageType: useTemplate ? 'template' : 'text', content: options.text, status: 'sent', metaMessageId, rawPayload: payload, rawResponse: data })
    return { ok: true, messageId: metaMessageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar WhatsApp.'
    await logMessage(supabaseAdmin, { ...options, direction: 'outbound', toPhone: to, content: options.text, status: 'failed', rawPayload: payload, error: errorMessage })
    return { ok: false, error: errorMessage }
  }
}

export async function getCompanyByWhatsAppPhoneNumberId(supabaseAdmin: SupabaseAdmin, phoneNumberId: string) {
  const { data: setting } = await supabaseAdmin
    .from('company_whatsapp_settings').select('company_id')
    .eq('phone_number_id', phoneNumberId).eq('enabled', true).limit(1).maybeSingle()

  const companyId = setting?.company_id
  if (!companyId) return null

  const { data } = await supabaseAdmin.from('companies').select('*').eq('id', companyId).maybeSingle()
  return data || null
}

export async function saveInbound(supabaseAdmin: SupabaseAdmin, payload: { companyId: string, from: string, to?: string, name?: string | null, text: string, raw?: any }) {
  const phone = sanitizePhone(payload.from)
  if (phone) {
    await supabaseAdmin.from('whatsapp_conversations').upsert({
      company_id: payload.companyId,
      phone,
      customer_name: payload.name || null,
      last_inbound_at: new Date().toISOString(),
      last_message: payload.text,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,phone' })
  }

  await logMessage(supabaseAdmin, { companyId: payload.companyId, direction: 'inbound', eventType: 'inbound_message', fromPhone: phone, toPhone: payload.to, content: payload.text, status: 'received', rawPayload: payload.raw })
}

export async function generateAiReply(context: { company: any, settings: any, inboundText: string, products?: any[] }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return context.settings.fallback_message

  const products = (context.products || []).slice(0, 30).map((p) => `- ${p.nome}: ${Number(p.preco || 0) > 0 ? money(p.preco) : 'sob consulta'}${p.descricao ? ` — ${p.descricao}` : ''}`).join('\\n')

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
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) return context.settings.fallback_message

  return String(data.output_text || '').trim() || context.settings.fallback_message
}
