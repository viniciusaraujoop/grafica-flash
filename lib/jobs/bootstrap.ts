import { registerJobHandler } from '@/lib/jobs/registry'
import { integrationSyncJobHandler } from '@/lib/jobs/handlers/integration-sync'
import { googleCalendarFullResyncJobHandler } from '@/lib/jobs/handlers/google-calendar-full-resync'
import { googleCalendarWatchRenewJobHandler } from '@/lib/jobs/handlers/google-calendar-watch-renew'
import { emailSendJobHandler } from '@/lib/jobs/handlers/email-send'

let bootstrapped = false

export function bootstrapJobHandlers() {
  if (bootstrapped) return
  registerJobHandler(integrationSyncJobHandler)
  registerJobHandler(googleCalendarFullResyncJobHandler)
  registerJobHandler(googleCalendarWatchRenewJobHandler)
  registerJobHandler(emailSendJobHandler)
  bootstrapped = true
}
