import type { IntegrationAdapter, IntegrationProviderDefinition, IntegrationProviderKey } from '@/lib/integrations/core/types'

export const integrationProviders: IntegrationProviderDefinition[] = [
  { key: 'google_calendar', name: 'Google Calendar', description: 'Agenda, visitas, reuniões e compromissos operacionais.', category: 'google', capabilities: ['calendar.read', 'calendar.write'], featureFlag: 'integration_google_calendar', credentialStrategy: 'oauth', externalRequirement: 'Google OAuth client', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'beauty', 'barber', 'technical_assistance', 'auto', 'events'] },
  { key: 'google_drive', name: 'Google Drive', description: 'Arquivos de clientes, pedidos e propostas com vínculo ao Orçaly.', category: 'files', capabilities: ['files.read', 'files.write'], featureFlag: 'integration_google_drive', credentialStrategy: 'oauth', externalRequirement: 'Google OAuth client', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['graphic', 'custom_products', 'services'] },
  { key: 'google_sheets', name: 'Google Sheets', description: 'Exportações manuais e agendadas sem transformar planilha em fonte de verdade.', category: 'google', capabilities: ['sheets.read', 'sheets.write'], featureFlag: 'integration_google_sheets', credentialStrategy: 'oauth', externalRequirement: 'Google OAuth client', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['food', 'store', 'services'] },
  { key: 'gmail', name: 'Gmail', description: 'Relaciona conversas relevantes a clientes sem copiar a caixa de entrada inteira.', category: 'communication', capabilities: ['email.read', 'email.send'], featureFlag: 'integration_gmail', credentialStrategy: 'oauth', externalRequirement: 'Google OAuth client', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'technical_assistance', 'events'] },
  { key: 'google_business', name: 'Google Business Profile', description: 'Local, avaliações e reputação da empresa quando a API estiver liberada.', category: 'google', capabilities: ['business_profile.read', 'business_profile.manage'], featureFlag: 'integration_google_business', credentialStrategy: 'oauth', externalRequirement: 'Google Business Profile API access/quota', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: ['beauty', 'barber', 'food', 'store', 'services'] },
  { key: 'google_maps', name: 'Google Maps', description: 'Validação de endereço, distância e rotas para fluxos de entrega e visita.', category: 'logistics', capabilities: ['maps.validate_address', 'maps.routes'], featureFlag: 'integration_google_maps', credentialStrategy: 'api_key', externalRequirement: 'Google Maps billing/API key', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['food', 'store', 'services', 'technical_assistance', 'auto'] },
  { key: 'resend', name: 'E-mail transacional', description: 'E-mails operacionais via adapter, inicialmente com Resend.', category: 'communication', capabilities: ['email.send'], featureFlag: 'integration_resend', credentialStrategy: 'api_key', externalRequirement: 'Resend API key and verified domain', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'nfse_nacional', name: 'NFS-e', description: 'Emissão fiscal revisada por humano, com elegibilidade e idempotência.', category: 'fiscal', capabilities: ['fiscal.issue', 'fiscal.cancel'], featureFlag: 'integration_nfse', credentialStrategy: 'provider', externalRequirement: 'Municipal/federal eligibility, certificate or provider credentials', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'graphic', 'custom_products'] },
  { key: 'meta_leads', name: 'Meta Leads', description: 'Importa leads elegíveis via webhook oficial para o CRM.', category: 'sales', capabilities: ['leads.read'], featureFlag: 'integration_meta_leads', credentialStrategy: 'oauth', externalRequirement: 'Meta app approval and page access', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: [] },
  { key: 'clicksign', name: 'Clicksign', description: 'Assinatura eletrônica de propostas e documentos com webhook de status.', category: 'productivity', capabilities: ['esign.create', 'esign.status'], featureFlag: 'integration_clicksign', credentialStrategy: 'api_key', externalRequirement: 'Clicksign sandbox/production credential', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services', 'events', 'technical_assistance'] },
  { key: 'mercado_livre', name: 'Mercado Livre', description: 'Importa pedidos para o modelo canônico do Orçaly pela API oficial.', category: 'marketplaces', capabilities: ['orders.import', 'orders.export'], featureFlag: 'integration_mercado_livre', credentialStrategy: 'oauth', externalRequirement: 'Mercado Livre application', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['store'] },
  { key: 'shopee', name: 'Shopee', description: 'Adapter para Open Platform, habilitado apenas após aprovação do app.', category: 'marketplaces', capabilities: ['orders.import', 'orders.export'], featureFlag: 'integration_shopee', credentialStrategy: 'provider', externalRequirement: 'Shopee Open Platform app approval', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: ['store'] },
  { key: 'erp', name: 'ERP / Contabilidade', description: 'Framework canônico para clientes, produtos, pedidos, financeiro e estoque.', category: 'financial', capabilities: ['orders.import', 'orders.export', 'finance.import'], featureFlag: 'integration_erp', credentialStrategy: 'provider', externalRequirement: 'Selected ERP/provider credentials', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'bling', name: 'Bling', description: 'Conector ERP preparado sobre o contrato canônico do Orçaly.', category: 'financial', capabilities: ['orders.import', 'orders.export', 'finance.import'], featureFlag: 'integration_erp_bling', credentialStrategy: 'oauth', externalRequirement: 'Bling API application', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['store', 'graphic'] },
  { key: 'omie', name: 'Omie', description: 'Conector contábil/ERP preparado sobre o contrato canônico do Orçaly.', category: 'financial', capabilities: ['orders.import', 'orders.export', 'finance.import'], featureFlag: 'integration_erp_omie', credentialStrategy: 'api_key', externalRequirement: 'Omie application credentials', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: ['services'] },
  { key: 'zapier', name: 'Zapier', description: 'Triggers e actions através da API e Webhook Center do Orçaly.', category: 'automation', capabilities: ['automation.trigger'], featureFlag: 'integration_zapier', credentialStrategy: 'api_key', externalRequirement: 'Orçaly public API credential', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'make', name: 'Make', description: 'Cenários conectados por API, webhooks assinados e escopos por empresa.', category: 'automation', capabilities: ['automation.trigger'], featureFlag: 'integration_make', credentialStrategy: 'api_key', externalRequirement: 'Orçaly public API credential', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'n8n', name: 'n8n', description: 'Webhooks e HTTP API com credenciais company-scoped.', category: 'automation', capabilities: ['automation.trigger'], featureFlag: 'integration_n8n', credentialStrategy: 'api_key', externalRequirement: 'Orçaly public API credential', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'slack', name: 'Slack', description: 'Notificações configuráveis em workspace e canal autorizados.', category: 'communication', capabilities: ['automation.trigger'], featureFlag: 'integration_slack', credentialStrategy: 'oauth', externalRequirement: 'Slack application', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'microsoft_teams', name: 'Microsoft Teams', description: 'Notificações pelo mecanismo oficial autorizado, sem duplicar lógica do Slack.', category: 'communication', capabilities: ['automation.trigger'], featureFlag: 'integration_microsoft_teams', credentialStrategy: 'oauth', externalRequirement: 'Microsoft/Azure application', unavailableStatus: 'NOT_CONFIGURED', recommendedSegments: [] },
  { key: 'open_finance', name: 'Open Finance', description: 'Base para contas, saldos, transações e conciliação com consentimento regulado.', category: 'financial', capabilities: ['finance.import'], featureFlag: 'integration_open_finance', credentialStrategy: 'provider', externalRequirement: 'Regulated Open Finance provider and user consent', unavailableStatus: 'ACCESS_REQUIRED', recommendedSegments: [] },
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
