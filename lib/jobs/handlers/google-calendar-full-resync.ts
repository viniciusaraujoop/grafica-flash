import { parseIntegrationSyncPayload, type IntegrationSyncJobPayload } from '@/lib/jobs/core'
import type { JobHandler } from '@/lib/jobs/registry'
import { integrationSyncJobHandler } from '@/lib/jobs/handlers/integration-sync'

export const googleCalendarFullResyncJobHandler: JobHandler<IntegrationSyncJobPayload> = {
  type: 'google.calendar.full_resync',
  validate(payload) {
    return parseIntegrationSyncPayload(payload, ['google_calendar'])
  },
  async execute(context, payload) {
    return integrationSyncJobHandler.execute(context, { ...payload, provider: 'google_calendar', mode: 'full', cursor: null })
  },
}
