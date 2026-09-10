import type { SupabaseClient } from '@supabase/supabase-js'

export type IntegrationCredentialBundle = Record<string, unknown>

function assertServerOnly() {
  if (typeof window !== 'undefined') throw new Error('Credenciais de integração são server-only.')
}

export async function storeIntegrationCredentials(db: SupabaseClient, connectionId: string, credentials: IntegrationCredentialBundle) {
  assertServerOnly()
  const serialized = JSON.stringify(credentials)
  const { error } = await db.rpc('integration_credentials_store', {
    p_connection_id: connectionId,
    p_secret: serialized,
  })
  if (error) throw error
}

export async function loadIntegrationCredentials(db: SupabaseClient, connectionId: string): Promise<IntegrationCredentialBundle | null> {
  assertServerOnly()
  const { data, error } = await db.rpc('integration_credentials_read', { p_connection_id: connectionId })
  if (error) throw error
  if (!data) return null
  if (typeof data === 'object') return data as IntegrationCredentialBundle
  try { return JSON.parse(String(data)) as IntegrationCredentialBundle } catch { return null }
}

export async function deleteIntegrationCredentials(db: SupabaseClient, connectionId: string) {
  assertServerOnly()
  const { error } = await db.rpc('integration_credentials_delete', { p_connection_id: connectionId })
  if (error) throw error
}

const secretKey = /(?:access[_-]?token|refresh[_-]?token|authorization|client[_-]?secret|api[_-]?key|password|secret)/i

export function redactIntegrationSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactIntegrationSecrets)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, secretKey.test(key) ? '[REDACTED]' : redactIntegrationSecrets(child)]))
}
