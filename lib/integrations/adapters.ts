import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'
import { googleCalendarAdapter } from '@/lib/integrations/google/calendar'

let bootstrapped = false

export function bootstrapIntegrationAdapters() {
  if (bootstrapped) return
  registerIntegrationAdapter(googleCalendarAdapter)
  bootstrapped = true
}
