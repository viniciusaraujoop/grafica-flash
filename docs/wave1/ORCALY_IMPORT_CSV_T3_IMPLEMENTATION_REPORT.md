# ORÇALY — AGENT 2 — IMPORT ENGINE CSV PURE CORE T3 — IMPLEMENTATION REPORT

**Normative security source:** `IMPORT_CSV_SECURITY_PREFLIGHT_REPORT` (Agent 4 — PASS, READY_FOR_AGENT2_PURE_CORE) — invariants I1–I20 treated as normative.
**Scope:** PURE CORE ONLY (dry run). Runtime, database, migrations, UI, production: NOT AUTHORIZED. XLSX: HOLD.

> ### ⚠️ Status: PARTIAL — `csv-parse` adapter PENDING
> The coordinator authorized adding `csv-parse`, but the npm registry returns **HTTP 403 (organization egress policy)** for `registry.npmjs.org/csv-parse` in the implementation environment, and the environment policy forbids routing around it. No version could be resolved, pinned, locked or audited, and the mission forbids a hand-written parser.
> With the user's decision (2026-09-28), everything downstream of parsing was implemented and tested against the `CsvParserFn` contract using explicit test doubles. **The final status is therefore `IMPORT_CSV_T3_PARTIAL — CSV_PARSE_ADAPTER_PENDING`, not `IMPORT_CSV_T3_COMPLETE`.**
> Completing T3 requires one small unit in an environment with registry access (see "Pending adapter").

## BASE SHA
`33bcd7c2c21d454a90090e5cb59bbbc8f38317ae` (Smart Setup T2, certified). Not main / M0 / Security B1 / feat/integrations-expansion / codex/orcaly-ecosystem.

## BRANCH
`claude/orcaly-import-csv-t3`

## HEAD / COMMITS
| Commit | Content |
| --- | --- |
| `e88bb5bd66fc838d597a9a703fb18559c735f4e1` | feat(import-engine): CSV pure core T3 dry run (parser adapter pending) |
| (next commit) | docs(import-engine): this report — final HEAD in the handoff |

## FILES CREATED
`lib/import-engine/core/`: `types.ts` (limits, vocabularies, result types) · `issues.ts` (bounded diagnostics) · `encoding.ts` (UTF-8 fatal decode, byte/control checks) · `parser.ts` (strict policy, parser contract, matrix re-verification) · `delimiter.ts` · `headers.ts` · `fields.ts` (allowlists, reserved names, bounded aliases) · `mapping.ts` · `values.ts` (field-specific parsers) · `rows.ts` · `duplicates.ts` · `fingerprint.ts` · `dry-run.ts` · `index.ts`
`scripts/wave1/test-import-csv.mjs` (49 tests) · `scripts/wave1/test-import-csv-mutation.mjs` (30 mutants) · this report.

## FILES MODIFIED
- `lib/wave1/manifest.ts` — adds `buildImportCsvManifest()` (safe metadata only)
- `scripts/wave1/print-manifests.mjs` — prints the `importCsv` section
- `package.json` — `test:wave1` also runs `scripts/wave1/test-import-csv.mjs` (script line only; **no dependency added**)

Not touched: `app/**`, `components/**`, `supabase/**`, `vercel.json`, Security B1, M0, integration/automation/Google runtimes, T1 Industry Pack/Recipe behavior, Smart Setup ruleset, BusinessType canonical modules.

## DEPENDENCY CHANGE
**NONE** (blocked by environment, see above). `package-lock.json` unchanged.

## CSV-PARSE VERSION
**Not resolved** — registry unreachable (`E403 Forbidden — GET https://registry.npmjs.org/csv-parse`). To be pinned exactly (`--save-exact`) by the pending adapter unit after checking the current stable release and its (expected zero) runtime dependencies.

## DEPENDENCY AUDIT
**NOT_RUN** — no dependency was added; `npm audit` cannot reach the registry either. Required in the pending unit: `npm audit --omit=dev` must show no new high/critical attributable to csv-parse; otherwise `DEPENDENCY_SECURITY_BLOCKED`.

