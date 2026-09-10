import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordIntegrationAudit } from '@/lib/integrations/core/audit'
import { loadIntegrationCredentials, storeIntegrationCredentials } from '@/lib/integrations/core/credentials'
import { updateIntegrationConnection } from '@/lib/integrations/core/connections'
import type { IntegrationConnection, IntegrationRuntimeContext, IntegrationStatus } from '@/lib/integrations/core/types'

export function createIntegrationRuntimeContext(db: SupabaseClient, input: {
  companyId: string
  connection: IntegrationConnection
  userId?: string | null
  requestId?: string
}): IntegrationRuntimeContext {
  return {
    connection: input.connection,
    requestId: input.requestId || randomUUID(),
    loadCredentials: () => loadIntegrationCredentials(db, input.companyId, input.connection.id),
    saveCredentials: async (credentials) => {
      await storeIntegrationCredentials(db, input.companyId, input.connection.id, credentials)
    },
    emitAudit: async (event, details) => {
      await recordIntegrationAudit(db, {
        companyId: input.companyId,
        userId: input.userId || null,
        provider: input.connection.provider,
        connectionId: input.connection.id,
        action: event,
        details,
      })
    },
    setConnectionStatus: async (status: IntegrationStatus, errorCode?: string | null) => {
      await updateIntegrationConnection(db, {
        companyId: input.companyId,
        provider: input.connection.provider,
        patch: {
          status,
          last_error_code: errorCode || null,
          last_error_at: errorCode ? new Date().toISOString() : null,
          last_success_at: status === 'CONNECTED' ? new Date().toISOString() : undefined,
        },
      })
    },
    acquireCredentialRefreshLock: async () => {
      const lockId = randomUUID()
      const { data, error } = await db.rpc('integration_refresh_lock', {
        p_company_id: input.companyId,
        p_connection_id: input.connection.id,
        p_lock_id: lockId,
        p_ttl_seconds: 45,
      })
      if (error) throw error
      return data === true ? lockId : null
    },
    releaseCredentialRefreshLock: async (lockId: string) => {
      const { error } = await db.rpc('integration_refresh_unlock', {
        p_company_id: input.companyId,
        p_connection_id: input.connection.id,
        p_lock_id: lockId,
      })
      if (error) throw error
    },
  }
}
