import { resolvePlatformFeatureFlag } from '@/lib/admin/feature-flags'
import type { CompanyPermission } from '@/lib/access-control-core'
import { IntegrationError } from '@/lib/integrations/core/errors'
import { getCompanyIntegrationConnection } from '@/lib/integrations/core/connections'
import { createIntegrationRuntimeContext } from '@/lib/integrations/runtime'
import { integrationPermissionAllowed, resolveIntegrationServerContext } from '@/lib/integrations/server-context'

export async function resolveGoogleCalendarContext(permission: CompanyPermission, options: { requireConnected?: boolean } = {}) {
  const server = await resolveIntegrationServerContext()
  if (!server) throw new IntegrationError('AUTH_REQUIRED', 'Não autenticado.', { status: 401 })
  if (!integrationPermissionAllowed(server, permission)) throw new IntegrationError('ACCESS_APPROVAL_REQUIRED', 'Sem permissão para esta ação.', { status: 403 })

  const flag = await resolvePlatformFeatureFlag(server.admin, 'integration_google_calendar', {
    companyId: server.companyId,
    segment: String(server.company.segmento || server.company.business_type || ''),
    plan: String(server.company.assinatura_plano || server.company.plano || ''),
  })
  if (!flag.schemaReady || !flag.enabled) throw new IntegrationError('ACCESS_APPROVAL_REQUIRED', 'Google Calendar não está liberado para esta empresa.', { status: 403 })

  const connection = await getCompanyIntegrationConnection(server.admin, server.companyId, 'google_calendar')
  if (options.requireConnected !== false && (!connection || !['CONNECTED','DEGRADED'].includes(connection.status))) {
    throw new IntegrationError('AUTH_REQUIRED', 'Google Calendar não está conectado.', { status: 409 })
  }
  const runtime = connection ? createIntegrationRuntimeContext(server.admin, {
    companyId: server.companyId,
    connection,
    userId: server.userId,
  }) : null
  return { ...server, connection, runtime }
}

export function googleCalendarRouteError(error: unknown) {
  if (error instanceof IntegrationError) {
    const status = error.status || (error.code === 'AUTH_REQUIRED' ? 401 : error.code === 'ACCESS_APPROVAL_REQUIRED' ? 403 : error.code === 'CONFLICT' ? 409 : error.code === 'NOT_CONFIGURED' ? 409 : error.code === 'RATE_LIMITED' ? 429 : error.code === 'PROVIDER_DOWN' ? 503 : 400)
    return { status, body: { error: error.message, code: error.code, retryable: error.retryable } }
  }
  return { status: 500, body: { error: error instanceof Error ? error.message : 'Falha interna no Google Calendar.', code: 'INTERNAL', retryable: false } }
}