## PARSER CONTRACT
- The core never parses CSV syntax. `parseCsvMatrix(text, delimiter, parser)` calls an injected `CsvParserFn` with `STRICT_PARSER_POLICY` (frozen) and limits, and **re-verifies** the returned matrix: array of string arrays, stable width, ≤ 25,001 records, ≤ 100 columns, ≤ 500,000 cells, cell ≤ 32,768 code points and ≤ 64 KiB UTF-8, record ≤ 256 KiB, no lone surrogates. Any deviation → `CSV_PARSER_CONTRACT_VIOLATION` / specific limit code. Parser exceptions are swallowed into `CSV_SYNTAX_INVALID` (no stack, no content).
- `STRICT_PARSER_POLICY` = `{ bom: true, cast: false, cast_date: false, columns: false, comment: null, raw: false, relax_quotes: false, relax_column_count: false, skip_records_with_error: false, skip_empty_lines: false, trim: false, ltrim: false, rtrim: false, quote: '"', escape: '"', max_record_size: 262144 }`.
- Headers are row 1 of the `string[][]` matrix; `columns: true` is never used (a test scans for it).
- Without a parser, the dry run returns `BLOCKED` + `CSV_PARSER_UNAVAILABLE` — never a fallback parser.

### Pending adapter (exact spec for the next unit)
`lib/import-engine/csv-parse-adapter.ts` (outside `core/`, so the core stays dependency-free):
```ts
import { parse } from 'csv-parse/sync'
import type { CsvParserFn } from './core'
export const csvParseAdapter: CsvParserFn = ({ text, delimiter, policy, limits }) => {
  let cells = 0
  try {
    const records = parse(text, {
      ...policy, delimiter,
      on_record: (record: string[], context: { records: number }) => {
        if (context.records > limits.maxRecords) throw Object.assign(new Error('limit'), { code: 'TOO_MANY_RECORDS' })
        if (record.length > limits.maxColumns) throw Object.assign(new Error('limit'), { code: 'TOO_MANY_COLUMNS' })
        cells += record.length
        if (cells > limits.maxCells) throw Object.assign(new Error('limit'), { code: 'TOO_MANY_CELLS' })
        return record
      },
    }) as string[][]
    return { ok: true, records }
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH') return { ok: false, failure: 'INCONSISTENT_COLUMNS', recordNumber: null }
    if (code === 'CSV_MAX_RECORD_SIZE') return { ok: false, failure: 'RECORD_TOO_LARGE', recordNumber: null }
    if (code === 'TOO_MANY_RECORDS' || code === 'TOO_MANY_COLUMNS' || code === 'TOO_MANY_CELLS') return { ok: false, failure: code, recordNumber: null }
    return { ok: false, failure: 'SYNTAX', recordNumber: null }
  }
}
```
Pending-unit checklist: `npm install --save-exact csv-parse@<stable>`; confirm zero runtime deps; `npm audit`; map csv-parse `comment: null` → omit option if the pinned version rejects `null`; add real-parser tests for quoted commas, `""` escapes, embedded CR/LF, malformed quotes, BOM, CRLF, trailing newline, blank line (strict: `skip_empty_lines: false` → inconsistent columns) and limit aborts; switch the manifest `parserStatus` to `CSV_PARSE_PINNED`.

## LIMITS
| Resource | Limit | Enforcement |
| --- | ---: | --- |
| CSV input | 10 MiB | bytes checked **before** decoding/parsing (string input measured in UTF-8 bytes without allocation) |
| Data rows | 25,000 | parser limit + core re-check |
| Columns | 100 | parser limit + core re-check |
| Total parsed cells | 500,000 | parser limit + core re-check |
| Cell | 32,768 code points / 64 KiB UTF-8 | core |
| Header | 128 characters | core (`HEADER_TOO_LONG`, blocking) |
| Logical record | 256 KiB | `max_record_size` + core re-check |
| Issues retained | 2,000 | counters continue; `diagnosticsTruncated: true` |
| Duplicate diagnostics | 1,000 | totals preserved; `diagnosticsTruncated: true` |
| Mapping candidates / column | 16 | alias registry slice |
| Delimiter candidates | 4 | fixed allowlist |
| Delimiter sample | 64 KiB of whole lines | detection only |
| Rows listed per duplicate group | 50 | `rowCount` keeps full size |

