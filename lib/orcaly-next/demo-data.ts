/**
 * Orçaly Next — DEMONSTRATION DATA ONLY.
 *
 * Every export here is synthetic, carries `isDemo: true`, and must be rendered
 * with <DemoBanner />. Nothing here is read from a database or represents a real
 * account, customer, amount or activity. Statuses are derived with the real
 * deriveHubStatus() from realistic inputs, so the demo cannot show an unreleased
 * product as openable.
 */

import type { ActivityItem, HubProductSnapshot, PulseItem } from './hub-model'
import type { HubStatus, HubStatusInput } from './product-status'
import { deriveHubStatus, HUB_STATUSES } from './product-status'
import type { RegistryProductId } from './product-registry'
import { productRegistry } from './product-registry'

export const DEMO_LABEL = 'Dados de demonstração — não representam nenhuma conta real.'

const demoAccount: Partial<Record<RegistryProductId, HubStatusInput['account']>> = {
  business: 'ENTITLED',
  wealth: 'TRIAL',
  partners: 'LAPSED',
}

export const demoSnapshots: readonly HubProductSnapshot[] = productRegistry
  .filter((product) => product.kind === 'app')
  .map((product) => ({
    productId: product.id,
    status: deriveHubStatus({ release: product.release, account: demoAccount[product.id] ?? 'NONE', externalBlocked: false }),
    continueItem:
      product.id === 'business' ? { label: 'Pedidos', href: '/painel/pedidos', at: '2026-09-27T09:10:00-03:00' }
        : product.id === 'wealth' ? { label: 'Calendário de contas', href: '/apps/wealth/calendario', at: '2026-09-26T21:40:00-03:00' }
          : null,
  }))

export const demoPulse: readonly PulseItem[] = [
  { id: 'demo-pulse-1', productId: 'business', title: 'Exemplo: pedidos aguardando aprovação de arte', detail: 'Item ilustrativo do Operating Brief.', source: 'Business · Pedidos · hoje (demonstração)', href: '/painel/pedidos' },
  { id: 'demo-pulse-2', productId: 'wealth', title: 'Exemplo: conta com vencimento amanhã', detail: 'Item ilustrativo do briefing Morning.', source: 'Wealth · Calendário · próximos 7 dias (demonstração)', href: '/apps/wealth/calendario' },
]

export const demoActivity: readonly ActivityItem[] = [
  { id: 'demo-act-1', productId: 'business', label: 'Exemplo: proposta enviada', at: '2026-09-27T08:55:00-03:00' },
  { id: 'demo-act-2', productId: 'wealth', label: 'Exemplo: meta atualizada', at: '2026-09-26T21:32:00-03:00' },
]

/**
 * Status gallery for visual QA: one synthetic tile per Hub status.
 * Uses generic names ("Exemplo A…H") so no real product is shown in a state it is not in.
 */
export const demoStatusGallery: ReadonlyArray<{ id: string; name: string; status: HubStatus }> = HUB_STATUSES.map((status, index) => ({
  id: `demo-${index}`,
  name: `Exemplo ${String.fromCharCode(65 + index)}`,
  status,
}))

export const isDemo = true as const
