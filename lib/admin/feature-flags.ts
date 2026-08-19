import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingRelation } from '@/lib/admin/optional-schema'

type Context = { companyId?: string | null; segment?: string | null; plan?: string | null }
type FlagRow = { key: string; enabled: boolean; scope: 'global' | 'plan' | 'segment' | 'company'; scope_value: string; config?: Record<string, unknown> | null }

const priority = { global: 1, plan: 2, segment: 3, company: 4 }

export async function resolvePlatformFeatureFlag(db: SupabaseClient, key: string, context: Context = {}) {
  const { data, error } = await db.from('platform_feature_flags').select('key,enabled,scope,scope_value,config').eq('key', key).limit(50)
  if (error) {
    if (isMissingRelation(error, 'platform_feature_flags')) return { schemaReady: false, enabled: false, config: null, matchedScope: null }
    throw error
  }
  const rows = (data || []) as FlagRow[]
  const eligible = rows.filter((row) => {
    if (row.scope === 'global') return row.scope_value === '*'
    if (row.scope === 'company') return Boolean(context.companyId) && row.scope_value === context.companyId
    if (row.scope === 'segment') return Boolean(context.segment) && row.scope_value.toLowerCase() === String(context.segment).toLowerCase()
    if (row.scope === 'plan') return Boolean(context.plan) && row.scope_value.toLowerCase() === String(context.plan).toLowerCase()
    return false
  }).sort((a, b) => priority[b.scope] - priority[a.scope])
  const match = eligible[0]
  return { schemaReady: true, enabled: match?.enabled === true, config: match?.config || null, matchedScope: match?.scope || null }
}
