import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { enqueueTransactionalEmail } from '@/lib/integrations/email/service'
import { normalizeEmailAddress } from '@/lib/integrations/email/core'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.manage')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const body: unknown = await request.json().catch(() => null)
  const to = body && typeof body === 'object' && !Array.isArray(body) ? normalizeEmailAddress((body as Record<string, unknown>).to) : null
  if (!to) return NextResponse.json({ error: 'Destinatário inválido.' }, { status: 400 })
  const connection = await getCompanyIntegrationConnection(context.admin, context.companyId, 'resend')
  if (!connection || connection.status !== 'CONNECTED') return NextResponse.json({ error: 'Resend precisa estar conectado e saudável.' }, { status: 409 })
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count, error: countError } = await context.admin.from('integration_email_deliveries').select('id', { count: 'exact', head: true }).eq('company_id', context.companyId).eq('template_key', 'test').gte('created_at', since)
  if (countError) throw countError
  if ((count || 0) >= 3) return NextResponse.json({ error: 'Limite de 3 e-mails de teste a cada 10 minutos atingido.' }, { status: 429 })
  const queued = await enqueueTransactionalEmail(context.admin, { companyId: context.companyId, connectionId: connection.id, template: 'test', to, data: { reference: 'Integração Resend', title: 'E-mail de teste do Orçaly' }, idempotencyKey: `test/${context.companyId}/${randomUUID()}` })
  return NextResponse.json(queued, { status: queued.queued ? 202 : 200 })
}
