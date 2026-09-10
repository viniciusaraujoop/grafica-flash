import type { SupabaseClient } from '@supabase/supabase-js'
import { listCompanyIntegrationConnections } from '@/lib/integrations/core/connections'
import { healthFromConnection, healthWithoutConnection } from '@/lib/integrations/core/health'
import { listIntegrationProviders } from '@/lib/integrations/core/registry'
import { resolveIntegrationRollout } from '@/lib/integrations/core/rollout'

export async function getIntegrationHubState(db: SupabaseClient, company: Record<string, unknown>) {
  const companyId = String(company.id || '')
  const segment = String(company.segmento || company.business_type || '') || null
  const plan = String(company.assinatura_plano || company.plano || '') || null
  const providers = listIntegrationProviders()
  const [connections, rollout] = await Promise.all([
    listCompanyIntegrationConnections(db, companyId),
    resolveIntegrationRollout(db, providers, { companyId, segment, plan }),
  ])
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]))

  return providers.map((provider) => {
    const connection = byProvider.get(provider.key) || null
    const flag = rollout.get(provider.key) || { enabled: false, scope: null, config: null }
    return {
      provider,
      connection,
      health: connection ? healthFromConnection(connection) : healthWithoutConnection(provider),
      rolloutEnabled: flag.enabled,
      rolloutScope: flag.scope,
      recommended: provider.recommendedSegments.length === 0 || provider.recommendedSegments.includes(segment || ''),
    }
  })
}

export type IntegrationHubItem = Awaited<ReturnType<typeof getIntegrationHubState>>[number]
