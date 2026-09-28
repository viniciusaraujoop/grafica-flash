// Wave 1 pack — store.local_store. Content source: lib/orcaly-nichos.ts#loja_local (frozen at
// v1.0.0). "Varejo" is a presentation label only; the canonical BusinessType is `store`.

import type { IndustryPackDefinition } from '../core/types'
import {
  categories,
  dashboards,
  integration,
  moduleItem,
  onboarding,
  proposalTemplate,
  readyMessages,
  recipe,
  setting,
  statusFlow,
} from './builders'

export const storeLocalStorePack: IndustryPackDefinition = {
  schemaVersion: 1,
  key: 'store.local_store',
  version: '1.0.0',
  status: 'published',
  businessType: 'store',
  subsegments: ['Loja local', 'Varejo', 'Pet shop', 'Moda'],
  name: 'Loja local',
  description: 'Catálogo, pedidos, separação, retirada, entrega local e promoções.',
  capabilities: ['cap.catalog_sales', 'cap.stock', 'cap.delivery', 'cap.pickup', 'cap.marketplace_channel'],
  items: [
    moduleItem('pedidos', 'required', 1),
    moduleItem('produtos', 'required', 2),
    moduleItem('catalogo', 'default', 3),
    moduleItem('entregas', 'default', 4),
    moduleItem('taxas_entrega', 'default', 5),
    moduleItem('cupons', 'default', 6, ['cupons']),
    moduleItem('estoque_simples', 'optional', 7),
    ...statusFlow('order', [
      { label: 'Recebido', semantic: 'new' },
      { label: 'Separando pedido', semantic: 'in_progress' },
      { label: 'Aguardando pagamento', semantic: 'waiting_payment' },
      { label: 'Aguardando retirada', semantic: 'ready' },
      { label: 'Saiu para entrega', semantic: 'in_progress' },
      { label: 'Entregue', semantic: 'delivered', terminal: true },
    ]),
    ...categories(['Produtos em estoque', 'Promoções', 'Kits', 'Encomendas', 'Entrega local']),
    ...dashboards(['pedidosTotal', 'pedidosPendentes', 'produtosAtivos', 'clientesTotal', 'faturamentoEstimado']),
    recipe('order_delayed_internal_task@1.0.0', 'recommended'),
    recipe('stock_critical_alert@1.0.0', 'optional'),
    integration('mercado_livre', ['orders.import', 'orders.export']),
    proposalTemplate(
      {
        titulo: 'Pedido em loja local',
        introducao: 'Segue resumo do pedido com produtos, valores e condições.',
        condicoes: 'Separação após confirmação do pedido e pagamento, quando aplicável.',
        prazoPadrao: 'Mesmo dia ou próximo dia útil.',
        validadeHoras: 24,
      },
      ['propostas'],
    ),
    ...readyMessages([
      'Recebemos seu pedido.',
      'Estamos separando seus produtos.',
      'Seu pedido saiu para entrega.',
      'Pedido entregue.',
    ]),
    ...onboarding([
      { stepKey: 'add_products', label: 'Cadastre seus produtos', signal: 'products.count_gte_1' },
      { stepKey: 'delivery_zones', label: 'Configure entrega local', signal: 'delivery_zones.count_gte_1' },
      { stepKey: 'publish_store', label: 'Publique sua vitrine', signal: 'site.published' },
    ]),
    setting('orders.questions', [
      'Qual produto deseja?',
      'Quantidade?',
      'Vai retirar ou entrega?',
      'Qual bairro?',
      'Forma de pagamento?',
    ]),
    setting('orders.recommendedFields', ['produto', 'quantidade', 'retirada_entrega', 'bairro', 'pagamento']),
    setting('proposals.defaultValidityHours', 24),
    setting('delivery.enabled', true),
  ],
  minimumRequirements: { plan: 'basic', features: ['pedidos', 'produtos'], modules: ['pedidos'] },
  legacy: { nichoIds: ['loja_local'] },
  changelog: [
    {
      version: '1.0.0',
      date: '2026-09-28',
      kind: 'major',
      summary: 'Versão inicial a partir do nicho legado loja_local.',
      changes: [],
    },
  ],
}
