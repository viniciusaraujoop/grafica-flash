# ORÇALY — AGENT 2 — IMPORT ENGINE CSV PURE CORE T3 — IMPLEMENTATION REPORT

**Normative security source:** `IMPORT_CSV_SECURITY_PREFLIGHT_REPORT` (Agent 4 — PASS, READY_FOR_AGENT2_PURE_CORE) — invariants I1–I20 treated as normative.
**Scope:** PURE CORE ONLY (dry run). Runtime, database, migrations, UI, production: NOT AUTHORIZED. XLSX: HOLD.

> ### Status: IMPLEMENTATION COMPLETE — independent execution of the real-parser suite required
> The dependency blocker is resolved: `csv-parse@7.0.2` was pinned exactly by the coordinator in commit `c5e01f7b258b5afc39580c46d24935bdac2441c8` (`package.json` + `package-lock.json`, installed and audited externally: **0 vulnerabilities**). The strict adapter, its library-free policy module and the real-parser test suite are implemented and committed.
> The implementation environment still cannot download packages (npm registry HTTP 403; not routed around), so `node_modules/csv-parse` is absent locally and the **real-parser suite could not be executed here** (`LOCAL_DEPENDENCY_EXECUTION: BLOCKED_BY_ENVIRONMENT`). Everything that does not need the library was executed and passes. Final status: **`IMPORT_CSV_T3_IMPLEMENTATION_COMPLETE — INDEPENDENT_EXECUTION_REQUIRED — READY_FOR_EXACT_SHA_CI`**.

## BASE SHA
`33bcd7c2c21d454a90090e5cb59bbbc8f38317ae` (Smart Setup T2, certified). Not main / M0 / Security B1 / feat/integrations-expansion / codex/orcaly-ecosystem.

## BRANCH
`claude/orcaly-import-csv-t3`

## HEAD / COMMITS
| Commit | Content |
| --- | --- |
| `e88bb5bd66fc838d597a9a703fb18559c735f4e1` | feat(import-engine): CSV pure core T3 dry run (parser adapter pending) |
| `a5fef6e5197c55c19ac8b6cdfe52f3b37a2b8a69` | docs(import-engine): T3 implementation report |
| `c5e01f7b258b5afc39580c46d24935bdac2441c8` | chore(deps): pin csv-parse@7.0.2 (coordinator) |
| `770de678509754d4aac4d840c37b6f7f947cd29e` | feat(import-engine): strict csv-parse@7.0.2 adapter with real-parser tests |
| (next commit) | docs(import-engine): report update + manifest parserStatus — **exact final SHA in the handoff** |

Note: the `770de67` commit message says the real-parser suite has 22 tests; the correct count is **20** (this report is authoritative).

## FILES CREATED
`lib/import-engine/core/`: `types.ts` (limits, vocabularies, result types) · `issues.ts` (bounded diagnostics) · `encoding.ts` (UTF-8 fatal decode, byte/control checks) · `parser.ts` (strict policy, parser contract, matrix re-verification) · `delimiter.ts` · `headers.ts` · `fields.ts` (allowlists, reserved names, bounded aliases) · `mapping.ts` · `values.ts` (field-specific parsers) · `rows.ts` · `duplicates.ts` · `fingerprint.ts` · `dry-run.ts` · `index.ts`
`scripts/wave1/test-import-csv.mjs` (49 tests) · `scripts/wave1/test-import-csv-mutation.mjs` (44 mutants) · this report.
Adapter layer (outside `core/`): `lib/import-engine/csv-parse-adapter.ts` (the only module importing csv-parse) · `lib/import-engine/csv-parse-policy.ts` (library-free options, limit guard, error mapping) · `scripts/wave1/test-import-csv-parse-policy.mjs` (9 tests, run without the library) · `scripts/wave1/test-import-csv-parser-real.mjs` (20 tests, require the installed library).

