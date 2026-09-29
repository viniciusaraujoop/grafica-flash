// Wave 1 T3 — REAL csv-parse@7.0.2 adapter tests (no test doubles).
// Requires `csv-parse` installed from the committed lockfile (npm ci). If the package is missing this
// file FAILS at import time on purpose — it never skips silently.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const { csvParseAdapter } = await import('../../lib/import-engine/csv-parse-adapter.ts')
const { CSV_PARSE_OPTIONS } = await import('../../lib/import-engine/csv-parse-policy.ts')
const ie = await import('../../lib/import-engine/core/index.ts')
const { parserRequest } = await import('../../lib/import-engine/core/parser.ts')
const csvParseSync = await import('csv-parse/sync')

const hashes = {
  bytes: (input) => createHash('sha256').update(input).digest('hex'),
  text: (input) => createHash('sha256').update(input, 'utf8').digest('hex'),
}
const L = ie.IMPORT_LIMITS
const parse = (text, delimiter = ',') => csvParseAdapter(parserRequest(text, delimiter))
const run = (input, options) => ie.importCsvDryRun(input, options, { parser: csvParseAdapter, hashes })
const customers = (csv, extra = {}) => run(csv, { entity: 'CUSTOMERS', ...extra })
const products = (csv, extra = {}) => run(csv, { entity: 'PRODUCTS', numberLocale: 'DOT', ...extra })
const codes = (result) => result.issues.map((issue) => issue.code)
const has = (result, code) => codes(result).includes(code)
const rowIssues = (result, rowNumber) => result.issues.filter((issue) => issue.rowNumber === rowNumber).map((issue) => `${issue.code}@${issue.columnId}`)
const blocked = (result, code) => {
  assert.equal(result.status, 'BLOCKED')
  assert.ok(has(result, code), `${code} in ${codes(result)}`)
  assert.deepEqual(result.rows, [], 'no partial rows from a failed parse')
}

test('committed csv-parse dependency is exactly the pinned 7.0.2', () => {
  const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'))
  assert.equal(lock.packages?.['node_modules/csv-parse']?.version, '7.0.2')
})

test('strict parser options are explicit and csv-parse accepts the structural policy', () => {
  // csv-parse normalizes some disabled transform options by omission (undefined), so security
  // assertions belong on the exact options we pass plus observable parser behavior below.
  for (const [key, expected] of Object.entries({
    columns: false,
    group_columns_by_name: false,
    cast: false,
    cast_date: false,
    relax_quotes: false,
    relax_column_count: false,
    relax_column_count_less: false,
    relax_column_count_more: false,
    skip_records_with_error: false,
    skip_records_with_empty_values: false,
    skip_empty_lines: false,
    raw: false,
    info: false,
    delimiter_auto: false,
    bom: true,
    trim: false,
    ltrim: false,
    rtrim: false,
  })) assert.equal(CSV_PARSE_OPTIONS[key], expected, key)
  assert.equal(CSV_PARSE_OPTIONS.comment, null)
  assert.equal(CSV_PARSE_OPTIONS.max_record_size, 262144)

  const n = csvParseSync.normalize_options({ ...CSV_PARSE_OPTIONS, delimiter: ';' })
  assert.equal(n.columns, false)
  assert.equal(n.bom, true)
  assert.equal(n.max_record_size, 262144)
  assert.deepEqual(n.delimiter.map((buffer) => buffer.toString()), [';'])
  assert.equal(n.quote.toString(), '"')
  assert.equal(n.escape.toString(), '"')
})

// ---- Delimiters ------------------------------------------------------------------------------------------
test('comma, semicolon, tab and pipe: detected end-to-end through the real parser', () => {
  for (const delimiter of [',', ';', '\t', '|']) {
    const csv = ['nome', 'email', 'telefone'].join(delimiter) + '\n' + ['Ana', 'ana@example.com', '11999998888'].join(delimiter) + '\n'
    const result = customers(csv)
    assert.equal(result.parserPolicy.delimiter.status, 'DETECTED', JSON.stringify(delimiter))
    assert.equal(result.parserPolicy.delimiter.delimiter, delimiter)
    assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(delimiter))
    assert.equal(result.rows[0].values['customer.name'], 'Ana')
    assert.equal(result.rows[0].values['customer.email'], 'ana@example.com')
    assert.deepEqual(parse(csv, delimiter), { ok: true, records: [['nome', 'email', 'telefone'], ['Ana', 'ana@example.com', '11999998888']] })
  }
})