## FIELD ALLOWLISTS
- **CUSTOMERS:** `customer.name` (required), `customer.email`, `customer.phone`. No document/address/notes/metadata.
- **PRODUCTS:** `product.name` (required), `product.sku`, `product.price`, `product.stock`, `product.description`, `product.category`, `product.active`, `product.price_on_request`.
- **Reserved (ignore-only, no destination can receive them):** structural `__proto__`/`prototype`/`constructor`; tenant/identity (`company_id`, `tenant_id`, `owner_id`, `user_id`, `id`…); generated/provenance (`contact_key`, `normalized_name`, `*_normalized`, `source`, `source_id`, `created_*`, `updated_*`, `merged_into_id`, `archived`, `metadata`); product internals (`business_type`, cost/margin, `configuracoes`, `extras`, `variations`/`variacoes`, `addons`/`adicionais`, payment/deposit config); platform/secrets (`plan`, `subscription_status`, `entitlement`, `access_token`, `api_key`, `token`, `password`, provider/integration state, `webhook`, audit); automation authority (`trigger_automation`, `automation`, `send_whatsapp`, `notify`). Matching is on the canonical header with space/`_`/`-`/`.` unified (`Company ID` = `company_id`).
- **Mapping:** decision sources `EXACT_ALIAS` | `USER_SELECTED` | `IGNORED`; bounded exact alias registry (no fuzzy); unknown → `UNKNOWN_COLUMN`; multi-destination alias (`contato`) → `AMBIGUOUS_COLUMN_MAPPING`; two columns into one destination → `DUPLICATE_DESTINATION_MAPPING` (neither wins); unresolved → `USER_DECISION_REQUIRED` and no rows are produced.
- **Structural safety:** matrix → validated indexes → `Map` (source → destination id) → records built only from allowlisted destination ids in canonical order. `record[untrustedHeader] = value` never occurs (prototype pollution tests pass).

## NORMALIZATION
- Cells: NFC only (never NFKC). BOM removed once.
- Trim is field-specific: name, email, phone, price, stock, category, booleans trim; **SKU and description do not** (opaque / exact).
- Empty cell (after field trim) → `null`; `"null"`, `"N/A"`, `"undefined"` stay literal. Required empty → `MISSING_REQUIRED_FIELD`.
- Boolean: closed vocabulary `true/false/1/0/sim/não/yes/no`, case-insensitive; `"false"` → `false`; anything else → `INVALID_BOOLEAN`.
- Decimal: explicit `DOT`/`COMMA`; output is a canonical decimal **string** (no float); `1,234` under DOT, `1.234` under COMMA, mixed separators, multiple separators or any separator with `UNSPECIFIED` → `NUMBER_FORMAT_AMBIGUOUS`; currency, exponent, hex, spaces → `INVALID_DECIMAL`; ≤ 12 integer and ≤ 4 fraction digits.
- Stock: non-negative integer (≤ 9 digits) or `null` when absent; `1.5`, `10un` → `INVALID_INTEGER`.
- Price: required and ≥ 0 unless `price_on_request = true` (absent flag is **not** true).
- Email: conservative linear grammar; compared with trim + lowercase; never "corrected".
- Phone: BR E.164 normalization **only** when the trusted option `phoneRegion = 'BR'`; otherwise shape check (7–15 digits) and the value is kept.
- No generic `Number()` / `Boolean()` / `parseFloat` / `eval` (enforced by a static scan test). No date parser exists.

## FORMULA SAFETY
- Detection: first effective char after leading whitespace ∈ `= + - @`.
- Text destinations (name, SKU, description, category, email): value preserved exactly (no `'` prefix) + `FORMULA_LIKE_TEXT` warning.
- Numeric/boolean destinations: `=`, `+`, `@` → `FIELD_FORMULA_NOT_ALLOWED`; `-` followed by valid numeric grammar parses as a negative literal and is then rejected by the destination rule (`NEGATIVE_NOT_ALLOWED`); a bare `-` or non-numeric `-…` → `FIELD_FORMULA_NOT_ALLOWED`.
- Phone: `+55…` follows the phone grammar (never treated as a formula).
- Markup-looking text is inert and flagged `POTENTIAL_MARKUP_TEXT` (no sanitizer, no rendering).

## CUSTOMER DUPLICATES
Map indexes, O(rows × fields); only valid rows participate.
- Same row fingerprint → `EXACT_DUPLICATE_ROW`.
- Same normalized email (trim+lower) across ≥ 2 distinct rows → `STRONG_DUPLICATE_CANDIDATE` (basis EMAIL).
- Same normalized phone → `STRONG_DUPLICATE_CANDIDATE` (basis PHONE).
- Same name only → `WEAK_DUPLICATE_CANDIDATE` (review only; name is never identity).
- Same email with ≥ 2 distinct non-empty phones, or same phone with ≥ 2 distinct non-empty emails → `IDENTITY_CONFLICT`, `winner: null`.
- Every candidate has `autoMerge: false`. Optional trusted, tenant-scoped snapshot (supplied by a future runtime, never by CSV) yields `EXISTING`-scope candidates with opaque refs (bounded, deduplicated).

