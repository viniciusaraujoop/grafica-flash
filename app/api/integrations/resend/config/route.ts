import { NextResponse } from 'next/server'
import { ensureCompanyIntegrationConnection, getCompanyIntegrationConnection, updateIntegrationConnection } from '@/lib/integrations/core/connections'
import { loadIntegrationCredentials, storeIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { createIntegrationRuntimeContext } from '@/lib/integrations/runtime'
import { getResendHealth } from '@/lib/integrations/email/resend'
import { extractMailbox, isEmailAddress } from '@/lib/integrations/email/core'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'
import { requireMfaStepUp } from '@/lib/security/mfa'
import { IntegrationError } from '@/lib/integrations/core/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeDomain(value: unknown) {
  if (typeof value !== 'string') return null
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : null
}

export async function GET() {
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.read')) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
  const connection = await getCompanyIntegrationConnection(context.admin, context.companyId, 'resend')
  if (!connection) return NextResponse.json({ configured: false, status: 'NOT_CONFIGURED', config: { domain: '', from_address: '', reply_to: '' }, has_api_key: false, has_webhook_secret: false })
  const credentials = await loadIntegrationCredentials(context.admin, context.companyId, connection.id)
  return NextResponse.json({ configured: connection.status === 'CONNECTED', status: connection.status, config: { domain: typeof connection.config.domain === 'string' ? connection.config.domain : '', from_address: typeof connection.config.from_address === 'string' ? connection.config.from_address : '', reply_to: typeof connection.config.reply_to === 'string' ? connection.config.reply_to : '' }, has_api_key: typeof credentials?.api_key === 'string' && credentials.api_key.length > 0, has_webhook_secret: typeof credentials?.webhook_secret === 'string' && credentials.webhook_secret.length > 0, webhook_path: `/api/integrations/resend/webhook/${connection.id}` })
}

export async function PATCH(request: Request) {
  try {
    const context = await resolveIntegrationServerContext()
    if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    if (!integrationPermissionAllowed(context, 'integrations.manage')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    const mfa = await requireMfaStepUp(context.userClient, 'integrations.credentials.manage')
    if (!mfa.allowed) return NextResponse.json({ error: mfa.error, reason: mfa.reason }, { status: mfa.status })
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 })
    const row = body as Record<string, unknown>
    const domain = normalizeDomain(row.domain)
    const fromAddress = typeof row.from_address === 'string' ? row.from_address.trim() : ''
    const replyTo = typeof row.reply_to === 'string' ? row.reply_to.trim().toLowerCase() : ''
    if (!domain || !extractMailbox(fromAddress) || (replyTo && !isEmailAddress(replyTo))) return NextResponse.json({ error: 'Domínio, remetente ou Reply-To inválido.' }, { status: 400 })
    const apiKey = typeof row.api_key === 'string' ? row.api_key.trim() : ''
    const webhookSecret = typeof row.webhook_secret === 'string' ? row.webhook_secret.trim() : ''
    if (apiKey && (!apiKey.startsWith('re_') || apiKey.length > 300)) return NextResponse.json({ error: 'Formato de API key Resend inválido.' }, { status: 400 })
    if (webhookSecret && (!webhookSecret.startsWith('whsec_') || webhookSecret.length > 500)) return NextResponse.json({ error: 'Formato de webhook secret inválido.' }, { status: 400 })

    const connection = await ensureCompanyIntegrationConnection(context.admin, context.companyId, 'resend')
    const previous = await loadIntegrationCredentials(context.admin, context.companyId, connection.id)
    const nextCredentials = { ...(previous || {}) }
    if (apiKey) nextCredentials.api_key = apiKey
    if (webhookSecret) nextCredentials.webhook_secret = webhookSecret
    if (typeof nextCredentials.api_key !== 'string' || !nextCredentials.api_key) return NextResponse.json({ error: 'Informe a API key do Resend.' }, { status: 400 })
    await storeIntegrationCredentials(context.admin, context.companyId, connection.id, nextCredentials)
    const config = { ...connection.config, domain, from_address: fromAddress, reply_to: replyTo || null }
    const updated = await updateIntegrationConnection(context.admin, { companyId: context.companyId, provider: 'resend', patch: { config, status: 'CONNECTING', last_error_code: null, last_error_at: null } })
    if (!updated) throw new Error('Conexão Resend não encontrada após atualização.')
    const runtime = createIntegrationRuntimeContext(context.admin, { companyId: context.companyId, connection: updated, userId: context.userId })
    const health = await getResendHealth(runtime)
    await updateIntegrationConnection(context.admin, { companyId: context.companyId, provider: 'resend', patch: { status: health.status, last_success_at: health.status === 'CONNECTED' ? new Date().toISOString() : null, last_error_code: health.status === 'CONNECTED' ? null : 'resend_configuration_incomplete', last_error_at: health.status === 'CONNECTED' ? null : new Date().toISOString() } })
    return NextResponse.json({ ok: true, status: health.status, health: health.message, webhook_path: `/api/integrations/resend/webhook/${connection.id}` })
  } catch (error) {
    if (error instanceof IntegrationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 400 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao configurar Resend.' }, { status: 500 })
  }
}
