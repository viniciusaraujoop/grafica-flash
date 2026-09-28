// Industry Pack Contract v1 — diffPackAgainstCompany. Pure; hashing is injected.

import { fingerprint, type HashFn } from '../../wave1/shared/canonical'
import { classifyPackItem } from './classify'
import { STATUS_SCOPES } from './constants'
import type {
  CompanyConfigurationSnapshot,
  PackDiff,
  PackDiffState,
  PackRegistrySnapshot,
  PackRemoval,
  ResolvedPackView,
} from './types'
import { compareItemIdentity, normalizeKey } from './util'

const EMPTY_SUMMARY: Record<PackDiffState, number> = {
  SAFE_ADDITION: 0,
  SAME_VALUE: 0,
  CONFLICT: 0,
  USER_OVERRIDE: 0,
  UNAVAILABLE: 0,
  ENTITLEMENT_BLOCKED: 0,
  INTEGRATION_UNAVAILABLE: 0,
  DEPRECATED_SETTING: 0,
}

function detectRemovals(pack: ResolvedPackView, company: CompanyConfigurationSnapshot): PackRemoval[] {
  const overridden = (kind: string, id: string) =>
    company.userOverrides.some((entry) => entry.kind === kind && entry.id === id)
  const removals: PackRemoval[] = []

  // A pack status list replaces the flow of its scope.
  for (const scope of STATUS_SCOPES) {
    const packStatuses = pack.statuses.filter((item) => item.value.scope === scope)
    if (!packStatuses.length) continue
    const packKeys = new Set(packStatuses.map((item) => normalizeKey(item.value.key)))
    for (const entry of company.statuses[scope] || []) {
      if (packKeys.has(normalizeKey(entry.key))) continue
      removals.push({
        kind: 'status',
        id: entry.key,
        scope,
        inUseCount: entry.inUseCount,
        state: overridden('status', entry.key) ? 'USER_OVERRIDE' : 'CONFLICT',
        replacesFlow: true,
      })
    }
  }

  // Categories are additive: absent categories are reported but never replace anything.
  for (const scope of ['product', 'finance'] as const) {
    const packLabels = new Set(pack.categories.filter((item) => item.value.scope === scope).map((item) => normalizeKey(item.value.label)))
    if (!packLabels.size) continue
    for (const entry of company.categories.filter((candidate) => candidate.scope === scope)) {
      if (packLabels.has(normalizeKey(entry.label))) continue
      removals.push({
        kind: 'category',
        id: entry.label,
        scope,
        inUseCount: entry.inUseCount,
        state: overridden('category', entry.label) ? 'USER_OVERRIDE' : 'CONFLICT',
        replacesFlow: false,
      })
    }
  }

  return removals.sort((a, b) =>
    a.kind !== b.kind ? (a.kind < b.kind ? -1 : 1) : a.scope !== b.scope ? (a.scope < b.scope ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )
}

export function diffPackAgainstCompany(
  pack: ResolvedPackView,
  company: CompanyConfigurationSnapshot,
  registry: PackRegistrySnapshot,
  opts: { hash: HashFn },
): PackDiff {
  const definition = pack.definition
  const items = [...definition.items]
    .sort(compareItemIdentity)
    .map((item) => classifyPackItem(item, company, registry, definition))
  const removals = detectRemovals(pack, company)

  const summary = { ...EMPTY_SUMMARY }
  for (const item of items) summary[item.state] += 1

  const blockingCount =
    items.filter((item) => item.blocking).length +
    removals.filter((removal) => removal.replacesFlow && removal.inUseCount > 0 && removal.state === 'CONFLICT').length

  const body = {
    packRef: pack.ref,
    companyId: company.companyId,
    basis: { appliedPackRef: company.appliedPack?.ref ?? null },
    items,
    removals,
    summary,
    blockingCount,
  }

  return {
    ...body,
    fingerprint: fingerprint({ body, company }, opts.hash) ?? 'unserializable',
  }
}