## FILES MODIFIED
- `lib/wave1/manifest.ts` — adds `buildImportCsvManifest()` (safe metadata only); `parserStatus: 'CSV_PARSE_PINNED_ADAPTER'`, `parserDependency: 'csv-parse@7.0.2'`
- `scripts/wave1/print-manifests.mjs` — prints the `importCsv` section
- `package.json` — `test:wave1` also runs the three import suites; dependency `"csv-parse": "7.0.2"` added by the coordinator (`c5e01f7`)
- `package-lock.json` — csv-parse 7.0.2 entry, by the coordinator (`c5e01f7`); not edited by Agent 2

Not touched: `app/**`, `components/**`, `supabase/**`, `vercel.json`, Security B1, M0, integration/automation/Google runtimes, T1 Industry Pack/Recipe behavior, Smart Setup ruleset, BusinessType canonical modules.

## DEPENDENCY CHANGE
`csv-parse` **7.0.2**, exact pin (no `^`/`~`), in `dependencies`. Lockfile entry: `resolved https://registry.npmjs.org/csv-parse/-/csv-parse-7.0.2.tgz`, `integrity sha512-uKZghv9UmPkMVLYy//KZ9HFAIJsl7wkhoEdIL0+rhuSY9pZQlhaeGEDPIe+/w7eh81MOql8Q/9+inAGWG6ZHYA==`, license MIT, **no runtime dependencies**. Committed by the coordinator in `c5e01f7`; a test asserts the exact pin in both files.

## CSV-PARSE VERSION
**7.0.2** (coordinator decision: patched against the pre-7.0.2 prototype-replacement issue, zero runtime dependencies, more settled than 7.0.3). The adapter was written against the published 7.0.2 type declarations and option normalizer (`lib/index.d.ts`, `lib/sync.js`, `lib/api/normalize_options.js`), read-only via unpkg.

## DEPENDENCY AUDIT
- **External (coordinator, after install):** `npm ls csv-parse --depth=0` → `csv-parse@7.0.2`; `npm audit` → **0 vulnerabilities** (existing repository: 0; introduced by csv-parse: 0).
- **This environment:** `npm audit` NOT_RUN (registry HTTP 403). Must be re-run by exact-SHA CI; any new HIGH/CRITICAL attributable to csv-parse → `DEPENDENCY_SECURITY_BLOCKED` (no automatic upgrade).

## PARSER CONTRACT
- The core never parses CSV syntax. `parseCsvMatrix(text, delimiter, parser)` calls an injected `CsvParserFn` with `STRICT_PARSER_POLICY` (frozen) and limits, and **re-verifies** the returned matrix: array of string arrays, stable width, ≤ 25,001 records, ≤ 100 columns, ≤ 500,000 cells, cell ≤ 32,768 code points and ≤ 64 KiB UTF-8, record ≤ 256 KiB, no lone surrogates. Any deviation → `CSV_PARSER_CONTRACT_VIOLATION` / specific limit code. Parser exceptions are swallowed into `CSV_SYNTAX_INVALID` (no stack, no content).
- `STRICT_PARSER_POLICY` = `{ bom: true, cast: false, cast_date: false, columns: false, comment: null, raw: false, relax_quotes: false, relax_column_count: false, skip_records_with_error: false, skip_empty_lines: false, trim: false, ltrim: false, rtrim: false, quote: '"', escape: '"', max_record_size: 262144 }`.
- Headers are row 1 of the `string[][]` matrix; `columns: true` is never used (a test scans for it).
- Without a parser, the dry run returns `BLOCKED` + `CSV_PARSER_UNAVAILABLE` — never a fallback parser.