test('ambiguous delimiter needs a user decision; an explicit choice parses; quotes do not fake ambiguity', () => {
  const ambiguous = customers('a;b,c;d\n1;2,3;4\n')
  assert.equal(ambiguous.status, 'USER_DECISION_REQUIRED')
  assert.equal(ambiguous.parserPolicy.delimiter.status, 'AMBIGUOUS')
  assert.deepEqual([...ambiguous.parserPolicy.delimiter.viable], [',', ';'])
  assert.ok(has(ambiguous, 'DELIMITER_AMBIGUOUS') && has(ambiguous, 'USER_DECISION_REQUIRED'))
  assert.deepEqual(ambiguous.rows, [])
  assert.deepEqual(parse('a;b,c;d\n1;2,3;4\n', ';'), { ok: true, records: [['a', 'b,c', 'd'], ['1', '2,3', '4']] })
  assert.deepEqual(parse('a;b,c;d\n1;2,3;4\n', ','), { ok: true, records: [['a;b', 'c;d'], ['1;2', '3;4']] })
  // A comma inside quotes is data, so only ';' is a viable delimiter here.
  const quoted = customers('nome;email\n"Souza, Ana";ana@example.com\n')
  assert.equal(quoted.parserPolicy.delimiter.status, 'DETECTED')
  assert.equal(quoted.parserPolicy.delimiter.delimiter, ';')
  assert.equal(quoted.rows[0].values['customer.name'], 'Souza, Ana')
})

// ---- Quoting ---------------------------------------------------------------------------------------------
test('quoted delimiter, escaped quotes and embedded newline are parsed exactly (RFC 4180)', () => {
  assert.deepEqual(parse('nome,obs\n"Souza, Ana","disse ""oi"""\n"Bia","linha 1\nlinha 2"\n'), {
    ok: true,
    records: [['nome', 'obs'], ['Souza, Ana', 'disse "oi"'], ['Bia', 'linha 1\nlinha 2']],
  })
  assert.deepEqual(parse('a,b\r\n"x\r\ny",z\r\n'), { ok: true, records: [['a', 'b'], ['x\r\ny', 'z']] })

  const people = customers('nome,email\n"Souza, Ana",ana@example.com\n"Ana ""Aninha"" Lima",aninha@example.com\n', { delimiter: ',' })
  assert.equal(people.status, 'READY_FOR_REVIEW')
  assert.equal(people.rows[0].values['customer.name'], 'Souza, Ana')
  assert.equal(people.rows[1].values['customer.name'], 'Ana "Aninha" Lima')

  const items = products('nome,preco,descricao\nCaneca,10.50,"Rua A\nApto 2"\n', { delimiter: ',' })
  assert.equal(items.status, 'READY_FOR_REVIEW')
  assert.equal(items.summary.dataRows, 1, 'embedded newline does not create a record')
  assert.equal(items.rows[0].values['product.description'], 'Rua A\nApto 2')
  assert.equal(items.rows[0].values['product.price'], '10.5')
})

test('malformed quotes fail closed (no relax_quotes recovery): CSV_SYNTAX_INVALID, zero rows', () => {
  for (const csv of ['a,b\n"x,y\n', 'a,b\nx"y,z\n', 'a,b\n"x"y,z\n', 'a,b\n"x" ,z\n', '"a,b\n1,2\n']) {
    const direct = parse(csv)
    assert.equal(direct.ok, false, JSON.stringify(csv))
    assert.equal(direct.failure, 'SYNTAX', JSON.stringify(csv))
    blocked(customers(csv, { delimiter: ',' }), 'CSV_SYNTAX_INVALID')
  }
})

