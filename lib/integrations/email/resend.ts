import { IntegrationError } from '@/lib/integrations/core/errors'
import type { IntegrationAdapter, IntegrationHealth, IntegrationRuntimeContext } from '@/lib/integrations/core/types'
import { parseRetryAfterMs } from '@/lib/jobs/core'
import { extractMailbox, type EmailMessage, type EmailSendResult, type TransactionalEmailProvider } from '@/lib/integrations/email/core'

const RESEND_API = 'https://api.resend.com'

type ResendConfig = { apiKey: string; domain: string; fromAddress: string; replyTo: string | null }

function readConfig(context: IntegrationRuntimeContext, credentials: Record<string, unknown> | null): ResendConfig | null {
  const apiKey = typeof credentials?.api_key === 'string' ? credentials.api_key.trim() : ''
  const domain = typeof context.connection.config.domain === 'string' ? context.connection.config.domain.trim().toLowerCase() : ''
  const fromAddress = typeof context.connection.config.from_address === 'string' ? context.connection.config.from_address.trim() : ''
  const replyToRaw = typeof context.connection.config.reply_to === 'string' ? context.connection.config.reply_to.trim() : ''
  if (!apiKey || !domain || !fromAddress || !extractMailbox(fromAddress)) return null
  return { apiKey, domain, fromAddress, replyTo: replyToRaw || null }
}

async function resendRequest(apiKey: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${apiKey}`)
  headers.set('accept', 'application/json')
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(`${RESEND_API}${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(20_000) })
  const payload: unknown = await response.json().catch(() => null)
  if (response.ok) return payload
  const row = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
  const providerCode = typeof row.name === 'string' ? row.name : typeof row.code === 'string' ? row.code : ''
  if (response.status === 409 && providerCode === 'concurrent_idempotent_requests') {
    throw new IntegrationError('RATE_LIMITED', 'Outra requisição idempotente do Resend ainda está em andamento.', { status: 429, providerCode, retryAfterMs: 1500 })
  }
  const code = response.status === 401 || response.status === 403 ? 'INVALID_CREDENTIAL' : response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'PROVIDER_DOWN' : response.status === 409 ? 'CONFLICT' : 'INVALID_DATA'
  throw new IntegrationError(code, 'O Resend recusou a operação.', { status: response.status, providerCode, retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')) || undefined })
}

function parseDomainList(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [] as Array<{ name: string; status: string }>
  const data = (payload as Record<string, unknown>).data
  if (!Array.isArray(data)) return [] as Array<{ name: string; status: string }>
  return data.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    return typeof row.name === 'string' && typeof row.status === 'string' ? [{ name: row.name.toLowerCase(), status: row.status.toLowerCase() }] : []
  })
}

export const resendEmailProvider: TransactionalEmailProvider = {
  key: 'resend',
  async send(message: EmailMessage, credentials: Record<string, unknown>): Promise<EmailSendResult> {
    const apiKey = typeof credentials.api_key === 'string' ? credentials.api_key.trim() : ''
    if (!apiKey) throw new IntegrationError('NOT_CONFIGURED', 'API key do Resend ausente.')
    const body: Record<string, unknown> = { from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }
    if (message.replyTo) body.reply_to = message.replyTo
    const payload = await resendRequest(apiKey, '/emails', { method: 'POST', headers: { 'Idempotency-Key': message.idempotencyKey }, body: JSON.stringify(body) })
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof (payload as Record<string, unknown>).id !== 'string') {
      throw new IntegrationError('INVALID_DATA', 'Resend não retornou um identificador de e-mail válido.')
    }
    return { providerMessageId: String((payload as Record<string, unknown>).id) }
  },
}

export async function getResendHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealth> {
  const started = Date.now()
  const credentials = await context.loadCredentials()
  const config = readConfig(context, credentials)
  if (!config) return { status: 'NOT_CONFIGURED', checkedAt: new Date().toISOString(), message: 'Configure API key, domínio e remetente do Resend.' }
  const fromMailbox = extractMailbox(config.fromAddress)
  if (!fromMailbox || !fromMailbox.endsWith(`@${config.domain}`)) {
    return { status: 'DEGRADED', checkedAt: new Date().toISOString(), message: 'O remetente precisa pertencer ao domínio configurado.' }
  }
  const domains = parseDomainList(await resendRequest(config.apiKey, '/domains'))
  const domain = domains.find((item) => item.name === config.domain)
  if (!domain) return { status: 'DEGRADED', checkedAt: new Date().toISOString(), message: 'O domínio configurado não aparece na conta Resend.', latencyMs: Date.now() - started }
  if (domain.status !== 'verified') return { status: 'DEGRADED', checkedAt: new Date().toISOString(), message: `Domínio Resend ainda não verificado (${domain.status}).`, latencyMs: Date.now() - started }
  return { status: 'CONNECTED', checkedAt: new Date().toISOString(), message: 'Resend configurado e domínio verificado.', latencyMs: Date.now() - started }
}

export const resendIntegrationAdapter: IntegrationAdapter = {
  key: 'resend',
  name: 'E-mail transacional',
  getCapabilities: () => ['email.send'],
  getHealth: getResendHealth,
  async disconnect(context) {
    await context.emitAudit('email.provider_disconnected', { provider: 'resend' })
  },
}
