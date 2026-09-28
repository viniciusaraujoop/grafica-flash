// Industry Pack Contract v1 — resolvePack: version selection + derived views. Pure.

import { fail, issue, ok, type Result } from '../../wave1/shared/result'
import type { IndustryPackDefinition, PackItem, PackStatus, ResolvedPackView } from './types'
import { compareItemIdentity, compareSemver, parseSemver } from './util'

export function packRef(pack: Pick<IndustryPackDefinition, 'key' | 'version'>): string {
  return `${pack.key}@${pack.version}`
}

export function parsePackRef(ref: string): { key: string; version: string | null } | null {
  const at = ref.lastIndexOf('@')
  const key = at >= 0 ? ref.slice(0, at) : ref
  const version = at >= 0 ? ref.slice(at + 1) : null
  if (!key || (version !== null && !parseSemver(version))) return null
  return { key, version }
}

function byKind<K extends PackItem['kind']>(items: PackItem[], kind: K): Extract<PackItem, { kind: K }>[] {
  return items.filter((item): item is Extract<PackItem, { kind: K }> => item.kind === kind)
}

export function buildResolvedView(definition: IndustryPackDefinition): ResolvedPackView {
  const items = [...definition.items].sort(compareItemIdentity)
  return {
    ref: packRef(definition),
    definition,
    required: items.filter((item) => item.requirement === 'required'),
    defaults: items.filter((item) => item.requirement === 'default'),
    recommended: items.filter((item) => item.requirement === 'recommended'),
    optional: items.filter((item) => item.requirement === 'optional'),
    modules: byKind(items, 'module'),
    statuses: byKind(items, 'status'),
    categories: byKind(items, 'category'),
    dashboards: byKind(items, 'dashboard'),
    reports: byKind(items, 'report'),
    recipes: byKind(items, 'recipe'),
    integrations: byKind(items, 'integration'),
    permissions: byKind(items, 'permission'),
    templates: byKind(items, 'template'),
    onboarding: byKind(items, 'onboarding'),
    settings: byKind(items, 'setting'),
  }
}

/**
 * Selects a pack version from an already-validated catalog.
 * `ref` may omit the version (`graphic.print_shop`) to select the highest allowed version.
 */
export function resolvePack(
  catalog: readonly IndustryPackDefinition[],
  ref: string,
  opts: { allowStatuses?: PackStatus[] } = {},
): Result<ResolvedPackView> {
  const parsed = parsePackRef(ref)
  if (!parsed) return fail([issue('PACK_REF_INVALID', 'ref', { ref })])

  const seen = new Set<string>()
  for (const pack of catalog) {
    const identity = packRef(pack)
    if (seen.has(identity)) return fail([issue('PACK_CATALOG_DUPLICATE', 'catalog', { ref: identity })])
    seen.add(identity)
  }

  const allowed = opts.allowStatuses ?? ['published']
  const candidates = catalog
    .filter((pack) => pack.key === parsed.key && (parsed.version === null || pack.version === parsed.version))
    .sort((a, b) => compareSemver(b.version, a.version))

  if (!candidates.length) return fail([issue('PACK_NOT_FOUND', 'ref', { ref })])
  const selected = candidates.find((pack) => allowed.includes(pack.status))
  if (!selected) return fail([issue('PACK_STATUS_NOT_ALLOWED', 'ref', { ref, status: candidates[0].status })])

  return ok(buildResolvedView(selected))
}
