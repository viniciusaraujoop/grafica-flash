import type { SupabaseClient } from '@supabase/supabase-js'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import type { IntegrationCapability, IntegrationConnection, IntegrationProviderKey, IntegrationStatus } from '@/lib/integrations/core/types'

function mapConnection(row: Record<string, unknown>): IntegrationConnection {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    provider: String(row.provider) as IntegrationProviderKey,
    status: String(row.status || 'NOT_CONFIGURED') as IntegrationStatus,
    displayName: row.display_name ? String(row.display_name) : null,
    externalAccountId: row.external_account_id ? String(row.external_account_id) : null,
    externalAccountName: row.external_account_name ? String(row.external_account_name) : null,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) as IntegrationConnection['capabilities'] : [],
    config: row.config && typeof row.config === 'object' ? row.config as Record<string, unknown> : {},
    connectedBy: row.connected_by ? String(row.connected_by) : null,
    connectedAt: row.connected_at ? String(row.connected_at) : null,
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    lastErrorAt: row.last_error_at ? String(row.last_error_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listCompanyIntegrationConnections(db: SupabaseClient, companyId: string) {
  const { data, error } = await db.from('integration_connections').select('*').eq('company_id', companyId).order('provider')
  if (error) throw error
  return (data || []).map((row) => mapConnection(row as Record<string, unknown>))
}

export async function getCompanyIntegrationConnection(db: SupabaseClient, companyId: string, provider: IntegrationProviderKey) {
  const { data, error } = await db.from('integration_connections').select('*').eq('company_id', companyId).eq('provider', provider).maybeSingle()
  if (error) throw error
  return data ? mapConnection(data as Record<string, unknown>) : null
}

export async function ensureCompanyIntegrationConnection(db: SupabaseClient, companyId: string, provider: IntegrationProviderKey) {
  const current = await getCompanyIntegrationConnection(db, companyId, provider)
  if (current) return current
  const definition = getIntegrationProvider(provider)
  if (!definition) throw new Error('Provider de integração desconhecido.')
  const { data, error } = await db.from('integration_connections').insert({
    company_id: companyId,
    provider,
    status: definition.unavailableStatus,
    display_name: definition.name,
    capabilities: definition.capabilities,
  }).select('*').single()
  if (error) throw error
  return mapConnection(data as Record<string, unknown>)
}

export async function upsertCompanyIntegrationConnection(db: SupabaseClient, input: {
  companyId: string
  provider: IntegrationProviderKey
  status: IntegrationStatus
  displayName?: string | null
  externalAccountId?: string | null
  externalAccountName?: string | null
  capabilities?: IntegrationCapability[]
  connectedBy?: string | null
  connectedAt?: string | null
  lastSyncAt?: string | null
  lastSuccessAt?: string | null
  lastErrorCode?: string | null
  lastErrorAt?: string | null
  config?: Record<string, unknown>
}) {
  const definition = getIntegrationProvider(input.provider)
  if (!definition) throw new Error('Provider de integração desconhecido.')
  const row: Record<string, unknown> = {
    company_id: input.companyId,
    provider: input.provider,
    status: input.status,
    display_name: input.displayName === undefined ? definition.name : input.displayName,
    capabilities: input.capabilities === undefined ? definition.capabilities : input.capabilities,
    updated_at: new Date().toISOString(),
  }
  if (input.externalAccountId !== undefined) row.external_account_id = input.externalAccountId
  if (input.externalAccountName !== undefined) row.external_account_name = input.externalAccountName
  if (input.connectedBy !== undefined) row.connected_by = input.connectedBy
  if (input.connectedAt !== undefined) row.connected_at = input.connectedAt
  if (input.lastSyncAt !== undefined) row.last_sync_at = input.lastSyncAt
  if (input.lastSuccessAt !== undefined) row.last_success_at = input.lastSuccessAt
  if (input.lastErrorCode !== undefined) row.last_error_code = input.lastErrorCode
  if (input.lastErrorAt !== undefined) row.last_error_at = input.lastErrorAt
  if (input.config !== undefined) row.config = input.config

  const { data, error } = await db.from('integration_connections')
    .upsert(row, { onConflict: 'company_id,provider' })
    .select('*')
    .single()
  if (error) throw error
  return mapConnection(data as Record<string, unknown>)
}

export async function updateIntegrationConnection(db: SupabaseClient, input: {
  companyId: string
  provider: IntegrationProviderKey
  patch: Record<string, unknown>
}) {
  const clean: Record<string, unknown> = { ...input.patch, updated_at: new Date().toISOString() }
  delete clean.company_id
  delete clean.provider
  delete clean.credentials_reference
  const { data, error } = await db.from('integration_connections').update(clean).eq('company_id', input.companyId).eq('provider', input.provider).select('*').maybeSingle()
  if (error) throw error
  return data ? mapConnection(data as Record<string, unknown>) : null
}
