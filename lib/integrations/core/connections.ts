import type { SupabaseClient } from '@supabase/supabase-js'
import { redactIntegrationSecrets } from '@/lib/integrations/core/credentials'
import type { IntegrationConnection, IntegrationProviderKey, IntegrationStatus } from '@/lib/integrations/core/types'

type ConnectionRow = {
  id: string
  company_id: string
  provider: string
  status: string
  display_name: string | null
  external_account_id: string | null
  external_account_name: string | null
  capabilities: string[] | null
  config: Record<string, unknown> | null
  connected_by: string | null
  connected_at: string | null
  last_sync_at: string | null
  last_success_at: string | null
  last_error_code: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
}

const SAFE_CONNECTION_COLUMNS = 'id,company_id,provider,status,display_name,external_account_id,external_account_name,capabilities,config,connected_by,connected_at,last_sync_at,last_success_at,last_error_code,last_error_at,created_at,updated_at'

export function toIntegrationConnection(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider as IntegrationProviderKey,
    status: row.status as IntegrationStatus,
    displayName: row.display_name,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    capabilities: (row.capabilities || []) as IntegrationConnection['capabilities'],
    config: (redactIntegrationSecrets(row.config || {}) || {}) as Record<string, unknown>,
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    lastSuccessAt: row.last_success_at,
    lastErrorCode: row.last_error_code,
    lastErrorAt: row.last_error_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCompanyIntegrationConnections(db: SupabaseClient, companyId: string) {
  const { data, error } = await db
    .from('integration_connections')
    .select(SAFE_CONNECTION_COLUMNS)
    .eq('company_id', companyId)
    .order('provider')
  if (error) throw error
  return ((data || []) as unknown as ConnectionRow[]).map(toIntegrationConnection)
}

export async function getCompanyIntegrationConnection(db: SupabaseClient, companyId: string, provider: IntegrationProviderKey) {
  const { data, error } = await db
    .from('integration_connections')
    .select(SAFE_CONNECTION_COLUMNS)
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw error
  return data ? toIntegrationConnection(data as unknown as ConnectionRow) : null
}

export async function ensureIntegrationConnection(db: SupabaseClient, input: {
  companyId: string
  provider: IntegrationProviderKey
  status?: IntegrationStatus
  displayName?: string | null
  capabilities?: string[]
  config?: Record<string, unknown>
  connectedBy?: string | null
}) {
  const { data, error } = await db
    .from('integration_connections')
    .upsert({
      company_id: input.companyId,
      provider: input.provider,
      status: input.status || 'NOT_CONFIGURED',
      display_name: input.displayName || null,
      capabilities: input.capabilities || [],
      config: input.config || {},
      connected_by: input.connectedBy || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,provider' })
    .select(SAFE_CONNECTION_COLUMNS)
    .single()
  if (error) throw error
  return toIntegrationConnection(data as unknown as ConnectionRow)
}

export async function updateIntegrationConnection(db: SupabaseClient, input: {
  companyId: string
  provider: IntegrationProviderKey
  patch: Record<string, unknown>
}) {
  const forbidden = new Set(['id', 'company_id', 'provider', 'credentials_reference', 'created_at'])
  const patch = Object.fromEntries(Object.entries(input.patch).filter(([key]) => !forbidden.has(key)))
  const { data, error } = await db
    .from('integration_connections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('company_id', input.companyId)
    .eq('provider', input.provider)
    .select(SAFE_CONNECTION_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return data ? toIntegrationConnection(data as unknown as ConnectionRow) : null
}
