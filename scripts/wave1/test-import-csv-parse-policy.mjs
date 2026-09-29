// Wave 1 T3 — csv-parse adapter layer: policy, limit guard, error mapping and isolation.
// Runs WITHOUT csv-parse installed (lib/import-engine/csv-parse-policy.ts never imports the library).
// Real-library behaviour is covered by scripts/wave1/test-import-csv-parser-real.mjs.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const policy = await import('../../lib/import-engine/csv-parse-policy.ts')
const core = await import('../../lib/import-engine/core/index.ts')
const { STRICT_PARSER_POLICY, parserRequest } = await import('../../lib/import-engine/core/parser.ts')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => readFileSync(path.join(root, rel), 'utf8')
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const L = core.IMPORT_LIMITS
const O = policy.CSV_PARSE_OPTIONS

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

test('pinned version is exactly 7.0.2 in policy, package.json and package-lock.json', () => {
  assert.equal(policy.CSV_PARSE_PINNED_VERSION, '7.0.2')
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.dependencies['csv-parse'], '7.0.2', 'exact pin, no ^ or ~')
  const lock = JSON.parse(read('package-lock.json'))
  assert.equal(lock.packages['']?.dependencies?.['csv-parse'], '7.0.2')
  const entry = lock.packages['node_modules/csv-parse']
  assert.equal(entry.version, '7.0.2')
  assert.match(entry.integrity, /^sha512-/)
  assert.equal(entry.dependencies, undefined, 'csv-parse has zero runtime dependencies')
})

test('csv-parse options: every permissive / object-building / casting feature is OFF', () => {
  assert.ok(Object.isFrozen(O))
  const expected = {
    bom: true, cast: false, cast_date: false, columns: false, comment: null, delimiter_auto: false,
    escape: '"', group_columns_by_name: false, info: false, ltrim: false, max_record_size: 262144, quote: '"',
    raw: false, relax_column_count: false, relax_column_count_less: false, relax_column_count_more: false,
    relax_quotes: false, rtrim: false, skip_empty_lines: false, skip_records_with_empty_values: false,
    skip_records_with_error: false, trim: false,
  }
  assert.deepEqual({ ...O }, expected)
  for (const forbidden of ['delimiter', 'on_record', 'on_skip', 'auto_parse', 'auto_parse_date', 'objname', 'from', 'from_line', 'to', 'to_line', 'encoding', 'record_delimiter', 'ignore_last_delimiters']) {
    assert.ok(!Object.prototype.hasOwnProperty.call(O, forbidden), `${forbidden} is not part of the static option set`)
  }
  assert.equal(O.max_record_size, L.maxRecordBytes)
})

test('csv-parse options mirror the core STRICT_PARSER_POLICY key-for-key', () => {
  assert.equal(policy.optionsMatchCorePolicy(), true)
  for (const [key, value] of Object.entries(STRICT_PARSER_POLICY)) assert.equal(O[key], value, key)
})

test('static: no source ever enables columns / group_columns_by_name / relax / cast / skip / delimiter_auto', () => {
  const files = [...walk(path.join(root, 'lib/import-engine'))]
  const patterns = [
    /columns\s*:\s*true/, /group_columns_by_name\s*:\s*true/, /groupColumnsByName/, /relax_quotes\s*:\s*true/, /relaxQuotes/,
    /relax_column_count(_less|_more)?\s*:\s*true/, /relaxColumnCount/, /\bcast(_date)?\s*:\s*true/, /castDate|autoParse|auto_parse/,
    /skip_records_with_error\s*:\s*true/, /skipRecordsWithError/, /delimiter_auto\s*:\s*true/, /delimiterAuto/, /raw\s*:\s*true/, /info\s*:\s*true/,
  ]
  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const pattern of patterns) assert.ok(!pattern.test(source), `${path.relative(root, file)} matches ${pattern}`)
  }
})

