import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'
import { googleCalendarAdapter, stopGoogleCalendarWatches } from '@/lib/integrations/google/calendar'

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
  bootstrapped = true
}