## PRODUCT DUPLICATES
- Identical normalized row → `EXACT_DUPLICATE_ROW`.
- Same non-empty SKU (exact, opaque) + same business fields (name, price, category) → `DUPLICATE_SKU_CANDIDATE`.
- Same SKU + different business fields → `SKU_CONFLICT`.
- Empty SKU is never a key; SKU uniqueness is never assumed; no overwrite.

## TENANT BOUNDARY
The core is tenant-agnostic: no function accepts a tenant, DB client or provider. CSV `company_id`/`tenant_id`/`owner_id`/`user_id` columns are reserved (ignore-only). `futureIdempotencyMaterial({ trustedTenantId, … })` documents the future key material and **requires** a non-empty trusted tenant id (not used by the dry run).

## DRY RUN CONTRACT
`importCsvDryRun(input, options, { parser, hashes })` → `ImportDryRunResult` with `schemaVersion`, `entity`, `rulesetVersion` (`import-csv.ruleset.v1.0.0`), `status` (`READY_FOR_REVIEW` / `USER_DECISION_REQUIRED` / `BLOCKED`), `inputFingerprint`, `mappingFingerprint`, `parserPolicy`, `mapping`, `rows`, `issues`, `issueTotals`, `duplicateCandidates`, `conflicts`, `summary` (counts + estimated actions: create candidates / review required / skip invalid), `diagnosticsTruncated`, and always `dryRun: true`, `notApplied: true`, `requiresUserConfirmation: true`, `automationPolicy: 'SUPPRESSED_BY_DEFAULT'`. It contains no `companyIdFromCsv`, `applyToken`, `databaseAction`, `providerAction`, `jobId` (tested).

## AUTOMATION SUPPRESSION
`AUTOMATION_POLICY = 'SUPPRESSED_BY_DEFAULT'` is a constant on every result; CSV values (e.g. `trigger_automation=true`) are reserved columns with zero authority (tested).

## DETERMINISM
No clock, randomness, locale-dependent comparison (only code-unit ordering and `toLowerCase`), environment ordering or network. Stable orders: source rows; canonical destination order; issues by row → column → code; duplicate/conflict groups by first row → second row. Same bytes + policy + mapping + ruleset → byte-equivalent canonical result (tested 20×).

## FINGERPRINTS
Injected `ImportHashes { bytes, text }` (SHA-256 in tests; the core never imports `node:crypto`).
- `inputFingerprint` = hash of the **exact original bytes** (BOM and line endings included).
- `mappingFingerprint` = canonical JSON of entity, ruleset version, delimiter policy, number locale, phone region and mapping entries.
- `rowFingerprint` = entity + normalized allowed destination values in canonical order (no row number, tenant, timestamp or runtime field; column order in the file does not matter).

## ISSUE VOCABULARY
Closed list `ISSUE_CODES` (types.ts) — all 35 required codes plus refinements: `CSV_ENCODING_UNSUPPORTED`, `CSV_EMPTY`, `CSV_INCONSISTENT_COLUMNS`, `CSV_PARSER_UNAVAILABLE`, `CSV_PARSER_CONTRACT_VIOLATION`, `DELIMITER_UNDETECTED`, `DELIMITER_NOT_ALLOWED`, `DUPLICATE_DESTINATION_MAPPING`, `INVALID_MAPPING_DECISION`, `INVALID_INTEGER`, `NEGATIVE_NOT_ALLOWED`, `POTENTIAL_MARKUP_TEXT`, `UNSUPPORTED_ENTITY`, `INVALID_OPTIONS`. Issue shape: `code`, `severity`, `rowNumber`, `columnId`, `params` — PII fields expose only `valueLength`/`valueType`.

## TEST TOTALS
| Suite | Result |
| --- | --- |
| `scripts/wave1/test-import-csv.mjs` | **49/49 PASS** |
| `npm run test:wave1` (T1 + T2 + T3) | **176/176 PASS** |
| `npm test` | **PASS** |

Required coverage items: comma, semicolon, tab (and pipe) CSV · quoted commas · escaped quotes · embedded newline · BOM · invalid UTF-8 · NUL · binary-ish · byte / row / column / cell-count boundaries · giant cell · giant header · duplicate header · case/whitespace/NFC duplicate header · malformed quote · inconsistent columns · ambiguous delimiter · unknown field · reserved field · `__proto__` / `constructor` / `prototype` · formulas `=` `+` `-` `@` · valid `+55` phone · negative numeric semantics · ambiguous decimal · empty/null · `"false"` · exact duplicate row · duplicate email · duplicate phone · name-only · identity conflict · duplicate SKU · SKU conflict · issue cap · duplicate cap · deterministic output and fingerprints · no time/randomness/network/DB/filesystem/Supabase/automations/providers (static scan). **Quoted/escaped/embedded-newline/malformed-quote cases are validated at the contract level with csv-parse fixtures; they must be re-run against the real pinned parser in the pending unit.**

