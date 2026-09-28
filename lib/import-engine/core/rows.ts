// Row normalization + validation. Records are built ONLY from allowlisted destination ids
// (validated index → Map → canonical id → known shape). Untrusted headers never become keys.

import { DESTINATIONS } from './fields'
import { rowFingerprint, type ImportHashes } from './fingerprint'
import { BoundedIssues } from './issues'
import { parseFieldValue, type ValuePolicy } from './values'
import type { ImportEntity, ImportRow, NormalizedValue, RowStatus } from './types'

export function normalizeRows(
  entity: ImportEntity,
  rows: readonly string[][],
  bySource: ReadonlyMap<number, string>,
  policy: ValuePolicy,
  issues: BoundedIssues,
  hashes: ImportHashes,
): ImportRow[] {
  const fields = DESTINATIONS[entity]
  const sourceByDestination = new Map<string, number>()
  for (const [source, destination] of bySource) sourceByDestination.set(destination, source)

  const out: ImportRow[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 2 // header is record 1
    let errors = 0
    let warnings = 0
    const entries: Array<[string, NormalizedValue]> = []
    const failed = new Set<string>()
    for (const field of fields) {
      const source = sourceByDestination.get(field.id)
      if (source === undefined) {
        entries.push([field.id, null])
        continue
      }
      const parsed = parseFieldValue(row[source], field, policy)
      for (const issue of parsed.issues) {
        issues.add(issue.code, issue.severity, rowNumber, field.id, issue.params)
        if (issue.severity === 'error') {
          errors += 1
          failed.add(field.id)
        } else warnings += 1
      }
      entries.push([field.id, parsed.value])
    }
    const values = Object.fromEntries(entries) as Record<string, NormalizedValue>

    // Row-level rules.
    for (const field of fields) {
      // A value that failed parsing already has its own error; "missing" is only for real absence.
      if (field.required && values[field.id] === null && !failed.has(field.id)) {
        issues.add('MISSING_REQUIRED_FIELD', 'error', rowNumber, field.id)
        errors += 1
      }
    }
    if (entity === 'PRODUCTS') {
      // §19: price required and >= 0 unless price_on_request = true (absent flag is NOT true).
      const onRequest = values['product.price_on_request'] === true
      if (!onRequest && values['product.price'] === null && !failed.has('product.price')) {
        issues.add('MISSING_REQUIRED_FIELD', 'error', rowNumber, 'product.price', { reason: 'PRICE_REQUIRED_UNLESS_ON_REQUEST' })
        errors += 1
      }
    }

    const status: RowStatus = errors ? 'INVALID' : warnings ? 'VALID_WITH_WARNINGS' : 'VALID'
    out.push({ rowNumber, status, values, rowFingerprint: rowFingerprint(entity, values, hashes), errorCount: errors, warningCount: warnings })
  })
  return out
}
