// Wave 1 T1 — shared pure utilities + purity guard for every Wave 1 core directory.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const { stableStringify, fingerprint } = await import('../../lib/wave1/shared/canonical.ts')
const { isJsonValue, isPlainRecord } = await import('../../lib/wave1/shared/json.ts')
const { ok, fail, fromIssues, issue } = await import('../../lib/wave1/shared/result.ts')
const { sha256Hex } = await import('../../lib/wave1/shared/sha256.server.ts')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('stableStringify sorts keys recursively and is order independent', () => {
  const a = stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: 'x' } })
  const b = stableStringify({ a: { c: 'x', d: [1, { y: 2, z: 1 }] }, b: 1 })
  assert.equal(a, b)
  assert.equal(a, '{"a":{"c":"x","d":[1,{"y":2,"z":1}]},"b":1}')
})

test('stableStringify omits undefined properties and maps undefined array slots to null', () => {
  assert.equal(stableStringify({ a: undefined, b: 1 }), '{"b":1}')
  assert.equal(stableStringify([undefined, 1]), '[null,1]')
})

test('stableStringify returns null for non-JSON values instead of throwing', () => {
  assert.equal(stableStringify(Number.NaN), null)
  assert.equal(stableStringify(Number.POSITIVE_INFINITY), null)
  assert.equal(stableStringify({ f: () => 1 }), null)
  assert.equal(stableStringify(10n), null)
  assert.equal(stableStringify(new Date(0)), null)
  const cyclic = { a: 1 }
  cyclic.self = cyclic
  assert.equal(stableStringify(cyclic), null)
  const shared = { x: 1 }
  assert.equal(stableStringify({ a: shared, b: shared }), '{"a":{"x":1},"b":{"x":1}}')
})

test('fingerprint uses the injected hash and is deterministic', () => {
  const calls = []
  const fake = (input) => {
    calls.push(input)
    return `h:${input.length}`
  }
  assert.equal(fingerprint({ b: 2, a: 1 }, fake), 'h:13')
  assert.deepEqual(calls, ['{"a":1,"b":2}'])
  assert.equal(fingerprint({ a: Number.NaN }, fake), null)
  assert.equal(fingerprint({ a: 1, b: 2 }, sha256Hex), fingerprint({ b: 2, a: 1 }, sha256Hex))
  assert.match(sha256Hex('x'), /^[0-9a-f]{64}$/)
})

test('json guards', () => {
  assert.equal(isJsonValue({ a: [1, 'x', null, true] }), true)
  assert.equal(isJsonValue({ a: Number.NaN }), false)
  assert.equal(isJsonValue(new Map()), false)
  assert.equal(isPlainRecord(Object.create(null)), true)
  assert.equal(isPlainRecord([]), false)
})

test('result helpers split errors and warnings', () => {
  assert.deepEqual(ok(1), { ok: true, value: 1, warnings: [] })
  assert.equal(fail([issue('X', 'p')]).ok, false)
  const mixed = fromIssues(1, [issue('W', 'p', undefined, 'warning'), issue('E', 'q')])
  assert.equal(mixed.ok, false)
  assert.equal(mixed.errors.length, 1)
  assert.equal(mixed.warnings.length, 1)
  assert.equal(fromIssues(1, [issue('W', 'p', undefined, 'warning')]).ok, true)
})

// ---- purity guard ---------------------------------------------------------------------------

const PURE_DIRS = ['lib/wave1', 'lib/industry-packs', 'lib/automation-recipes', 'lib/actions', 'lib/events', 'lib/detectors']
const FORBIDDEN = [
  /from\s+['"]node:/,
  /from\s+['"](fs|net|http|https|child_process|crypto)['"]/,
  /from\s+['"]@supabase\//,
  /from\s+['"]next\//,
  /process\.env/,
  /Date\.now\(/,
  /new Date\(\)/,
  /Math\.random\(/,
  /\bfetch\(/,
  /from\s+['"]@\/lib\/(company-access|supabase|supabase-server)['"]/,
]

function listTs(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listTs(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

test('Wave 1 pure core has no I/O, clock, randomness or server-only imports', () => {
  const offenders = []
  for (const dir of PURE_DIRS) {
    for (const file of listTs(path.join(root, dir))) {
      if (file.endsWith('.server.ts')) continue
      const source = readFileSync(file, 'utf8')
      for (const pattern of FORBIDDEN) if (pattern.test(source)) offenders.push(`${path.relative(root, file)} ~ ${pattern}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('only the server adapter touches node:crypto, and no core file imports it', () => {
  const importers = []
  for (const dir of PURE_DIRS) {
    for (const file of listTs(path.join(root, dir))) {
      if (/from\s+['"][^'"]*sha256\.server['"]/.test(readFileSync(file, 'utf8'))) importers.push(path.relative(root, file))
    }
  }
  assert.deepEqual(importers, [])
  assert.match(readFileSync(path.join(root, 'lib/wave1/shared/sha256.server.ts'), 'utf8'), /from 'node:crypto'/)
})

test('no concurrent segment enum (GRAPHICS/FOOD/SERVICES/RETAIL) is introduced', () => {
  const offenders = []
  for (const dir of PURE_DIRS) {
    for (const file of listTs(path.join(root, dir))) {
      const source = readFileSync(file, 'utf8')
      if (/['"`](GRAPHICS|RETAIL|SERVICES|FOOD)['"`]/.test(source) || /\benum\s+\w+/.test(source)) offenders.push(path.relative(root, file))
    }
  }
  assert.deepEqual(offenders, [])
})
