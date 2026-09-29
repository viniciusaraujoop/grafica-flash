import type { SupabaseClient } from '@supabase/supabase-js'
import { redactIntegrationSecrets } from '@/lib/integrations/core/credentials'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

export async function recordIntegrationAudit(db: SupabaseClient, input: {
  companyId: string
  userId?: string | null
  provider: IntegrationProviderKey
  connectionId?: string | null
  action: string
  details?: Record<string, unknown>
}) {
  const { error } = await db.from('system_audit_logs').insert({
    company_id: input.companyId,
    user_id: input.userId || null,
    action: input.action,
    entity: 'integration',
    entity_id: input.connectionId || input.provider,
    details: redactIntegrationSecrets({ provider: input.provider, ...(input.details || {}) }),
  })
  if (error) throw error
}

export function integrationLog(input: {
  provider: IntegrationProviderKey
  operation: string
  requestId: string
  result: 'success' | 'failure'
  durationMs?: number
  errorCode?: string | null
}) {
  const payload = {
    event: 'integration_operation',
    provider: input.provider,
    operation: input.operation,
    request_id: input.requestId,
    result: input.result,
    duration_ms: input.durationMs ?? null,
    error_code: input.errorCode || null,
  }
  if (input.result === 'failure') console.warn(JSON.stringify(payload))
  else console.info(JSON.stringify(payload))
}
