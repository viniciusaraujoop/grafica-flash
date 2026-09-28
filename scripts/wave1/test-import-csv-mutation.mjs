// Wave 1 T3 — Import CSV mutation sensitivity. Each mutant injects a deliberate unsafe change into
// lib/import-engine/**, runs scripts/wave1/test-import-csv.mjs and ALWAYS restores the file.
// Usage: node scripts/wave1/test-import-csv-mutation.mjs   (exit 1 if any mutant survives)
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MUTANTS = [
 {
  "name": "allow reserved field (user MAP accepted)",
  "file": "lib/import-engine/core/mapping.ts",
  "from": "    if (reserved) {\n",
  "to": "    if (reserved && decision?.action !== 'MAP') {\n"
 },
 {
  "name": "auto-resolve ambiguity (first candidate wins)",
  "file": "lib/import-engine/core/mapping.ts",
  "from": "if (candidates.length === 1) {",
  "to": "if (candidates.length >= 1) {"
 },
 {
  "name": "remove row limit",
  "file": "lib/import-engine/core/parser.ts",
  "from": "if (records.length > IMPORT_LIMITS.maxDataRows + 1) return",
  "to": "if (false) return"
 },
 {
  "name": "remove byte limit",
  "file": "lib/import-engine/core/encoding.ts",
  "from": "if (bytes.length > IMPORT_LIMITS.maxInputBytes) return",
  "to": "if (false) return"
 },
 {
  "name": "relax quotes",
  "file": "lib/import-engine/core/parser.ts",
  "from": "relax_quotes: false,",
  "to": "relax_quotes: true,"
 },
 {
  "name": "enable automatic casting",
  "file": "lib/import-engine/core/parser.ts",
  "from": "cast: false,",
  "to": "cast: true,"
 },
 {
  "name": "permit duplicate headers",
  "file": "lib/import-engine/core/headers.ts",
  "from": "issues.add('DUPLICATE_HEADER', 'error', 1, columnId(index), { duplicateOf: columnId(first) })\n      blocking = true",
  "to": "void first"
 },
 {
  "name": "allow company_id (not reserved)",
  "file": "lib/import-engine/core/fields.ts",
  "from": "'company_id', 'companyid',",
  "to": "'companyid',"
 },
 {
  "name": "evaluate/coerce formula in numeric field",
  "file": "lib/import-engine/core/values.ts",
  "from": "  const value = raw.trim()\n  const trigger = formulaTrigger(value)\n  if (trigger === '=' || trigger === '@' || trigger === '+') return { ok: false, code: 'FIELD_FORMULA_NOT_ALLOWED' }",
  "to": "  const value = raw.trim().replace(/^[=+@]/, '')\n  const trigger = null"
 },
 {
  "name": "mutate formula text (prepend apostrophe)",
  "file": "lib/import-engine/core/values.ts",
  "from": "  if (formulaTrigger(value)) issues.push({ code: 'FORMULA_LIKE_TEXT', severity: 'warning', params: { trigger: formulaTrigger(value) as string } })\n  if (MARKUP",
  "to": "  if (formulaTrigger(value)) return { value: `'${value}`, issues }\n  if (MARKUP"
 },
 {
  "name": "\"false\" becomes true",
  "file": "lib/import-engine/core/values.ts",
  "from": "const BOOLEAN_TRUE = new Set(['true', '1', 'sim', 'yes'])",
  "to": "const BOOLEAN_TRUE = new Set(['true', '1', 'sim', 'yes', 'false'])"
 },
 {
  "name": "merge same-name customer (name → STRONG)",
  "file": "lib/import-engine/core/duplicates.ts",
  "from": "duplicates.push(dup('WEAK_DUPLICATE_CANDIDATE', 'IN_FILE', 'NAME', group.rows, []))",
  "to": "duplicates.push(dup('STRONG_DUPLICATE_CANDIDATE', 'IN_FILE', 'NAME', group.rows, []))"
 },
 {
  "name": "disable automation suppression",
  "file": "lib/import-engine/core/types.ts",
  "from": "export const AUTOMATION_POLICY = 'SUPPRESSED_BY_DEFAULT' as const",
  "to": "export const AUTOMATION_POLICY = 'ENABLED' as const"
 },
 {
  "name": "permit unlimited issues",
  "file": "lib/import-engine/core/issues.ts",
  "from": "if (this.retained.length >= this.cap) {",
  "to": "if (false) {"
 },
 {
  "name": "omit tenant from future idempotency material",
  "file": "lib/import-engine/core/fingerprint.ts",
  "from": "    tenantId: input.trustedTenantId,\n",
  "to": ""
 },
 {
  "name": "delimiter: pick most columns on tie",
  "file": "lib/import-engine/core/delimiter.ts",
  "from": "if (viable.length === 1) return",
  "to": "if (viable.length >= 1) return"
 },
 {
  "name": "BR phone +55 rejected as formula",
  "file": "lib/import-engine/core/values.ts",
  "from": "  const parsed = parsePhoneValue(value, policy.phoneRegion)",
  "to": "  if (formulaTrigger(value)) return { value: null, issues: [{ code: 'FIELD_FORMULA_NOT_ALLOWED', severity: 'error' }] }\n  const parsed = parsePhoneValue(value, policy.phoneRegion)"
 },
 {
  "name": "SKU silently uppercased / trimmed",
  "file": "lib/import-engine/core/fields.ts",
  "from": "field('product.sku', 'PRODUCTS', 'opaque_text', false, 64, false, false),",
  "to": "field('product.sku', 'PRODUCTS', 'opaque_text', false, 64, false, true),"
 },
 {
  "name": "NFKC on user data",
  "file": "lib/import-engine/core/values.ts",
  "from": "  const nfc = raw.normalize('NFC')",
  "to": "  const nfc = raw.normalize('NFKC')"
 },
 {
  "name": "1,234 guessed under DOT",
  "file": "lib/import-engine/core/values.ts",
  "from": "if ((locale === 'DOT' && separator !== '.') || (locale === 'COMMA' && separator !== ',')) return",
  "to": "if (locale === 'COMMA' && separator !== ',') return"
 },
 {
  "name": "negative price accepted",
  "file": "lib/import-engine/core/values.ts",
  "from": "if (parsed.negative && !field.allowNegative && parsed.value !== '0') return",
  "to": "if (false) return"
 },
 {
  "name": "PII echoed in issue params",
  "file": "lib/import-engine/core/values.ts",
  "from": "return field.pii ? { valueLength: codePointLength(raw), valueType: 'string' } : { valueLength: codePointLength(raw) }",
  "to": "return { valueLength: codePointLength(raw), value: raw }"
 },
 {
  "name": "duplicate destination: last column wins",
  "file": "lib/import-engine/core/mapping.ts",
  "from": "      issues.add('DUPLICATE_DESTINATION_MAPPING', 'error', null, columnId(entry.sourceIndex), { duplicateOf: columnId(first) })\n      entry.status = 'AMBIGUOUS'",
  "to": "      bySource.set(entry.sourceIndex, entry.destinationField)\n      continue\n      entry.status = 'AMBIGUOUS'"
 },
 {
  "name": "cell length limit removed",
  "file": "lib/import-engine/core/parser.ts",
  "from": "if (bytes > IMPORT_LIMITS.maxCellUtf8Bytes || codePointLength(cell) > IMPORT_LIMITS.maxCellChars) return",
  "to": "if (false) return"
 },
 {
  "name": "column limit removed",
  "file": "lib/import-engine/core/parser.ts",
  "from": "if (width > IMPORT_LIMITS.maxColumns) return",
  "to": "if (false) return"
 },
 {
  "name": "control characters allowed (binary masquerading)",
  "file": "lib/import-engine/core/encoding.ts",
  "from": "if (isForbiddenControl(code)) return 'CSV_BINARY_CONTENT'",
  "to": "void code"
 },
 {
  "name": "invalid UTF-8 guessed (non-fatal decode)",
  "file": "lib/import-engine/core/encoding.ts",
  "from": "new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })",
  "to": "new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })"
 },
 {
  "name": "identity conflict picks a winner / suppressed",
  "file": "lib/import-engine/core/duplicates.ts",
  "from": "if (group.aux.size > 1) conflicts.push(conflict('IDENTITY_CONFLICT', 'EMAIL', 'EMAIL_WITH_DIFFERENT_PHONES', group.rows))",
  "to": ""
 },
 {
  "name": "SKU conflict downgraded to duplicate",
  "file": "lib/import-engine/core/duplicates.ts",
  "from": "if (group.aux.size > 1) conflicts.push(conflict('SKU_CONFLICT', 'SKU', 'SKU_WITH_DIFFERENT_BUSINESS_FIELDS', group.rows))\n      else ",
  "to": ""
 },
 {
  "name": "price_on_request absent treated as true",
  "file": "lib/import-engine/core/rows.ts",
  "from": "const onRequest = values['product.price_on_request'] === true",
  "to": "const onRequest = values['product.price_on_request'] !== false"
 }
]

const results = []
for (const mutant of MUTANTS) {
  const file = path.join(root, mutant.file)
  const original = readFileSync(file, 'utf8')
  const count = original.split(mutant.from).length - 1
  if (count !== 1) { results.push({ name: mutant.name, outcome: `INVALID (pattern x${count})` }); continue }
  try {
    writeFileSync(file, original.replace(mutant.from, () => mutant.to))
    const run = spawnSync(process.execPath, ['--test', 'scripts/wave1/test-import-csv.mjs'], { cwd: root, encoding: 'utf8', timeout: 600000 })
    const fail = Number(/# fail (\d+)/.exec(run.stdout ?? '')?.[1] ?? -1)
    results.push({ name: mutant.name, outcome: fail > 0 ? `KILLED (fail ${fail})` : fail === 0 ? 'SURVIVED' : 'ERROR' })
  } finally {
    writeFileSync(file, original)
  }
}
for (const result of results) console.log(`${result.name.padEnd(52)} ${result.outcome}`)
const killed = results.filter((result) => result.outcome.startsWith('KILLED')).length
console.log(`\nmutants killed ${killed}/${results.length}`)
process.exit(killed === results.length ? 0 : 1)
