// Wave 1 pure core: canonical serialization and injected hashing.
// The core never imports node:crypto so it stays consumable from the browser;
// callers inject a HashFn (see sha256.server.ts for the server adapter).

import { isPlainRecord } from './json'

export type HashFn = (input: string) => string

/**
 * Deterministic JSON serialization with sorted object keys.
 * Object properties whose value is `undefined` are omitted (as JSON.stringify does).
 * Returns null when the value is not JSON-serializable (functions, symbols, bigint,
 * non-finite numbers, class instances, cycles).
 */
export function stableStringify(value: unknown): string | null {
  const seen = new Set<unknown>()

  function walk(input: unknown): string | null {
    if (input === null) return 'null'
    switch (typeof input) {
      case 'string':
        return JSON.stringify(input)
      case 'boolean':
        return input ? 'true' : 'false'
      case 'number':
        return Number.isFinite(input) ? JSON.stringify(input) : null
      case 'object': {
        if (seen.has(input)) return null
        seen.add(input)
        let out: string | null
        if (Array.isArray(input)) {
          const parts: string[] = []
          for (const item of input) {
            const part = item === undefined ? 'null' : walk(item)
            if (part === null) {
              seen.delete(input)
              return null
            }
            parts.push(part)
          }
          out = `[${parts.join(',')}]`
        } else if (isPlainRecord(input)) {
          const parts: string[] = []
          for (const key of Object.keys(input).sort()) {
            const item = input[key]
            if (item === undefined) continue
            const part = walk(item)
            if (part === null) {
              seen.delete(input)
              return null
            }
            parts.push(`${JSON.stringify(key)}:${part}`)
          }
          out = `{${parts.join(',')}}`
        } else {
          out = null
        }
        seen.delete(input)
        return out
      }
      default:
        return null
    }
  }

  return walk(value)
}

/** Fingerprint of a JSON-serializable value with an injected hash function. */
export function fingerprint(value: unknown, hash: HashFn): string | null {
  const canonical = stableStringify(value)
  return canonical === null ? null : hash(canonical)
}