test('a malformed record is never skipped: the whole file fails, earlier/later good rows are not returned', () => {
  const csv = 'nome,email\nAna,ana@example.com\n"Bia,bia@example.com\nCai,cai@example.com\n'
  assert.equal(parse(csv).ok, false)
  blocked(customers(csv, { delimiter: ',' }), 'CSV_SYNTAX_INVALID')
  const ragged = 'nome,email\nAna,ana@example.com\nBia\nCai,cai@example.com\n'
  assert.deepEqual(parse(ragged), { ok: false, failure: 'INCONSISTENT_COLUMNS', recordNumber: 3 })
  blocked(customers(ragged, { delimiter: ',' }), 'CSV_INCONSISTENT_COLUMNS')
})

test('inconsistent column count (more and fewer fields) → CSV_INCONSISTENT_COLUMNS with the record number', () => {
  assert.deepEqual(parse('a,b\n1,2,3\n'), { ok: false, failure: 'INCONSISTENT_COLUMNS', recordNumber: 2 })
  assert.deepEqual(parse('a,b,c\n1,2\n'), { ok: false, failure: 'INCONSISTENT_COLUMNS', recordNumber: 2 })
  const result = customers('nome,email\nAna,ana@example.com,extra\n', { delimiter: ',' })
  blocked(result, 'CSV_INCONSISTENT_COLUMNS')
  assert.equal(result.issues.find((issue) => issue.code === 'CSV_INCONSISTENT_COLUMNS').rowNumber, 2)
})

test('BOM is removed exactly once (bytes via core, raw text via csv-parse bom:true)', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('nome,email\nAna,ana@example.com\n')])
  const result = customers(bytes, { delimiter: ',' })
  assert.equal(result.parserPolicy.hadBom, true)
  assert.equal(result.mapping[0].canonicalHeader, 'nome')
  assert.equal(result.status, 'READY_FOR_REVIEW')
  const direct = parse('﻿nome,email\nAna,ana@example.com\n')
  assert.equal(direct.records[0][0], 'nome')
})

// ---- Limits ----------------------------------------------------------------------------------------------
test('giant logical record aborts inside the parser (max_record_size) → CSV_RECORD_TOO_LARGE', () => {
  const cell = 'a'.repeat(60000)
  const wide = `a,b,c,d,e\n${[cell, cell, cell, cell, cell].join(',')}\n`
  assert.deepEqual(parse(wide), { ok: false, failure: 'RECORD_TOO_LARGE', recordNumber: 2 })
  blocked(customers(wide, { delimiter: ',' }), 'CSV_RECORD_TOO_LARGE')
  // A single quoted field spanning thousands of lines is one logical record: still bounded.
  const multiline = `nome,obs\nAna,"${'linha\n'.repeat(50000)}"\n`
  const direct = parse(multiline)
  assert.equal(direct.ok, false)
  assert.equal(direct.failure, 'RECORD_TOO_LARGE')
  // An unterminated quote swallowing the rest of the file is also bounded (no unbounded buffer).
  const open = parse(`nome,obs\nAna,"${'x'.repeat(300000)}`)
  assert.equal(open.ok, false)
  assert.ok(['RECORD_TOO_LARGE', 'SYNTAX'].includes(open.failure))
})

test('row / column / cell limits abort during parsing through the real adapter', () => {
  const tooManyRows = 'nome\n' + 'x\n'.repeat(L.maxDataRows + 1)
  assert.deepEqual(parse(tooManyRows), { ok: false, failure: 'TOO_MANY_RECORDS', recordNumber: L.maxDataRows + 2 })
  blocked(customers(tooManyRows, { delimiter: ',' }), 'CSV_TOO_MANY_ROWS')
  const atLimit = parse('nome\n' + 'x\n'.repeat(L.maxDataRows))
  assert.equal(atLimit.ok, true)
  assert.equal(atLimit.records.length, L.maxDataRows + 1)

  const header = Array.from({ length: L.maxColumns + 1 }, (_, i) => `c${i}`).join(',')
  assert.deepEqual(parse(`${header}\n`), { ok: false, failure: 'TOO_MANY_COLUMNS', recordNumber: 1 })
  blocked(customers(`${header}\n${header}\n`, { delimiter: ',' }), 'CSV_TOO_MANY_COLUMNS')

  const width = L.maxColumns
  const line = new Array(width).fill('x').join(',') + '\n'
  const rowsForCells = L.maxTotalCells / width + 1
  const cells = parse(line.repeat(rowsForCells))
  assert.deepEqual(cells, { ok: false, failure: 'TOO_MANY_CELLS', recordNumber: rowsForCells })
})

