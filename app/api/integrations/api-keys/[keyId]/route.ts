import { NextResponse } from 'next/server'
import { revokeCompanyPublicApiKey } from '@/lib/integrations/public-api-keys'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'
import { requireMfaStepUp } from '@/lib/security/mfa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  const { keyId } = await params
  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!integrationPermissionAllowed(context, 'integrations.manage')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const mfa = await requireMfaStepUp(context.userClient, 'integrations.credentials.manage')
  if (!mfa.allowed) return NextResponse.json({ error: mfa.error, reason: mfa.reason }, { status: mfa.status })
  const revoked = await revokeCompanyPublicApiKey(context.admin, { companyId: context.companyId, keyId, userId: context.userId })
  if (!revoked) return NextResponse.json({ error: 'API key não encontrada ou já revogada.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