## MUTATION TOTALS
`node scripts/wave1/test-import-csv-mutation.mjs` → **30/30 killed**. Mission/preflight list: allow reserved field · auto-resolve ambiguity · remove row limit · remove byte limit · relax quotes · enable casting · permit duplicate headers · allow `company_id` · evaluate/coerce formula · mutate formula text · `"false"` → true · merge same-name customer · disable automation suppression · permit unlimited issues · omit tenant from idempotency material. Extra: delimiter "most columns" · `+55` treated as formula · SKU trimmed · NFKC · `1,234` guessed · negative price accepted · PII echoed in issue · duplicate destination last-wins · cell limit removed · column limit removed · control chars allowed · non-fatal UTF-8 · identity conflict suppressed · SKU conflict downgraded · absent `price_on_request` treated as true.

## T1/T2 REGRESSION
T1 **77/77 PASS**; Smart Setup T2 **50/50 PASS** and its mutation suite **20/20**. No T1/T2 file changed.

## TYPECHECK
TypeScript 6.0.3, project-equivalent flags (`strict`, `isolatedModules`, bundler resolution, `@/` alias) over `lib/import-engine/core`, `lib/smart-setup/core`, `lib/wave1/manifest.ts` and their import graph: **0 errors**. Extra-strict `noUnusedLocals`/`noUnusedParameters` on the import core: **0 errors**.

## LINT
**NOT_RUN** — ESLint not installed and the npm registry is blocked in this environment.

## BUILD/PREVIEW
**PASS** — Vercel Preview of core commit `e88bb5b`: `dpl_45vgcJ75RtQdTiNWo9G71PfZSHNw` READY (target: preview; production untouched). The report commit's Preview is recorded in the handoff. Next build typechecks the whole project (`**/*.ts`, no `ignoreBuildErrors`).

## COVERAGE
`node --test --experimental-test-coverage --test-coverage-include='lib/import-engine/**'` — every file ≥ 90% branches:

| File | Lines | Branches | Funcs |
| --- | --- | --- | --- |
| delimiter.ts | 100 | 100 | 100 |
| dry-run.ts | 100 | 100 | 100 |
| duplicates.ts | 100 | 93.14 | 100 |
| encoding.ts | 100 | 94.55 | 100 |
| fields.ts | 100 | 92.31 | 100 |
| fingerprint.ts | 100 | 100 | 100 |
| headers.ts | 100 | 100 | 100 |
| issues.ts | 100 | 100 | 100 |
| mapping.ts | 100 | 100 | 100 |
| parser.ts | 100 | 95.45 | 100 |
| rows.ts | 100 | 100 | 100 |
| values.ts | 100 | 94.25 | 100 |
| **all files** | **100** | **96.18** | **100** |

## SECURITY INVARIANTS I1–I20
I1 zero side effects ✅ · I2 CSV carries no authorization ✅ · I3 CSV cannot choose tenant ✅ · I4 allowlisted destinations ✅ · I5 unknown headers never auto-map ✅ · I6 ambiguity requires a human ✅ · I7 formulas never evaluated ✅ · I8 fail-safe parser recovery ✅ (contract + policy; real-parser verification pending) · I9 no silent coercion ✅ · I10 no silent identity merge ✅ · I11 name is not identity ✅ · I12 no raw PII in diagnostics ✅ · I13 bounded resources ✅ · I14 non-quadratic matching ✅ · I15 deterministic ✅ · I16 automations suppressed ✅ · I17 dry run cannot persist ✅ · I18 XLSX absent ✅ · I19 internal fields cannot be targets ✅ · I20 apply requires a new boundary ✅ (no apply exists).

## DATABASE MUTATION
**NONE**

## FINAL STATUS
**IMPORT_CSV_T3_PARTIAL — CSV_PARSE_ADAPTER_PENDING**
Blocker: `csv-parse` cannot be installed/pinned/audited here (npm registry E403). Everything else in the mission is implemented and passing.
RUNTIME: NOT_AUTHORIZED · APPLY: NOT_AUTHORIZED · MIGRATIONS: NONE · DATABASE: UNTOUCHED · PRODUCTION: UNTOUCHED
