import { NextResponse } from 'next/server'
import { createCompanyPublicApiKey, listCompanyPublicApiKeys } from '@/lib/integrations/public-api-keys'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'
import { requireMfaStepUp } from '@/lib/security/mfa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.read')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  return NextResponse.json({ keys: await listCompanyPublicApiKeys(context.admin, context.companyId) })
}

export async function POST(request: Request) {
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.manage')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const mfa = await requireMfaStepUp(context.userClient, 'integrations.credentials.manage')
  if (!mfa.allowed) return NextResponse.json({ error: mfa.error, reason: mfa.reason }, { status: mfa.status })
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  const row = body as Record<string, unknown>
  try {
    const created = await createCompanyPublicApiKey(context.admin, { companyId: context.companyId, userId: context.userId, name: row.name, scopes: row.scopes, expiresAt: row.expires_at })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível criar a API key.' }, { status: 400 })
  }
}
