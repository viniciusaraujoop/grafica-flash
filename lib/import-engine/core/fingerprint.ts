// Fingerprints (§28, preflight §28). Hashing is injected: the core never imports node:crypto.
// inputFingerprint hashes the EXACT original bytes (no newline/BOM normalization).
// rowFingerprint = entity + normalized allowed destination values in canonical destination order;
// it excludes row number, tenant, timestamps and runtime fields.

import { stableStringify } from '../../wave1/shared/canonical'
import { DESTINATIONS } from './fields'
import { IMPORT_RULESET_VERSION, type Delimiter, type DelimiterResolution, type ImportEntity, type MappingEntry, type NormalizedValue, type NumberLocale, type PhoneRegion } from './types'

export type ImportHashes = {
  /** SHA-256 (or equivalent) of raw bytes, hex. */
  bytes: (input: Uint8Array) => string
  /** SHA-256 (or equivalent) of a UTF-8 string, hex. */
  text: (input: string) => string
}

export function isImportHashes(value: unknown): value is ImportHashes {
  return !!value && typeof value === 'object' && typeof (value as ImportHashes).bytes === 'function' && typeof (value as ImportHashes).text === 'function'
}

/**
 * Canonical JSON of fingerprint material. The material is built only from strings, finite integers,
 * booleans and null, so serialization cannot fail; a failure would be a programming error.
 */
function canonical(material: unknown): string {
  return stableStringify(material) as string
}

export function rowFingerprint(entity: ImportEntity, values: Readonly<Record<string, NormalizedValue>>, hashes: ImportHashes): string {
  const ordered = DESTINATIONS[entity].map((field) => [field.id, values[field.id] ?? null])
  return hashes.text(canonical({ entity, values: ordered }))
}

export function mappingFingerprint(
  input: {
    entity: ImportEntity
    mapping: readonly MappingEntry[]
    delimiter: DelimiterResolution | { status: 'USER_SELECTED'; delimiter: Delimiter }
    numberLocale: NumberLocale
    phoneRegion: PhoneRegion
  },
  hashes: ImportHashes,
): string {
  const material = {
    entity: input.entity,
    rulesetVersion: IMPORT_RULESET_VERSION,
    delimiterPolicy: { status: input.delimiter.status, delimiter: input.delimiter.delimiter },
    numberLocale: input.numberLocale,
    phoneRegion: input.phoneRegion,
    mapping: input.mapping.map((entry) => ({ sourceIndex: entry.sourceIndex, canonicalHeader: entry.canonicalHeader, destinationField: entry.destinationField, status: entry.status, decisionSource: entry.decisionSource })),
  }
  return hashes.text(canonical(material))
}

/**
 * Material for the FUTURE runtime idempotency key (preflight §28). Tenant id MUST come from the
 * authenticated runtime and is mandatory; the CSV never supplies it. Not used by the dry run.
 */
export function futureIdempotencyMaterial(input: { trustedTenantId: string; entity: ImportEntity; inputFingerprint: string; mappingFingerprint: string }): string | null {
  if (typeof input.trustedTenantId !== 'string' || input.trustedTenantId.trim() === '') return null
  return canonical({
    tenantId: input.trustedTenantId,
    entity: input.entity,
    inputFingerprint: input.inputFingerprint,
    mappingFingerprint: input.mappingFingerprint,
    rulesetVersion: IMPORT_RULESET_VERSION,
  })
}
