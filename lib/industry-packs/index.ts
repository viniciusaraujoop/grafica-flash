// Industry Packs — public surface of the pure core (Wave 1 T1). No apply, no I/O.

export * from './core/types'
export { CAPABILITY_KEYS, SETTING_PATHS, TEMPLATE_PLACEHOLDERS, type CapabilityKey } from './core/constants'
export { validatePack } from './core/validate'
export { resolvePack, buildResolvedView, packRef, parsePackRef } from './core/resolve'
export { classifyPackItem } from './core/classify'
export { diffPackAgainstCompany } from './core/diff'
export { buildPackProposal } from './core/proposal'
export { buildRegistrySnapshot, roleCapabilityFlags, ALL_COMPANY_PERMISSIONS } from './core/registry-snapshot'
export { legacyNichoToPackKey, LEGACY_NICHO_IDS, type LegacyNichoMapping } from './legacy-map'
export { industryPackCatalog, WAVE1_PACK_KEYS } from './catalog'
