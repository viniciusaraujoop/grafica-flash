import { NextResponse } from 'next/server'
import { canUseFeature, requireFeatureDecision } from '@/lib/access-control'
import { enqueueIntegrationSync } from '@/lib/integrations/core/sync'
import { getCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { normalizeIntegrationHttpStatus } from '@/lib/integrations/core/http'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import { resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export async function POST(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
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
    permission: 'integrations.sync',
    featureFlag: provider.featureFlag,
  }))
  if (!decision.allowed) {
    const status = normalizeIntegrationHttpStatus('status' in decision ? decision.status : undefined)
    return NextResponse.json({ error: 'error' in decision ? decision.error : 'Sem acesso.' }, { status })
  }

  const connection = await getCompanyIntegrationConnection(context.admin, context.companyId, provider.key)
  if (!connection || connection.status !== 'CONNECTED') return NextResponse.json({ error: 'A integração não está conectada.' }, { status: 409 })

  const queued = await enqueueIntegrationSync(context.admin, {
    companyId: context.companyId,
    connectionId: connection.id,
    provider: provider.key,
    requestedBy: context.userId,
    request: { mode: 'manual' },
  })
  return NextResponse.json(queued, { status: queued.queued ? 202 : 200 })
}
