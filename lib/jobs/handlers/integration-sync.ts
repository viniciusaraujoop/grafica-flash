import { resolvePlatformFeatureFlag } from '@/lib/admin/feature-flags'
import { JobNeedsAttentionError, parseIntegrationSyncPayload, type IntegrationSyncJobPayload } from '@/lib/jobs/core'
import type { JobExecutionContext, JobHandler } from '@/lib/jobs/registry'
import { getIntegrationAdapter, getIntegrationProvider, integrationProviders } from '@/lib/integrations/core/registry'
import { createIntegrationRuntimeContext } from '@/lib/integrations/runtime'
import { bootstrapIntegrationAdapters } from '@/lib/integrations/adapters'

const supportedProviders = integrationProviders.map((provider) => provider.key)

export const integrationSyncJobHandler: JobHandler<IntegrationSyncJobPayload> = {
  type: 'integration.sync',
  validate(payload) {
    return parseIntegrationSyncPayload(payload, supportedProviders)
  },
  async execute(context: JobExecutionContext, payload: IntegrationSyncJobPayload) {
    if (!context.job.companyId) throw new JobNeedsAttentionError('company_required')

    const { data: company, error: companyError } = await context.db
      .from('companies')
      .select('id,assinatura_plano,plano,segmento,business_type')
      .eq('id', context.job.companyId)
      .maybeSingle()
    if (companyError) throw companyError
    if (!company) throw new JobNeedsAttentionError('company_not_found')

    const provider = getIntegrationProvider(payload.provider)
    if (!provider) throw new JobNeedsAttentionError('provider_not_registered')

    const flag = await resolvePlatformFeatureFlag(context.db, provider.featureFlag, {
      companyId: context.job.companyId,
      segment: String(company.segmento || company.business_type || ''),
      plan: String(company.assinatura_plano || company.plano || ''),
    })
    if (!flag.schemaReady || !flag.enabled) throw new JobNeedsAttentionError('provider_disabled')

    const { data: row, error: connectionError } = await context.db
      .from('integration_connections')
      .select('*')
      .eq('id', payload.connectionId)
      .eq('company_id', context.job.companyId)
      .eq('provider', provider.key)
      .maybeSingle()
    if (connectionError) throw connectionError
    if (!row) throw new JobNeedsAttentionError('connection_not_found')

    const status = String(row.status || '')
    if (status !== 'CONNECTED' && status !== 'DEGRADED') throw new JobNeedsAttentionError('connection_not_connected')

    bootstrapIntegrationAdapters()
    const adapter = getIntegrationAdapter(provider.key)
    if (!adapter?.sync) throw new JobNeedsAttentionError('sync_handler_unavailable')

    const connection = {
      id: String(row.id),
      companyId: String(row.company_id),
      provider: provider.key,
      status: row.status,
      displayName: row.display_name || null,
      externalAccountId: row.external_account_id || null,
      externalAccountName: row.external_account_name || null,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      config: row.config && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {},
      connectedBy: row.connected_by || null,
      connectedAt: row.connected_at || null,
      lastSyncAt: row.last_sync_at || null,
      lastSuccessAt: row.last_success_at || null,
      lastErrorCode: row.last_error_code || null,
      lastErrorAt: row.last_error_at || null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }

    const runtime = createIntegrationRuntimeContext(context.db, {
      companyId: context.job.companyId,
      connection,
      userId: payload.requestedBy,
      requestId: context.job.id,
    })

    const startedAt = new Date().toISOString()
    await context.db.from('integration_connections').update({ last_sync_at: startedAt, updated_at: startedAt }).eq('id', connection.id).eq('company_id', context.job.companyId)

    const result = await adapter.sync(runtime, {
      mode: payload.mode,
      cursor: payload.cursor,
      entity: payload.entity,
      metadata: payload.metadata,
    })

    const completedAt = new Date().toISOString()
    await context.db.from('integration_connections').update({
      status: result.status === 'COMPLETED' ? 'CONNECTED' : connection.status,
      last_success_at: result.status === 'COMPLETED' ? completedAt : connection.lastSuccessAt,
      last_error_code: null,
      last_error_at: null,
      updated_at: completedAt,
    }).eq('id', connection.id).eq('company_id', context.job.companyId)

    await runtime.emitAudit('integration.sync_completed', {
      status: result.status,
      imported: result.imported || 0,
      exported: result.exported || 0,
      skipped: result.skipped || 0,
    })

    return {
      provider: provider.key,
      sync_status: result.status,
      imported: result.imported || 0,
      exported: result.exported || 0,
      skipped: result.skipped || 0,
    }
  },
}
