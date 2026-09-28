// Wave 1 pack — food.restaurant. Content source: lib/business-types.ts#food defaults and the
// food modules in lib/segment-modules.ts (frozen at v1.0.0). There is no legacy niche for food.

import type { IndustryPackDefinition } from '../core/types'
import { categories, dashboards, moduleItem, onboarding, recipe, setting, statusFlow } from './builders'

export const foodRestaurantPack: IndustryPackDefinition = {
  schemaVersion: 1,
  key: 'food.restaurant',
  version: '1.0.0',
  status: 'published',
  businessType: 'food',
  subsegments: ['Restaurante', 'Lanchonete', 'Pizzaria', 'Delivery'],
  name: 'Restaurante e delivery',
  description: 'Cardápio, pedidos do dia, preparo, retirada e entrega com taxas por região.',
  capabilities: ['cap.menu_daily_orders', 'cap.delivery', 'cap.pickup', 'cap.catalog_sales'],
  items: [
    moduleItem('pedidos_dia', 'required', 1),
    moduleItem('cardapio', 'required', 2),
    moduleItem('entregas', 'default', 3),
    moduleItem('taxas_entrega', 'default', 4),
    moduleItem('horarios', 'default', 5),
    moduleItem('formas_pagamento', 'default', 6),
    moduleItem('adicionais', 'optional', 7),
    ...statusFlow('order', [
      { label: 'Recebido', semantic: 'new' },
      { label: 'Em preparo', semantic: 'in_progress' },
      { label: 'Pronto para retirada', semantic: 'ready' },
      { label: 'Saiu para entrega', semantic: 'in_progress' },
      { label: 'Entregue', semantic: 'delivered', terminal: true },
      { label: 'Cancelado', semantic: 'cancelled', terminal: true },
    ]),
    ...categories(['Lanches', 'Pizzas', 'Bebidas', 'Sobremesas', 'Combos']),
    ...dashboards(['pedidosHoje', 'emPreparo', 'saiuEntrega', 'faturamentoHoje', 'clientesTotal', 'produtosAtivos']),
    recipe('order_delayed_internal_task@1.0.0', 'recommended'),
    ...onboarding([
      { stepKey: 'add_menu', label: 'Monte seu cardápio', signal: 'products.count_gte_1' },
      { stepKey: 'delivery_zones', label: 'Configure regiões e taxas de entrega', signal: 'delivery_zones.count_gte_1' },
      { stepKey: 'business_hours', label: 'Defina seus horários de funcionamento', signal: 'business_hours.configured' },
    ]),
    setting('delivery.enabled', true),
  ],
  minimumRequirements: { plan: 'basic', features: ['pedidos', 'produtos'], modules: ['pedidos_dia'] },
  changelog: [
    {
      version: '1.0.0',
      date: '2026-09-28',
      kind: 'major',
      summary: 'Versão inicial a partir dos defaults do segmento food.',
      changes: [],
    },
  ],
}
