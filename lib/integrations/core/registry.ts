import type { IntegrationAdapter, IntegrationProviderDefinition, IntegrationProviderKey } from '@/lib/integrations/core/types'

export const integrationProviders: IntegrationProviderDefinition[] = [
  { key: 'google_calendar', name: 'Google Calendar', description: 'Agenda, visitas, reuniões e compromissos operacionais.', category: 'google', capabilities: ['calendar.read', 'calendar.write'], featureFlag: 'integration_google_calendar', credentialStrategy: 'oauth', externalRequirement: 'Cliente OAuth Google configurado no servidor.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'beauty', 'barber', 'technical_assistance', 'auto', 'events'], readiness: { engineering: 'ENGINEERING_COMPLETE', validation: 'UNIT_VERIFIED' } },
  { key: 'resend', name: 'E-mail transacional', description: 'E-mails operacionais via Resend, domínio verificado e webhooks assinados.', category: 'communication', capabilities: ['email.send'], featureFlag: 'integration_resend', credentialStrategy: 'api_key', externalRequirement: 'API key Resend e domínio verificado.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [], readiness: { engineering: 'ENGINEERING_COMPLETE', validation: 'UNIT_VERIFIED' } },
  { key: 'google_maps', name: 'Google Maps', description: 'Validação assistida de endereço, distância e rotas para entrega e visita.', category: 'logistics', capabilities: ['maps.validate_address', 'maps.geocode', 'maps.routes', 'maps.distance'], featureFlag: 'integration_google_maps', credentialStrategy: 'api_key', externalRequirement: 'Billing e API key Google Maps restrita ao servidor.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['food', 'store', 'services', 'technical_assistance', 'auto'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'nfse', name: 'NFS-e', description: 'Emissão fiscal em rascunho, revisão humana e idempotência.', category: 'fiscal', capabilities: ['fiscal.issue', 'fiscal.cancel'], featureFlag: 'integration_nfse', credentialStrategy: 'provider', externalRequirement: 'Elegibilidade municipal/federal, certificado ou credencial do provedor.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'graphic', 'custom_products'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'google_business_profile', name: 'Google Business Profile', description: 'Perfil, locais e reputação somente quando a API e a conta forem elegíveis.', category: 'google', capabilities: ['business_profile.read', 'business_profile.manage'], featureFlag: 'integration_google_business', credentialStrategy: 'oauth', externalRequirement: 'Acesso à API Google Business Profile e perfil elegível.', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: ['beauty', 'barber', 'food', 'store', 'services'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'google_drive', name: 'Google Drive', description: 'Arquivos de clientes, pedidos e propostas com vínculo ao Orçaly.', category: 'documents', capabilities: ['files.read', 'files.write', 'files.upload', 'files.folder.manage'], featureFlag: 'integration_google_drive', credentialStrategy: 'oauth', externalRequirement: 'Cliente OAuth Google configurado no servidor.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['graphic', 'custom_products', 'services'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'google_sheets', name: 'Google Sheets', description: 'Exportações manuais e agendadas sem tornar planilha fonte de verdade.', category: 'google', capabilities: ['sheets.read', 'sheets.write'], featureFlag: 'integration_google_sheets', credentialStrategy: 'oauth', externalRequirement: 'Cliente OAuth Google configurado no servidor.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['food', 'store', 'services'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'meta_leads', name: 'Meta Leads', description: 'Importa leads por webhook oficial para o CRM, com deduplicação.', category: 'marketing', capabilities: ['leads.read'], featureFlag: 'integration_meta_leads', credentialStrategy: 'oauth', externalRequirement: 'App Meta aprovado e acesso à página/formulário.', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: [], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'clicksign', name: 'Clicksign', description: 'Assinatura eletrônica de propostas e documentos com webhook de status.', category: 'documents', capabilities: ['esign.create', 'esign.status'], featureFlag: 'integration_clicksign', credentialStrategy: 'api_key', externalRequirement: 'Credencial Clicksign de sandbox ou produção.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'events', 'technical_assistance'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'mercado_livre', name: 'Mercado Livre', description: 'Importa pedidos para o domínio canônico do Orçaly pela API oficial.', category: 'marketplaces', capabilities: ['orders.import', 'orders.export', 'marketplace.orders.read'], featureFlag: 'integration_mercado_livre', credentialStrategy: 'oauth', externalRequirement: 'Aplicação Mercado Livre aprovada.', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: ['store'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'shopee', name: 'Shopee', description: 'Adapter para a Open Platform, disponível após aprovação do app.', category: 'marketplaces', capabilities: ['orders.import', 'orders.export', 'marketplace.orders.read'], featureFlag: 'integration_shopee', credentialStrategy: 'provider', externalRequirement: 'Aplicação Shopee Open Platform aprovada.', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: ['store'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'bling', name: 'Bling', description: 'Conector ERP de clientes, produtos, pedidos e financeiro.', category: 'erp', capabilities: ['erp.customers.sync', 'erp.products.sync', 'erp.orders.sync', 'erp.financial.sync'], featureFlag: 'integration_erp_bling', credentialStrategy: 'oauth', externalRequirement: 'Aplicação Bling aprovada.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['store', 'graphic'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'omie', name: 'Omie', description: 'Conector ERP para dados permitidos pela API da Omie.', category: 'erp', capabilities: ['erp.customers.sync', 'erp.products.sync', 'erp.orders.sync', 'erp.financial.sync'], featureFlag: 'integration_erp_omie', credentialStrategy: 'api_key', externalRequirement: 'Credenciais da aplicação Omie.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services'], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'zapier', name: 'Zapier', description: 'Triggers e ações via a mesma API pública e Webhook Center do Orçaly.', category: 'automation', capabilities: ['automation.trigger', 'automation.action', 'webhooks.manage'], featureFlag: 'integration_zapier', credentialStrategy: 'api_key', externalRequirement: 'API key pública do Orçaly com escopos necessários.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'make', name: 'Make', description: 'Cenários via API pública, webhooks assinados e escopos por empresa.', category: 'automation', capabilities: ['automation.trigger', 'automation.action', 'webhooks.manage'], featureFlag: 'integration_make', credentialStrategy: 'api_key', externalRequirement: 'API key pública do Orçaly com escopos necessários.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [], readiness: { engineering: 'IN_PROGRESS', validation: null } },
  { key: 'n8n', name: 'n8n', description: 'Webhooks e API HTTP por empresa, sem engine paralela.', category: 'automation', capabilities: ['automation.trigger', 'automation.action', 'webhooks.manage'], featureFlag: 'integration_n8n', credentialStrategy: 'api_key', externalRequirement: 'API key pública do Orçaly com escopos necessários.', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [], readiness: { engineering: 'IN_PROGRESS', validation: null } },
]

const definitions = new Map(integrationProviders.map((provider) => [provider.key, provider]))
const adapters = new Map<IntegrationProviderKey, IntegrationAdapter>()

export function getIntegrationProvider(key: string) {
  return definitions.get(key as IntegrationProviderKey) || null
}

export function listIntegrationProviders() {
  return [...integrationProviders]
}

export function registerIntegrationAdapter(adapter: IntegrationAdapter) {
  const definition = definitions.get(adapter.key)
  if (!definition) throw new Error(`Provider não registrado: ${adapter.key}`)
  adapters.set(adapter.key, adapter)
  return adapter
}

export function getIntegrationAdapter(key: IntegrationProviderKey) {
  return adapters.get(key) || null
}

export function listRegisteredIntegrationAdapters() {
  return [...adapters.values()]
}
