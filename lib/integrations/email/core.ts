import { createHmac, timingSafeEqual } from 'node:crypto'

export const TRANSACTIONAL_EMAIL_TEMPLATES = [
  'proposal',
  'order_received',
  'order_ready',
  'payment_confirmed',
  'user_invite',
  'notification',
  'report',
  'test',
] as const

export type TransactionalEmailTemplateKey = (typeof TRANSACTIONAL_EMAIL_TEMPLATES)[number]
export type CanonicalEmailStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'complained' | 'unsubscribed'

export type EmailMessage = {
  to: string
  from: string
  replyTo?: string | null
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export type EmailSendResult = { providerMessageId: string }

export interface TransactionalEmailProvider {
  readonly key: string
  send(message: EmailMessage, credentials: Record<string, unknown>): Promise<EmailSendResult>
}

export function isEmailAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const email = value.trim()
  return email.length > 3 && email.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
}

export function normalizeEmailAddress(value: unknown): string | null {
  return isEmailAddress(value) ? value.trim().toLowerCase() : null
}

export function extractMailbox(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  if (isEmailAddress(input)) return input.toLowerCase()
  const match = input.match(/<([^<>]+)>\s*$/)
  return match && isEmailAddress(match[1]) ? match[1].trim().toLowerCase() : null
}

export function escapeEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeText(data: Record<string, unknown>, key: string, fallback = '') {
  const value = data[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 4000) : fallback
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const templateDefaults: Record<TransactionalEmailTemplateKey, { eyebrow: string; title: string; message: string }> = {
  proposal: { eyebrow: 'Proposta', title: 'Sua proposta está pronta', message: 'Confira os detalhes da proposta preparada para você.' },
  order_received: { eyebrow: 'Pedido recebido', title: 'Recebemos seu pedido', message: 'Seu pedido entrou no fluxo da empresa e será acompanhado pelo Orçaly.' },
  order_ready: { eyebrow: 'Pedido pronto', title: 'Seu pedido está pronto', message: 'A produção foi concluída. Confira as orientações abaixo.' },
  payment_confirmed: { eyebrow: 'Pagamento', title: 'Pagamento confirmado', message: 'O pagamento foi confirmado com sucesso.' },
  user_invite: { eyebrow: 'Convite', title: 'Você recebeu um convite', message: 'Use o botão abaixo para acessar sua conta com segurança.' },
  notification: { eyebrow: 'Notificação', title: 'Atualização importante', message: 'Há uma nova atualização para você.' },
  report: { eyebrow: 'Relatório', title: 'Seu relatório está disponível', message: 'Confira o resumo e acesse os detalhes quando quiser.' },
  test: { eyebrow: 'Teste de integração', title: 'E-mail de teste do Orçaly', message: 'Se você recebeu esta mensagem, o pipeline transacional está enviando corretamente.' },
}

export function renderTransactionalEmail(template: TransactionalEmailTemplateKey, data: Record<string, unknown>, brandName = 'Orçaly') {
  const defaults = templateDefaults[template]
  const title = safeText(data, 'title', defaults.title)
  const message = safeText(data, 'message', defaults.message)
  const detail = safeText(data, 'detail')
  const reference = safeText(data, 'reference')
  const ctaLabel = safeText(data, 'cta_label', 'Ver detalhes').slice(0, 80)
  const ctaUrl = safeUrl(data.cta_url)
  const brand = safeText({ brand: brandName }, 'brand', 'Orçaly').slice(0, 120)
  const text = [title, message, detail, reference ? `Referência: ${reference}` : '', ctaUrl ? `${ctaLabel}: ${ctaUrl}` : ''].filter(Boolean).join('\n\n')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e5edf7;border-radius:20px;overflow:hidden"><tr><td style="background:#0b3b78;padding:28px 30px;color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#bfe4ff">${escapeEmailHtml(defaults.eyebrow)}</div><div style="margin-top:10px;font-size:28px;line-height:1.18;font-weight:800">${escapeEmailHtml(title)}</div></td></tr><tr><td style="padding:30px"><p style="margin:0;font-size:16px;line-height:1.7;color:#42546b">${escapeEmailHtml(message)}</p>${detail ? `<p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#42546b">${escapeEmailHtml(detail)}</p>` : ''}${reference ? `<div style="margin-top:20px;padding:14px 16px;border-radius:12px;background:#f4f7fb;font-size:13px;color:#5a6d84"><strong>Referência:</strong> ${escapeEmailHtml(reference)}</div>` : ''}${ctaUrl ? `<p style="margin:26px 0 0"><a href="${escapeEmailHtml(ctaUrl)}" style="display:inline-block;background:#0b3b78;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:12px">${escapeEmailHtml(ctaLabel)}</a></p>` : ''}<p style="margin:30px 0 0;padding-top:20px;border-top:1px solid #edf1f6;font-size:12px;line-height:1.6;color:#8290a3">Mensagem transacional enviada por ${escapeEmailHtml(brand)}. Não responda a este endereço se a empresa não tiver configurado Reply-To.</p></td></tr></table></td></tr></table></body></html>`
  return { html, text, subject: safeText(data, 'subject', title).slice(0, 240) }
}

export function isTransactionalEmailTemplate(value: unknown): value is TransactionalEmailTemplateKey {
  return typeof value === 'string' && (TRANSACTIONAL_EMAIL_TEMPLATES as readonly string[]).includes(value)
}

export function mapResendEventStatus(eventType: unknown): CanonicalEmailStatus | null {
  if (typeof eventType !== 'string') return null
  const map: Record<string, CanonicalEmailStatus> = {
    'email.scheduled': 'queued',
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.failed': 'failed',
    'email.complained': 'complained',
    'email.suppressed': 'failed',
  }
  return map[eventType] || null
}

function decodeWebhookSecret(secret: string): Buffer | null {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret
  if (!raw) return null
  try {
    const decoded = Buffer.from(raw, 'base64')
    return decoded.length ? decoded : null
  } catch {
    return null
  }
}

export function verifySvixWebhook(input: { rawBody: string; id: string | null; timestamp: string | null; signature: string | null; secret: string; nowMs?: number; toleranceSeconds?: number }) {
  if (!input.id || !input.timestamp || !input.signature) return false
  const timestampSeconds = Number(input.timestamp)
  if (!Number.isFinite(timestampSeconds)) return false
  const nowMs = input.nowMs ?? Date.now()
  const toleranceMs = (input.toleranceSeconds ?? 300) * 1000
  if (Math.abs(nowMs - timestampSeconds * 1000) > toleranceMs) return false
  const key = decodeWebhookSecret(input.secret)
  if (!key) return false
  const expected = createHmac('sha256', key).update(`${input.id}.${input.timestamp}.${input.rawBody}`).digest()
  for (const candidate of input.signature.split(/\s+/)) {
    const comma = candidate.indexOf(',')
    if (comma <= 0 || candidate.slice(0, comma) !== 'v1') continue
    try {
      const actual = Buffer.from(candidate.slice(comma + 1), 'base64')
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true
    } catch {
      continue
    }
  }
  return false
}
