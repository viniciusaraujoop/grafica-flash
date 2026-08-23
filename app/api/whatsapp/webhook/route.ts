import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import {
  claimWhatsAppWebhookEvent,
  finishWhatsAppWebhookEvent,
  generateAiReply,
  getCompanyByWhatsAppPhoneNumberId,
  getWhatsAppSettings,
  saveInbound,
  sanitizePhone,
  sendWhatsAppMessage,
  updateWhatsAppMessageStatus,
  verifyWhatsAppSignature,
} from '@/lib/whatsapp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseText(message: any) {
  if (message?.type === 'text') return String(message.text?.body || '').trim()
  if (message?.type === 'button') return String(message.button?.text || message.button?.payload || '').trim()
  if (message?.type === 'interactive') {
    return String(message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '').trim()
  }
  return ''
}

function metaTimestamp(value: unknown) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expectedToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim()
  if (mode === 'subscribe' && expectedToken && token === expectedToken) {
    return new NextResponse(challenge || '', { status: 200 })
  }

  return NextResponse.json({ error: 'Token inválido.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    if (!verifyWhatsAppSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 403 })
    }

    const body = JSON.parse(rawBody || '{}')
    const supabaseAdmin = getSupabaseAdmin()

    for (const entry of Array.isArray(body.entry) ? body.entry : []) {
      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        const value = change.value || {}
        const phoneNumberId = String(value.metadata?.phone_number_id || '').trim()
        const businessPhone = String(value.metadata?.display_phone_number || '').trim()
        const company = await getCompanyByWhatsAppPhoneNumberId(supabaseAdmin, phoneNumberId)
        if (!company?.id) continue

        const settings = await getWhatsAppSettings(supabaseAdmin, company.id)

        for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
          const messageId = String(status?.id || '').trim()
          const deliveryStatus = String(status?.status || '').trim()
          if (!messageId || !deliveryStatus) continue

          const eventKey = `status:${messageId}:${deliveryStatus}:${String(status?.timestamp || '')}`
          const shouldProcess = await claimWhatsAppWebhookEvent(supabaseAdmin, {
            companyId: company.id,
            eventKey,
            eventType: 'message_status',
            raw: status,
          })
          if (!shouldProcess) continue

          try {
            await updateWhatsAppMessageStatus(supabaseAdmin, {
              companyId: company.id,
              metaMessageId: messageId,
              recipientPhone: status?.recipient_id || null,
              status: deliveryStatus,
              providerTimestamp: metaTimestamp(status?.timestamp),
              raw: status,
            })
            await finishWhatsAppWebhookEvent(supabaseAdmin, eventKey)
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Falha no status do WhatsApp.'
            await finishWhatsAppWebhookEvent(supabaseAdmin, eventKey, { status: 'failed', error: message })
            throw error
          }
        }

        const contacts = Array.isArray(value.contacts) ? value.contacts : []

        for (const message of Array.isArray(value.messages) ? value.messages : []) {
          const metaMessageId = String(message?.id || '').trim()
          const from = sanitizePhone(message?.from || '')
          if (!metaMessageId || !from) continue

          const eventKey = `message:${metaMessageId}`
          const shouldProcess = await claimWhatsAppWebhookEvent(supabaseAdmin, {
            companyId: company.id,
            eventKey,
            eventType: 'inbound_message',
            raw: message,
          })
          if (!shouldProcess) continue

          try {
            const contact = contacts.find((item: any) => sanitizePhone(item?.wa_id) === from)
            const name = contact?.profile?.name || null
            const inboundText = parseText(message)

            await saveInbound(supabaseAdmin, {
              companyId: company.id,
              from,
              to: businessPhone,
              name,
              text: inboundText || `[${message?.type || 'mensagem'}]`,
              metaMessageId,
              providerTimestamp: metaTimestamp(message?.timestamp),
              raw: message,
            })

            if (settings.enabled && settings.ai_enabled) {
              if (!inboundText) {
                await sendWhatsAppMessage(supabaseAdmin, {
                  companyId: company.id,
                  eventType: 'ai_fallback_non_text',
                  to: from,
                  text: settings.fallback_message,
                  phoneNumberId: settings.phone_number_id || phoneNumberId,
                })
              } else {
                const { data: products, error: productsError } = await supabaseAdmin
                  .from('products')
                  .select('nome,descricao,preco,ativo,arquivado,categoria,tipo')
                  .eq('company_id', company.id)
                  .eq('ativo', true)
                  .limit(40)
                if (productsError) throw productsError

                const reply = await generateAiReply({
                  company,
                  settings,
                  inboundText,
                  products: (products || []).filter((product: any) => product.arquivado !== true),
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

            await finishWhatsAppWebhookEvent(supabaseAdmin, eventKey)
          } catch (error) {
            const messageText = error instanceof Error ? error.message : 'Falha na mensagem do WhatsApp.'
            await finishWhatsAppWebhookEvent(supabaseAdmin, eventKey, { status: 'failed', error: messageText })
            throw error
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Orçaly WhatsApp] Falha no webhook:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Não foi possível processar o webhook do WhatsApp.' }, { status: 500 })
  }
}
