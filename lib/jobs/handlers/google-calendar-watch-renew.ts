import { JobNeedsAttentionError, isPlainRecord, isUuid, type JobPayloadResult } from '@/lib/jobs/core'
import type { JobHandler } from '@/lib/jobs/registry'
import { getCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { createIntegrationRuntimeContext } from '@/lib/integrations/runtime'
import { ensureGoogleCalendarWatch } from '@/lib/integrations/google/calendar'

type WatchRenewPayload = { connectionId: string }

function parsePayload(payload: unknown): JobPayloadResult<WatchRenewPayload> {
  if (!isPlainRecord(payload) || !isUuid(payload.connection_id)) return { ok: false, error: 'invalid_connection_id' }
  return { ok: true, value: { connectionId: payload.connection_id } }
}

export const googleCalendarWatchRenewJobHandler: JobHandler<WatchRenewPayload> = {
  type: 'google.calendar.watch.renew',
  validate: parsePayload,
  async execute(context, payload) {
    if (!context.job.companyId) throw new JobNeedsAttentionError('company_required')
    const connection = await getCompanyIntegrationConnection(context.db, context.job.companyId, 'google_calendar')
    if (!connection || connection.id !== payload.connectionId) throw new JobNeedsAttentionError('connection_not_found')
    if (!['CONNECTED','DEGRADED'].includes(connection.status)) throw new JobNeedsAttentionError('connection_not_connected')
    if (connection.config.push_enabled !== true) return { skipped: true, reason: 'push_disabled' }

    const runtime = createIntegrationRuntimeContext(context.db, {
      companyId: context.job.companyId,
      connection,
      requestId: context.job.id,
    })
    const watch = await ensureGoogleCalendarWatch(runtime)
    return { renewed: true, expires_at: watch.expiresAt }
  },
}