### csv-parse adapter (implemented)
`lib/import-engine/csv-parse-adapter.ts` — the ONLY file that imports csv-parse (`import { parse } from 'csv-parse/sync'`, synchronous API only). A static test asserts that no other `lib/**` file imports it and that `core/**` never imports the adapter layer.
```
input text + validated delimiter → checkParserRequest → parse(text, { ...CSV_PARSE_OPTIONS, delimiter, on_record: guard }) → string[][]
                                                                     └─ any throw → mapCsvParseError → { ok:false, failure, recordNumber }
```
- **Options** (`CSV_PARSE_OPTIONS`, frozen, derived key-for-key from core `STRICT_PARSER_POLICY`): `bom: true, cast: false, cast_date: false, columns: false, comment: null, delimiter_auto: false, escape: '"', group_columns_by_name: false, info: false, ltrim/rtrim/trim: false, max_record_size: 262144, quote: '"', raw: false, relax_column_count(_less/_more): false, relax_quotes: false, skip_empty_lines: false, skip_records_with_empty_values: false, skip_records_with_error: false`. `delimiter` is added per call only from the allowlisted core policy; `ignore_last_delimiters` is left at its default (false). Never `columns: true`, `group_columns_by_name`, `delimiter_auto`, `auto_parse`, `objname`, `on_skip`, `from/to`.
- **Request check:** refuses (→ `SYNTAX`) any request whose `policy` is not the frozen core object (a look-alike copy is refused), whose delimiter is not allowlisted, or whose text is not a string.
- **Early limit enforcement:** csv-parse enforces 256 KiB per logical record while buffering (`max_record_size`, bytes — the sync API parses a UTF-8 Buffer). The `on_record` guard aborts during parsing at record 25,002 (`TOO_MANY_RECORDS`), first record wider than 100 columns (`TOO_MANY_COLUMNS`) and the record that crosses 500,000 cells (`TOO_MANY_CELLS`). Requested limits can only tighten, never widen, the core ceilings. The 10 MiB byte limit is enforced by the core before decoding; per-cell 32,768 chars / 64 KiB and header 128 chars remain enforced by the core's matrix re-verification and header layer.
- **Error mapping** (closed vocabulary): `CSV_MAX_RECORD_SIZE` → `RECORD_TOO_LARGE` → `CSV_RECORD_TOO_LARGE`; `CSV_RECORD_INCONSISTENT_FIELDS_LENGTH` / `CSV_RECORD_INCONSISTENT_COLUMNS` → `INCONSISTENT_COLUMNS`; guard aborts → `TOO_MANY_RECORDS/COLUMNS/CELLS` → `CSV_TOO_MANY_ROWS/COLUMNS/CELLS`; every other code (quote errors, unknown, option errors, non-objects) → `SYNTAX` → `CSV_SYNTAX_INVALID`. Only the string `code` and the integer `records` counter are read (`recordNumber = records + 1`); `message`, `stack`, `raw`, `record` and all other error properties — which can contain CSV content/PII — are never read or forwarded. Library errors never escape the adapter.

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
| `scripts/wave1/test-import-csv.mjs` (core, test doubles) | **49/49 PASS** |
| `scripts/wave1/test-import-csv-parse-policy.mjs` (adapter layer, no library needed) | **9/9 PASS** |
| `scripts/wave1/test-import-csv-parser-real.mjs` (real csv-parse@7.0.2) | **20 tests — NOT EXECUTED here** (`ERR_MODULE_NOT_FOUND: csv-parse`, dependency not installable locally) → exact-SHA CI |
| `npm run test:wave1` | **185/186 locally**: the only failure is the real-parser file failing to import csv-parse (by design it fails, never skips, when the library is missing). Expected in CI: **205/205** (176 previous + 9 + 20) |
| `npm test` | **PASS** (exit 0) |

Real-parser suite (20): pinned version installed · library `normalize_options` confirms every strict option · comma/semicolon/tab/pipe end-to-end detection · ambiguous delimiter + explicit choice + quoted comma not faking ambiguity · quoted delimiter, `""` escapes, embedded LF and CRLF · malformed quotes (5 variants) → `CSV_SYNTAX_INVALID`, zero rows · malformed record never skipped (whole file fails) · inconsistent columns (more/fewer) with record number · BOM (bytes and raw text) · giant logical record (wide row, multi-line quoted field, unterminated quote) · row/column/cell limit aborts through the adapter · matrix-first `string[][]`, no cast/date/trim · `#` lines are data, blank middle line not dropped · duplicate headers · `__proto__`/`constructor`/`prototype` stay array cells, RESERVED, never object keys, no prototype pollution · formula-like values inert · `+55` phone (quoted/unquoted) · failures expose no raw CSV/PII/stack/library message · adapter refuses non-contract requests · determinism + dry-run-only flags.