test('isolation: only csv-parse-adapter.ts imports csv-parse; core/** and policy never do', () => {
  const importers = walk(path.join(root, 'lib')).filter((file) => /from\s+['"]csv-parse/.test(readFileSync(file, 'utf8')) || /import\(\s*['"]csv-parse/.test(readFileSync(file, 'utf8')))
  assert.deepEqual(importers.map((file) => path.relative(root, file)), ['lib/import-engine/csv-parse-adapter.ts'])
  const adapter = stripComments(read('lib/import-engine/csv-parse-adapter.ts'))
  assert.match(adapter, /from 'csv-parse\/sync'/, 'synchronous API only (no stream, no callback)')
  assert.ok(!/console\.|fetch\(|process\.|require\(|node:fs|supabase|\.message|\.stack|\.raw\b|\.record\b/i.test(adapter), 'adapter has no side effects and never reads error text/content')
  assert.ok(/\.\.\.CSV_PARSE_OPTIONS/.test(adapter) && /delimiter: request\.delimiter/.test(adapter) && /on_record: createRecordGuard/.test(adapter))
  for (const file of walk(path.join(root, 'lib/import-engine/core'))) {
    assert.ok(!/csv-parse-adapter|csv-parse-policy/.test(readFileSync(file, 'utf8')), `${path.relative(root, file)} must not depend on the adapter layer`)
  }
})

test('record guard aborts early on rows / columns / cells and never widens limits', () => {
  const guard = policy.createRecordGuard({ maxRecords: 3, maxColumns: 2, maxCells: 5 })
  assert.deepEqual(guard(['a', 'b']), ['a', 'b'])
  assert.deepEqual(guard(['c', 'd']), ['c', 'd'])
  assert.throws(() => guard(['e', 'f']), (error) => error instanceof policy.CsvLimitAbort && error.failure === 'TOO_MANY_CELLS' && error.recordNumber === 3)

  const rows = policy.createRecordGuard({ maxRecords: 2, maxColumns: 5, maxCells: 100 })
  rows(['a']); rows(['b'])
  assert.throws(() => rows(['c']), (error) => error.failure === 'TOO_MANY_RECORDS' && error.recordNumber === 3)

  const cols = policy.createRecordGuard({ maxRecords: 5, maxColumns: 2, maxCells: 100 })
  assert.throws(() => cols(['a', 'b', 'c']), (error) => error.failure === 'TOO_MANY_COLUMNS' && error.recordNumber === 1)

  // Requests can only tighten: absurd / invalid requested limits fall back to the core ceilings.
  const wide = policy.createRecordGuard({ maxRecords: 10 ** 9, maxColumns: 10 ** 9, maxCells: 10 ** 9 })
  assert.throws(() => wide(new Array(L.maxColumns + 1).fill('x')), (error) => error.failure === 'TOO_MANY_COLUMNS')
  const invalid = policy.createRecordGuard({ maxRecords: -1, maxColumns: 1.5, maxCells: 'x' })
  assert.deepEqual(invalid(new Array(L.maxColumns).fill('x')).length, L.maxColumns)
  const missing = policy.createRecordGuard(undefined)
  let n = 0
  assert.throws(() => { for (;;) { missing(['x']); n += 1 } }, (error) => error.failure === 'TOO_MANY_RECORDS')
  assert.equal(n, L.maxDataRows + 1)
  const cells = policy.createRecordGuard({ maxRecords: 10 ** 9 })
  const wideRow = new Array(L.maxColumns).fill('x')
  assert.throws(() => { for (;;) cells(wideRow) }, (error) => error.failure === 'TOO_MANY_CELLS' && error.recordNumber === L.maxTotalCells / L.maxColumns + 1)
})

test('limit abort carries no CSV content', () => {
  const error = new policy.CsvLimitAbort('TOO_MANY_RECORDS', 7)
  assert.equal(error.message, 'CSV_LIMIT_ABORT')
  assert.deepEqual(Object.keys(error).sort(), ['failure', 'name', 'recordNumber'])
})

test('error mapping: closed vocabulary; reads only code + records; never message/raw/record', () => {
  const pii = 'Ana Souza,ana@example.com,+5511999998888'
  const libError = (code, extra = {}) => Object.assign(new Error(`Invalid Record: ${pii}`), { code, records: 4, lines: 9, raw: pii, record: pii.split(','), ...extra })
  const cases = [
    ['CSV_MAX_RECORD_SIZE', 'RECORD_TOO_LARGE'],
    ['CSV_RECORD_INCONSISTENT_FIELDS_LENGTH', 'INCONSISTENT_COLUMNS'],
    ['CSV_RECORD_INCONSISTENT_COLUMNS', 'INCONSISTENT_COLUMNS'],
    ['CSV_QUOTE_NOT_CLOSED', 'SYNTAX'],
    ['CSV_INVALID_CLOSING_QUOTE', 'SYNTAX'],
    ['INVALID_OPENING_QUOTE', 'SYNTAX'],
    ['CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE', 'SYNTAX'],
    ['CSV_UNKNOWN_ERROR', 'SYNTAX'],
    ['CSV_INVALID_OPTION_COLUMNS', 'SYNTAX'],
    ['__proto__', 'SYNTAX'],
    ['constructor', 'SYNTAX'],
  ]
  for (const [code, failure] of cases) {
    const mapped = policy.mapCsvParseError(libError(code))
    assert.deepEqual(mapped, { failure, recordNumber: 5 }, code)
    assert.ok(!JSON.stringify(mapped).includes('ana'), 'no PII in mapped failure')
  }
  assert.deepEqual(policy.mapCsvParseError(libError(42)), { failure: 'SYNTAX', recordNumber: 5 })
  assert.deepEqual(policy.mapCsvParseError(libError('CSV_MAX_RECORD_SIZE', { records: -1 })), { failure: 'RECORD_TOO_LARGE', recordNumber: null })
  assert.deepEqual(policy.mapCsvParseError(libError('CSV_MAX_RECORD_SIZE', { records: 1.5 })), { failure: 'RECORD_TOO_LARGE', recordNumber: null })
  assert.deepEqual(policy.mapCsvParseError(libError('CSV_MAX_RECORD_SIZE', { records: '3' })), { failure: 'RECORD_TOO_LARGE', recordNumber: null })
  for (const junk of [null, undefined, 'CSV_MAX_RECORD_SIZE', 7, new Error(pii)]) {
    assert.deepEqual(policy.mapCsvParseError(junk), { failure: 'SYNTAX', recordNumber: null })
  }
  assert.deepEqual(policy.mapCsvParseError(new policy.CsvLimitAbort('TOO_MANY_CELLS', 12)), { failure: 'TOO_MANY_CELLS', recordNumber: 12 })
})

test('request check: only core-built requests with allowlisted delimiter and the strict policy object', () => {
  assert.equal(policy.checkParserRequest(parserRequest('a,b\n', ',')), true)
  for (const delimiter of [',', ';', '\t', '|']) assert.equal(policy.checkParserRequest(parserRequest('a\n', delimiter)), true)
  const good = parserRequest('a,b\n', ',')
  assert.equal(policy.checkParserRequest({ ...good, policy: { ...STRICT_PARSER_POLICY } }), false, 'a look-alike policy is not the frozen core policy')
  assert.equal(policy.checkParserRequest({ ...good, policy: { ...STRICT_PARSER_POLICY, relax_quotes: true } }), false)
  assert.equal(policy.checkParserRequest({ ...good, delimiter: ':' }), false)
  assert.equal(policy.checkParserRequest({ ...good, delimiter: ',,' }), false)
  assert.equal(policy.checkParserRequest({ ...good, text: Buffer.from('a') }), false)
  for (const junk of [null, undefined, 'a,b', 1, []]) assert.equal(policy.checkParserRequest(junk), false)
})
