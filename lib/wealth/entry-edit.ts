import { createHash } from 'node:crypto'
import type { WealthEntry } from './core'

export const entryMutableFields = ['title', 'kind', 'category', 'amount_cents', 'financial_date', 'currency', 'recurrence'] as const

// A revision detects stale forms. Ownership/permission still comes exclusively from the session and RLS.
export function entryRevision(entry: WealthEntry) {
  return createHash('sha256').update(JSON.stringify([entry.id, ...entryMutableFields.map(field => entry[field])])).digest('hex')
}
