import { IntegrationError } from '@/lib/integrations/core/errors'
import { getIntegrationProvider } from '@/lib/integrations/core/registry'
import type { IntegrationAdapter, IntegrationHealth, IntegrationProviderKey, IntegrationRuntimeContext } from '@/lib/integrations/core/types'
import { getProviderConfigurationSpec } from '@/lib/integrations/provider-configuration'

export function createConfigurationAdapter(key: IntegrationProviderKey): IntegrationAdapter {
  const resolvedDefinition = getIntegrationProvider(key)
  if (!resolvedDefinition) throw new Error(`Provider não registrado: ${key}`)
  const definition = resolvedDefinition

  async function getHealth(context: IntegrationRuntimeContext): Promise<IntegrationHealth> {
    const credentials = await context.loadCredentials()
    if (definition.unavailableStatus === 'ACCESS_REQUIRED') {
      return {
        status: 'ACCESS_REQUIRED',
        checkedAt: new Date().toISOString(),
        message: 'Este provider exige aprovação, conta elegível ou OAuth externo antes da ativação.',
      }
    }
    const spec = getProviderConfigurationSpec(key)
    const missing = spec.credentialKeys.filter((credentialKey) => typeof credentials?.[credentialKey] !== 'string' || !credentials[credentialKey].trim())
    if (missing.length) {
      return {
        status: 'NOT_CONFIGURED',
        checkedAt: new Date().toISOString(),
        message: 'Credenciais do provider ainda não foram configuradas no cofre do servidor.',
      }
    }
    return {
      status: 'DEGRADED',
      checkedAt: new Date().toISOString(),
      message: 'Credenciais armazenadas; a operação só será ativada após validação real com o provider.',
    }
  }

  return {
    key,
    name: definition.name,
    getCapabilities: () => [...definition.capabilities],
    getHealth,
    async sync() {
      throw new IntegrationError('UNSUPPORTED', 'A sincronização deste provider ainda não foi ativada. Nenhum dado externo foi alterado.')
    },
    async disconnect(context) {
      await context.emitAudit('integration.provider_disconnected', { provider: key })
    },
  }
}
