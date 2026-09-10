import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntegrationSyncRequest } from '@/lib/integrations/core/types'

export async function enqueueIntegrationSync(db: SupabaseClient, input: {
  companyId: string
  connectionId: string
  provider: string
  requestedBy: string
  request?: IntegrationSyncRequest
}) {
  const payload = {
    connection_id: input.connectionId,
    provider: input.provider,
    requested_by: input.requestedBy,
    mode: input.request?.mode || 'incremental',
    cursor: input.request?.cursor || null,
    entity: input.request?.entity || null,
    metadata: input.request?.metadata || {},
  }

  const { data, error } = await db.from('background_jobs').insert({
    company_id: input.companyId,
    job_type: 'integration.sync',
    payload,
    status: 'queued',
    max_attempts: 5,
    metadata: { source: 'integration_platform' },
  }).select('id,status,created_at').single()

  if (!error) return { queued: true, job: data }
  if (error.code !== '23505') throw error

  const { data: existing, error: existingError } = await db
    .from('background_jobs')
    .select('id,status,created_at')
    .eq('company_id', input.companyId)
    .eq('job_type', 'integration.sync')
    .eq('payload->>connection_id', input.connectionId)
    .in('status', ['queued', 'running', 'retrying'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  return { queued: false, job: existing || null }
}