Required coverage items: comma, semicolon, tab (and pipe) CSV · quoted commas · escaped quotes · embedded newline · BOM · invalid UTF-8 · NUL · binary-ish · byte / row / column / cell-count boundaries · giant cell · giant header · duplicate header · case/whitespace/NFC duplicate header · malformed quote · inconsistent columns · ambiguous delimiter · unknown field · reserved field · `__proto__` / `constructor` / `prototype` · formulas `=` `+` `-` `@` · valid `+55` phone · negative numeric semantics · ambiguous decimal · empty/null · `"false"` · exact duplicate row · duplicate email · duplicate phone · name-only · identity conflict · duplicate SKU · SKU conflict · issue cap · duplicate cap · deterministic output and fingerprints · no time/randomness/network/DB/filesystem/Supabase/automations/providers (static scan). Quoted/escaped/embedded-newline/malformed-quote cases are covered in the core suite with fixtures and **against the real csv-parse in `test-import-csv-parser-real.mjs`** (pending independent execution).

## MUTATION TOTALS
`node scripts/wave1/test-import-csv-mutation.mjs` → **44/44 killed** (30 core + 14 adapter-layer mutants run against the policy suite: enable `columns`, `group_columns_by_name`, `delimiter_auto`, `relax_column_count_more`, `skip_records_with_empty_values`, `info` · guard without row limit / cell limit · request widens limits · `CSV_MAX_RECORD_SIZE` or ragged rows reported as syntax · look-alike policy accepted · non-allowlisted delimiter accepted · non-integer record number trusted). Mission/preflight list: allow reserved field · auto-resolve ambiguity · remove row limit · remove byte limit · relax quotes · enable casting · permit duplicate headers · allow `company_id` · evaluate/coerce formula · mutate formula text · `"false"` → true · merge same-name customer · disable automation suppression · permit unlimited issues · omit tenant from idempotency material. Extra: delimiter "most columns" · `+55` treated as formula · SKU trimmed · NFKC · `1,234` guessed · negative price accepted · PII echoed in issue · duplicate destination last-wins · cell limit removed · column limit removed · control chars allowed · non-fatal UTF-8 · identity conflict suppressed · SKU conflict downgraded · absent `price_on_request` treated as true.

## T1/T2 REGRESSION
T1 **77/77 PASS** (shared 9 + industry packs 40 + recipes 28); Smart Setup T2 **50/50 PASS** and its mutation suite **20/20**. No T1/T2 file changed.

## TYPECHECK
TypeScript 6.0.3, project-equivalent flags (`strict`, `isolatedModules`, bundler resolution, `@/` alias) over `lib/import-engine/core`, `lib/smart-setup/core`, `lib/wave1/manifest.ts` and their import graph: **0 errors**. Extra-strict `noUnusedLocals`/`noUnusedParameters` on the import core: **0 errors**. Adapter layer (`csv-parse-adapter.ts`, `csv-parse-policy.ts`) with project flags and with strict-unused: **0 errors** — locally against a scratch-only declaration shim of the 7.0.2 `parse` signature (never committed); the Vercel build typechecks the adapter against the real installed csv-parse types (see BUILD/PREVIEW).

## LINT
**NOT_RUN** — ESLint not installed and the npm registry is blocked in this environment. (The `prebuild` ESLint file list does not include import-engine files.)

## BUILD/PREVIEW
**PASS** (all Previews, target preview; production untouched):
- `e88bb5b` core → `dpl_45vgcJ75RtQdTiNWo9G71PfZSHNw` READY
- `770de67` adapter → `dpl_55XPvxiURiXnFHjaH48JRSiLKZET` READY — installed from the committed lockfile (includes csv-parse 7.0.2) and ran `prebuild` (`npm test`) + `next build`, which typechecks every `**/*.ts` (no `ignoreBuildErrors`); the adapter imports `csv-parse/sync`, so a missing module or type mismatch would have failed the build. Build logs themselves could not be read (Vercel API 403 for this token), so this is inferred from the READY state, not from the log text.
- Report commit → exact final SHA and Preview in the handoff.
The Vercel build does **not** run `test:wave1`, so it is not evidence for the real-parser suite.

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
| csv-parse-policy.ts | 100 | 100 | 100 |
| **all files** | **100** | **96.42** | **100** |

