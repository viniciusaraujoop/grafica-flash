import type { IntegrationAdapter, IntegrationConnection, IntegrationHealth, IntegrationProviderDefinition } from '@/lib/integrations/core/types'

export function healthWithoutConnection(provider: IntegrationProviderDefinition): IntegrationHealth {
  return {
    status: provider.unavailableStatus,
    checkedAt: new Date().toISOString(),
    message: provider.unavailableStatus === 'ACCESS_REQUIRED'
      ? 'O provedor exige aprovação, conta elegível ou configuração externa antes da conexão.'
      : 'Integração ainda não configurada.',
    details: provider.externalRequirement ? { external_requirement: provider.externalRequirement } : undefined,
  }
}

export function healthFromConnection(connection: IntegrationConnection): IntegrationHealth {
  return {
    status: connection.status,
    checkedAt: new Date().toISOString(),
    message: connection.status === 'CONNECTED'
      ? 'Conexão ativa.'
      : connection.status === 'REAUTH_REQUIRED'
        ? 'Reconexão necessária.'
        : connection.status === 'DEGRADED'
          ? 'Conexão ativa com falhas recentes.'
          : connection.status === 'ERROR'
            ? 'A integração precisa de atenção.'
            : connection.status === 'DISCONNECTED'
              ? 'Integração desconectada.'
              : 'Configuração da integração em andamento.',
    details: connection.lastErrorCode ? { last_error_code: connection.lastErrorCode } : undefined,
  }
}

export async function resolveIntegrationHealth(input: {
  provider: IntegrationProviderDefinition
  connection: IntegrationConnection | null
  adapter?: IntegrationAdapter | null
  context?: Parameters<NonNullable<IntegrationAdapter['getHealth']>>[0]
}) {
  if (!input.connection) return healthWithoutConnection(input.provider)
  if (!input.adapter?.getHealth || !input.context) return healthFromConnection(input.connection)
  return input.adapter.getHealth(input.context)
}
