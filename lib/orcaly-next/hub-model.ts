/**
 * Orçaly Next — Hub 2.0 read model (isolated).
 *
 * The Hub never queries product tables directly (today app/apps/page.tsx reads
 * `companies` and `affiliate_profiles`). Each product will publish a small,
 * already-authorized snapshot; the Hub only arranges them.
 */

import type { HubStatus } from './product-status'
import type { ProductRegistryEntry, RegistryProductId } from './product-registry'
import { operationalProducts, resolveProductDestination, type Destination } from './product-registry'

export type HubProductSnapshot = {
  productId: RegistryProductId
  status: HubStatus
  /** Where the user stopped. Must be a route inside the product the user can open. */
  continueItem?: { label: string; href: string; at: string } | null
}

export type PulseItem = {
  id: string
  productId: RegistryProductId
  title: string
  detail: string
  /** Mandatory provenance: which product/module produced it and for what period. */
  source: string
  href: string | null
}

export type ActivityItem = { id: string; productId: RegistryProductId; label: string; at: string }

export type HubTile = {
  product: ProductRegistryEntry
  status: HubStatus
  destination: Destination
}

export type HubSections = {
  yourApps: HubTile[]
  continueItems: Array<{ productId: RegistryProductId; label: string; href: string; at: string }>
  otherProducts: HubTile[]
  one: ProductRegistryEntry | null
}

/** `/apps/wealth/metas` → `/apps/wealth`; legacy `/painel/inicio` → `/painel`. */
export function productRoot(appPath: string): string {
  const segments = appPath.split('/').filter(Boolean)
  if (!segments.length) return ''
  return segments[0] === 'apps' && segments[1] ? `/apps/${segments[1]}` : `/${segments[0]}`
}

/** Statuses meaning "you have a relationship with this product" → Seus Apps. */
export const RELATIONSHIP_STATUSES: readonly HubStatus[] = ['ACTIVE', 'TRIAL', 'PAYMENT_PENDING', 'SUSPENDED', 'BLOCKED_EXTERNAL']

export function buildHubSections(
  registry: readonly ProductRegistryEntry[],
  snapshots: readonly HubProductSnapshot[],
): HubSections {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.productId, snapshot]))
  const tiles: HubTile[] = operationalProducts(registry).map((product) => {
    const status = byId.get(product.id)?.status ?? 'COMING_SOON'
    return { product, status, destination: resolveProductDestination(product, status) }
  })
  const continueItems = tiles
    .filter((tile) => tile.destination.kind === 'app')
    .flatMap((tile) => {
      const item = byId.get(tile.product.id)?.continueItem
      const appRoot = productRoot(tile.product.app?.path ?? '')
      // Only resume inside the product the user can open.
      return item && appRoot && (item.href === appRoot || item.href.startsWith(`${appRoot}/`)) ? [{ productId: tile.product.id, ...item }] : []
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return {
    yourApps: tiles.filter((tile) => RELATIONSHIP_STATUSES.includes(tile.status)),
    continueItems,
    otherProducts: tiles.filter((tile) => !RELATIONSHIP_STATUSES.includes(tile.status)),
    one: registry.find((product) => product.kind === 'bundle') ?? null,
  }
}