`csv-parse-adapter.ts`: **not measurable locally** (cannot be loaded without the library). It is a single branch-light function (request check → parse → error map); target ≥ 90% branches to be measured by exact-SHA CI with:
`node --test --experimental-test-coverage --test-coverage-include='lib/import-engine/**' scripts/wave1/test-import-csv.mjs scripts/wave1/test-import-csv-parse-policy.mjs scripts/wave1/test-import-csv-parser-real.mjs`

## SECURITY INVARIANTS I1–I20
I1 zero side effects ✅ · I2 CSV carries no authorization ✅ · I3 CSV cannot choose tenant ✅ · I4 allowlisted destinations ✅ · I5 unknown headers never auto-map ✅ · I6 ambiguity requires a human ✅ · I7 formulas never evaluated ✅ · I8 fail-safe parser recovery ✅ (contract + policy + adapter; real-parser execution pending CI) · I9 no silent coercion ✅ · I10 no silent identity merge ✅ · I11 name is not identity ✅ · I12 no raw PII in diagnostics ✅ · I13 bounded resources ✅ · I14 non-quadratic matching ✅ · I15 deterministic ✅ · I16 automations suppressed ✅ · I17 dry run cannot persist ✅ · I18 XLSX absent ✅ · I19 internal fields cannot be targets ✅ · I20 apply requires a new boundary ✅ (no apply exists).

## DATABASE MUTATION
**NONE**

## ENVIRONMENT LIMITATIONS
- `LOCAL_DEPENDENCY_EXECUTION: BLOCKED_BY_ENVIRONMENT` — npm registry returns HTTP 403 in the implementation environment (not routed around; no package vendored, no lockfile edited by Agent 2). Consequences: real-parser suite (20), its coverage of `csv-parse-adapter.ts` and `npm audit` were not executed here.
- ESLint unavailable (NOT_RUN).
- Vercel build logs unreadable (API 403); build READY state recorded instead.

## EXACT-SHA CI (for Coordinator / Agent 3)
On the final SHA, in an environment with npm access:
```
npm ci
npm ls csv-parse --depth=0            # → csv-parse@7.0.2
npm audit                             # no new HIGH/CRITICAL from csv-parse
node --test scripts/wave1/test-import-csv-parser-real.mjs     # expect 20/20
npm run test:wave1                    # expect 205/205
node scripts/wave1/test-import-csv-mutation.mjs              # expect 44/44
node scripts/wave1/test-smart-setup-mutation.mjs             # expect 20/20
npm test && npm run build
node --test --experimental-test-coverage --test-coverage-include='lib/import-engine/**' scripts/wave1/test-import-csv.mjs scripts/wave1/test-import-csv-parse-policy.mjs scripts/wave1/test-import-csv-parser-real.mjs
```
If the real-parser suite passes, T3 becomes `IMPORT_CSV_T3_COMPLETE — READY_FOR_AGENT3_QA`. Any failure there is an adapter/test finding for Agent 2 (expectations about csv-parse 7.0.2 behaviour were written from its published source but not executed).

## FINAL STATUS
**IMPORT_CSV_T3_IMPLEMENTATION_COMPLETE — INDEPENDENT_EXECUTION_REQUIRED — READY_FOR_EXACT_SHA_CI**
DEPENDENCY: csv-parse@7.0.2 (pinned, lockfile committed, external audit 0 vulnerabilities)
RUNTIME: NOT_AUTHORIZED · APPLY: NOT_AUTHORIZED · MIGRATIONS: NONE · DATABASE: UNTOUCHED · PRODUCTION: UNTOUCHED · XLSX: HOLD
