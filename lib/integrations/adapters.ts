import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'
import { googleCalendarAdapter, stopGoogleCalendarWatches } from '@/lib/integrations/google/calendar'
import { resendIntegrationAdapter } from '@/lib/integrations/email/resend'
import { createConfigurationAdapter } from '@/lib/integrations/configuration-adapter'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

let bootstrapped = false

const googleCalendarRegisteredAdapter = {
  ...googleCalendarAdapter,
  async disconnect(context: Parameters<typeof stopGoogleCalendarWatches>[0]) {
    await stopGoogleCalendarWatches(context)
  },
}

const configurationOnlyProviders: IntegrationProviderKey[] = [
  'google_maps',
  'nfse',
  'google_business_profile',
  'google_drive',
  'google_sheets',
  'meta_leads',
  'clicksign',
  'mercado_livre',
  'shopee',
  'bling',
  'omie',
  'zapier',
  'make',
  'n8n',
]

export function bootstrapIntegrationAdapters() {
  if (bootstrapped) return
  registerIntegrationAdapter(googleCalendarRegisteredAdapter)
  registerIntegrationAdapter(resendIntegrationAdapter)
  configurationOnlyProviders.forEach((provider) => registerIntegrationAdapter(createConfigurationAdapter(provider)))
  bootstrapped = true
}
