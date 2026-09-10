import { NextResponse } from 'next/server'
import { canUseFeature, requireFeatureDecision } from '@/lib/access-control'
import { deleteIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { getCompanyIntegrationConnection, updateIntegrationConnection } from '@/lib/integrations/core/connections'
import { getIntegrationAdapter, getIntegrationProvider } from '@/lib/integrations/core/registry'
import { recordIntegrationAudit } from '@/lib/integrations/core/audit'
import { resolveIntegrationServerContext } from '@/lib/integrations/server-context'
import { requireMfaStepUp } from '@/lib/security/mfa'

export async function DELETE(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerKey } = await params
  const provider = getIntegrationProvider(providerKey)
  if (!provider) return NextResponse.json({ error: 'Integração desconhecida.' }, { status: 404 })

  const context = await resolveIntegrationServerContext()
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const decision = requireFeatureDecision(await canUseFeature({
    db: context.admin,
    access: context.access,
    actorCompanyId: context.companyId,
    company: context.company,
    permission: 'integrations.disconnect',
    featureFlag: provider.featureFlag,
  }))
  if (!decision.allowed) return NextResponse.json({ error: 'error' in decision ? decision.error : 'Sem acesso.' }, { status: 'status' in decision ? decision.status : 403 })

  const mfa = await requireMfaStepUp(context.userClient, 'integrations.credentials.manage')
  if (!mfa.allowed) return NextResponse.json({ error: mfa.error, reason: mfa.reason }, { status: mfa.status })

  const connection = await getCompanyIntegrationConnection(context.admin, context.companyId, provider.key)
  if (!connection) return NextResponse.json({ error: 'Conexão não encontrada.' }, { status: 404 })
  const adapter = getIntegrationAdapter(provider.key)
  if (adapter?.disconnect) {
    await adapter.disconnect({
      connection,
      requestId: crypto.randomUUID(),
      loadCredentials: async () => null,
      saveCredentials: async () => undefined,
      emitAudit: async () => undefined,
    })
  }

  await deleteIntegrationCredentials(context.admin, context.companyId, connection.id)
  await updateIntegrationConnection(context.admin, { companyId: context.companyId, provider: provider.key, patch: { status: 'DISCONNECTED', external_account_id: null, external_account_name: null, connected_at: null } })
  await recordIntegrationAudit(context.admin, { companyId: context.companyId, userId: context.userId, provider: provider.key, connectionId: connection.id, action: 'integration.disconnected' })
  return NextResponse.json({ ok: true })
}