// ---- Matrix-first / no casting -----------------------------------------------------------------------------
test('output is matrix-first string[][]: no casting, no dates, no trimming, no objects', () => {
  const direct = parse('id,qty,date,flag,empty,spaced\n007,1e3,2026-01-01,true,, a \n')
  assert.deepEqual(direct, { ok: true, records: [['id', 'qty', 'date', 'flag', 'empty', 'spaced'], ['007', '1e3', '2026-01-01', 'true', '', ' a ']] })
  for (const record of direct.records) {
    assert.ok(Array.isArray(record))
    assert.equal(Object.getPrototypeOf(record), Array.prototype)
    for (const cell of record) assert.equal(typeof cell, 'string')
  }
  assert.ok(Array.isArray(direct.records))
})

test('# lines are data (comments disabled); blank middle line is not silently dropped', () => {
  assert.deepEqual(parse('nome,obs\n#Ana,#1\n'), { ok: true, records: [['nome', 'obs'], ['#Ana', '#1']] })
  const blank = parse('nome,obs\n\nAna,1\n')
  assert.equal(blank.ok, false, 'a blank line in a 2-column file is a ragged record, not skipped')
})

// ---- Headers / reserved names ------------------------------------------------------------------------------
test('duplicate headers from the real parser are blocked by the header layer', () => {
  const result = customers('nome,Nome,email\nAna,Bia,ana@example.com\n', { delimiter: ',' })
  assert.equal(result.status, 'BLOCKED')
  assert.ok(has(result, 'DUPLICATE_HEADER'))
  assert.deepEqual(result.rows, [])
})

test('__proto__ / constructor / prototype headers stay array cells, are RESERVED, never object keys', () => {
  for (const header of ['__proto__', 'constructor', 'prototype']) {
    const csv = `nome,${header}\nAna,"{""polluted"":true}"\n`
    const direct = parse(csv)
    assert.deepEqual(direct, { ok: true, records: [['nome', header], ['Ana', '{"polluted":true}']] })
    const result = customers(csv, { delimiter: ',' })
    assert.equal(result.mapping[1].status, 'RESERVED', header)
    assert.ok(has(result, 'RESERVED_COLUMN'), header)
    assert.equal(result.status, 'USER_DECISION_REQUIRED')
    const forced = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: 'customer.email' }] })
    assert.equal(forced.mapping[1].status, 'RESERVED', `${header} cannot be mapped`)
    const ignored = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }] })
    assert.equal(ignored.status, 'READY_FOR_REVIEW')
    const values = ignored.rows[0].values
    assert.deepEqual(Object.keys(values), ['customer.name', 'customer.email', 'customer.phone'])
    assert.equal(values['customer.email'], null)
    assert.equal(values['customer.phone'], null)
    assert.ok(!Object.prototype.hasOwnProperty.call(values, header))
    assert.ok(!JSON.stringify(ignored.rows).includes('polluted'))
  }
  assert.equal({}.polluted, undefined)
  assert.equal(Object.prototype.polluted, undefined)
})

