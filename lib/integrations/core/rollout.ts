import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegrationProviderDefinition } from '@/lib/integrations/core/types'

type FlagRow = { key: string; enabled: boolean; scope: 'global' | 'plan' | 'segment' | 'company'; scope_value: string; config?: Record<string, unknown> | null }
const priority = { global: 1, plan: 2, segment: 3, company: 4 }

export async function resolveIntegrationRollout(db: SupabaseClient, providers: IntegrationProviderDefinition[], context: {
  companyId: string
  segment?: string | null
  plan?: string | null
}) {
  const keys = providers.map((provider) => provider.featureFlag)
  const { data, error } = await db
    .from('platform_feature_flags')
    .select('key,enabled,scope,scope_value,config')
    .in('key', keys)
    .limit(Math.max(50, keys.length * 5))
  if (error) throw error

  const rows = (data || []) as FlagRow[]
  return new Map(providers.map((provider) => {
    const eligible = rows.filter((row) => {
      if (row.key !== provider.featureFlag) return false
      if (row.scope === 'global') return row.scope_value === '*'
      if (row.scope === 'company') return row.scope_value === context.companyId
      if (row.scope === 'segment') return Boolean(context.segment) && row.scope_value.toLowerCase() === String(context.segment).toLowerCase()
      if (row.scope === 'plan') return Boolean(context.plan) && row.scope_value.toLowerCase() === String(context.plan).toLowerCase()
      return false
    }).sort((a, b) => priority[b.scope] - priority[a.scope])
    const match = eligible[0]
    return [provider.key, {
      enabled: match?.enabled === true,
      scope: match?.scope || null,
      config: match?.config || null,
    }]
  }))
}
