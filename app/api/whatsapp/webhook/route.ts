import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { generateAiReply, getCompanyByWhatsAppPhoneNumberId, getWhatsAppSettings, saveInbound, sanitizePhone, sendWhatsAppMessage, verifyWhatsAppSignature } from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BODY_BYTES = 1_000_000

function parseText(message: any) {
  if (message?.type === 'text') return String(message.text?.body || '').trim()
  if (message?.type === 'button') return String(message.button?.text || message.button?.payload || '').trim()
  if (message?.type === 'interactive') return String(message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '').trim()
  return ''
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim()
  if (!verifyToken) return NextResponse.json({ error: 'Webhook indisponível.' }, { status: 503 })
  if (mode === 'subscribe' && token === verifyToken) return new NextResponse(challenge || '', { status: 200 })
  return NextResponse.json({ error: 'Token inválido.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload excede o limite permitido.' }, { status: 413 })
    }

    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload excede o limite permitido.' }, { status: 413 })
    }

    if (!verifyWhatsAppSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 403 })
    }

    let body: any
    try {
      body = JSON.parse(rawBody || '{}')
    } catch {
      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }
    const supabaseAdmin = getSupabaseAdmin()

    for (const entry of Array.isArray(body.entry) ? body.entry : []) {
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        const value = change.value || {}
        const phoneNumberId = value.metadata?.phone_number_id || ''
        const businessPhone = value.metadata?.display_phone_number || ''
        const company = await getCompanyByWhatsAppPhoneNumberId(supabaseAdmin, phoneNumberId)
        if (!company?.id) continue

        const settings = await getWhatsAppSettings(supabaseAdmin, company.id)

        for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
          await supabaseAdmin.from('whatsapp_message_logs').insert({
            company_id: company.id,
            direction: 'outbound',
            event_type: 'status_callback',
            to_phone: sanitizePhone(status.recipient_id || ''),
            message_type: 'status',
            content: status.status || null,
            status: status.status || 'status',
            meta_message_id: status.id || null,
            raw_payload: status,
          })
        }

        const contacts = Array.isArray(value.contacts) ? value.contacts : []

        for (const message of Array.isArray(value.messages) ? value.messages : []) {
          const from = sanitizePhone(message.from || '')
          if (!from) continue

          const contact = contacts.find((item: any) => sanitizePhone(item.wa_id) === from)
          const name = contact?.profile?.name || null
          const inboundText = parseText(message)

          await saveInbound(supabaseAdmin, {
            companyId: company.id,
            from,
            to: businessPhone,
            name,
            text: inboundText || `[${message.type || 'mensagem'}]`,
            raw: message,
          })

          if (!settings.enabled || !settings.ai_enabled) continue

          if (!inboundText) {
            await sendWhatsAppMessage(supabaseAdmin, {
              companyId: company.id,
              eventType: 'ai_fallback_non_text',
              to: from,
              text: settings.fallback_message,
              phoneNumberId: settings.phone_number_id || phoneNumberId,
            })
            continue
          }

          const { data: products } = await supabaseAdmin
            .from('products').select('nome,descricao,preco,ativo,arquivado,categoria,tipo')
            .eq('company_id', company.id).eq('ativo', true).limit(40)

          const reply = await generateAiReply({
            company,
            settings,
            inboundText,
            products: (products || []).filter((p: any) => p.arquivado !== true),
          })

          await sendWhatsAppMessage(supabaseAdmin, {
            companyId: company.id,
            eventType: 'ai_auto_reply',
            to: from,
            text: reply,
            phoneNumberId: settings.phone_number_id || phoneNumberId,
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'whatsapp_webhook_failure',
      error_name: error instanceof Error ? error.name : 'UnknownError',
    }))
    return NextResponse.json({ error: 'Falha ao processar webhook WhatsApp.' }, { status: 500 })
  }
}
