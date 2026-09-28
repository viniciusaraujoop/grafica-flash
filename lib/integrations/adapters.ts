import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'
import { googleCalendarAdapter, stopGoogleCalendarWatches } from '@/lib/integrations/google/calendar'
import { revokeGoogleCredential } from '@/lib/integrations/google/oauth'
import { normalizeIntegrationError } from '@/lib/integrations/core/errors'
import { resendIntegrationAdapter } from '@/lib/integrations/email/resend'
import { createConfigurationAdapter } from '@/lib/integrations/configuration-adapter'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

let bootstrapped = false

const googleCalendarRegisteredAdapter = {
  ...googleCalendarAdapter,
  async disconnect(context: Parameters<typeof stopGoogleCalendarWatches>[0]) {
    await stopGoogleCalendarWatches(context)
    const credentials = await context.loadCredentials()
    if (!credentials) return

    try {
      const result = await revokeGoogleCredential(credentials)
      await context.emitAudit('integration.provider_revoke_succeeded', {
        provider: 'google',
        revoked: result.revoked,
        skipped: result.skipped,
      }).catch(() => undefined)
    } catch (error) {
      const normalized = normalizeIntegrationError(error)
      try {
        await context.setConnectionStatus?.('ERROR', 'google_revoke_failed')
      } catch {
        // Provider revoke failure remains authoritative; status telemetry is best-effort.
      }
      try {
        await context.emitAudit('integration.provider_revoke_failed', {
          provider: 'google',
          code: normalized.code,
        })
      } catch {
        // Never destroy the recoverable provider credential because audit persistence failed.
      }
      throw normalized
    }
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
