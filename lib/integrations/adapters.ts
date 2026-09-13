import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'
import { googleCalendarAdapter, stopGoogleCalendarWatches } from '@/lib/integrations/google/calendar'
import { resendIntegrationAdapter } from '@/lib/integrations/email/resend'

let bootstrapped = false

const googleCalendarRegisteredAdapter = {
  ...googleCalendarAdapter,
  async disconnect(context: Parameters<typeof stopGoogleCalendarWatches>[0]) {
    await stopGoogleCalendarWatches(context)
  },
}

export function bootstrapIntegrationAdapters() {
  if (bootstrapped) return
  registerIntegrationAdapter(googleCalendarRegisteredAdapter)
  registerIntegrationAdapter(resendIntegrationAdapter)
  bootstrapped = true
}