// ---- Values ----------------------------------------------------------------------------------------------
test('formula-like values survive the real parser inert (FORMULA_LIKE_TEXT / FIELD_FORMULA_NOT_ALLOWED)', () => {
  const people = customers('nome,email\n"=HYPERLINK(""http://x"")",\n+SUM(A1),\n@cmd,\n', { delimiter: ',' })
  assert.equal(people.rows[0].values['customer.name'], '=HYPERLINK("http://x")')
  assert.equal(people.rows[1].values['customer.name'], '+SUM(A1)')
  assert.equal(people.rows[2].values['customer.name'], '@cmd')
  for (const row of [2, 3, 4]) assert.ok(rowIssues(people, row).includes('FORMULA_LIKE_TEXT@customer.name'), String(row))
  const items = products('nome,preco\nCaneca,=1+1\n', { delimiter: ',' })
  assert.ok(has(items, 'FIELD_FORMULA_NOT_ALLOWED'))
  assert.equal(items.rows[0].status, 'INVALID')
})

test('+55 phone (quoted or not) is phone grammar, not a formula; BR normalization only with trusted region', () => {
  const csv = 'nome,telefone\nAna,"+55 (11) 99999-8888"\nBia,+55 11 99999-7777\n'
  const br = customers(csv, { delimiter: ',', phoneRegion: 'BR' })
  assert.equal(br.rows[0].values['customer.phone'], '+5511999998888')
  assert.equal(br.rows[1].values['customer.phone'], '+5511999997777')
  assert.ok(!br.issues.some((issue) => issue.code === 'FORMULA_LIKE_TEXT' || issue.code === 'FIELD_FORMULA_NOT_ALLOWED'))
  const neutral = customers(csv, { delimiter: ',' })
  assert.equal(neutral.rows[0].values['customer.phone'], '+55 (11) 99999-8888')
})

// ---- Error hygiene ---------------------------------------------------------------------------------------
test('failures expose no raw CSV, row content, PII, stack or library message', () => {
  const pii = 'Ana Souza,ana.souza@example.com,+5511999998888'
  for (const csv of [`nome,email,telefone\n"${pii}\n`, `nome,email,telefone\n${pii},extra\n`, `nome,email,telefone\n${pii.replace('Ana', 'A"na')}\n`]) {
    const direct = parse(csv)
    assert.equal(direct.ok, false)
    assert.deepEqual(Object.keys(direct).sort(), ['failure', 'ok', 'recordNumber'])
    const result = customers(csv, { delimiter: ',' })
    const serialized = JSON.stringify(result)
    for (const fragment of ['Souza', 'ana.souza', '5511999998888']) assert.ok(!serialized.includes(fragment), fragment)
    const visitDiagnostics = (value) => {
      if (!value || typeof value !== 'object') return
      for (const [key, nested] of Object.entries(value)) {
        assert.ok(!['message', 'stack', 'raw'].includes(key), `forbidden diagnostic key: ${key}`)
        visitDiagnostics(nested)
      }
    }
    // parserPolicy.raw=false is an intentional safe configuration flag, not retained CSV.
    // Error/issue payloads are the diagnostic surface that must never contain raw/message/stack.
    visitDiagnostics(result.issues)
  }
})

test('adapter refuses requests that did not come from the strict core contract', () => {
  const good = parserRequest('a,b\n1,2\n', ',')
  assert.equal(csvParseAdapter(good).ok, true)
  assert.deepEqual(csvParseAdapter({ ...good, delimiter: ':' }), { ok: false, failure: 'SYNTAX', recordNumber: null })
  assert.deepEqual(csvParseAdapter({ ...good, policy: { ...good.policy, relax_quotes: true } }), { ok: false, failure: 'SYNTAX', recordNumber: null })
  assert.deepEqual(csvParseAdapter(null), { ok: false, failure: 'SYNTAX', recordNumber: null })
})

test('real-parser dry run is deterministic and still a proposal only', () => {
  const csv = 'nome,email,telefone\n"Souza, Ana",ana@example.com,"+55 11 99999-8888"\n'
  const a = customers(csv, { phoneRegion: 'BR' })
  const b = customers(csv, { phoneRegion: 'BR' })
  assert.deepEqual(a, b)
  assert.equal(a.dryRun, true)
  assert.equal(a.notApplied, true)
  assert.equal(a.requiresUserConfirmation, true)
  assert.equal(a.automationPolicy, 'SUPPRESSED_BY_DEFAULT')
})
