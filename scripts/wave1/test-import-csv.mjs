// Wave 1 T3 — Import Engine CSV Pure Core: security contract tests (IMPORT_CSV_SECURITY_PREFLIGHT_REPORT).
//
// PARSER NOTE: the proven parser (csv-parse) could not be installed in the implementation environment.
// These tests exercise the core through TEST DOUBLES that live only in this file:
//   - naiveParser: unquoted CSV only (returns SYNTAX on any quote) — used for delimiter/limits/pipeline;
//   - fixtureParser: returns the matrix/failure csv-parse is documented to produce for quoted input.
// Real-parser syntax tests (quoted commas, escaped quotes, embedded newline, malformed quotes) are
// asserted here at the CONTRACT level and must be re-run against the pinned csv-parse adapter.
import './register-ts-resolve.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ie = await import('../../lib/import-engine/core/index.ts')
const { buildImportCsvManifest } = await import('../../lib/wave1/manifest.ts')
const { stableStringify } = await import('../../lib/wave1/shared/canonical.ts')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const hashes = {
  bytes: (input) => createHash('sha256').update(input).digest('hex'),
  text: (input) => createHash('sha256').update(input, 'utf8').digest('hex'),
}
const L = ie.IMPORT_LIMITS

// ---- Test doubles (NOT product code) -------------------------------------------------------------------
const requests = []
function naiveParser(request) {
  requests.push(request)
  if (request.text.includes('"')) return { ok: false, failure: 'SYNTAX', recordNumber: null }
  const lines = request.text.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  if (lines.length > request.limits.maxRecords) return { ok: false, failure: 'TOO_MANY_RECORDS', recordNumber: request.limits.maxRecords + 1 }
  const records = lines.map((line) => line.split(request.delimiter))
  const width = records[0].length
  for (let i = 0; i < records.length; i += 1) if (records[i].length !== width) return { ok: false, failure: 'INCONSISTENT_COLUMNS', recordNumber: i + 1 }
  return { ok: true, records }
}
function fixtureParser(fixtures) {
  return (request) => {
    requests.push(request)
    const key = `${request.delimiter}|${request.text}`
    return Object.prototype.hasOwnProperty.call(fixtures, key) ? fixtures[key] : { ok: false, failure: 'SYNTAX', recordNumber: null }
  }
}

const run = (input, options, parser = naiveParser) => ie.importCsvDryRun(input, options, { parser, hashes })
const customers = (csv, extra = {}) => run(csv, { entity: 'CUSTOMERS', ...extra })
const products = (csv, extra = {}) => run(csv, { entity: 'PRODUCTS', numberLocale: 'DOT', ...extra })
const codes = (result) => result.issues.map((issue) => issue.code)
const has = (result, code) => codes(result).includes(code)
const rowIssues = (result, rowNumber) => result.issues.filter((issue) => issue.rowNumber === rowNumber).map((issue) => `${issue.code}@${issue.columnId}`)
const encode = (text) => new TextEncoder().encode(text)

// ---- Delimiters / basic CSV --------------------------------------------------------------------------------
test('comma, semicolon, tab and pipe CSV are detected when exactly one candidate is viable', () => {
  for (const [delimiter, label] of [[',', 'comma'], [';', 'semicolon'], ['\t', 'tab'], ['|', 'pipe']]) {
    const csv = ['nome', 'email', 'telefone'].join(delimiter) + '\n' + ['Ana', 'ana@example.com', '11999998888'].join(delimiter) + '\n'
    const result = customers(csv)
    assert.equal(result.status, 'READY_FOR_REVIEW', label)
    assert.equal(result.parserPolicy.delimiter.status, 'DETECTED')
    assert.equal(result.parserPolicy.delimiter.delimiter, delimiter)
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].values['customer.name'], 'Ana')
  }
})

test('ambiguous delimiter → DELIMITER_AMBIGUOUS + USER_DECISION_REQUIRED; never "most columns"', () => {
  // Comma gives 2 columns, semicolon gives 3: both viable → user must choose.
  const csv = 'a;b,c;d\n1;2,3;4\n'
  const result = customers(csv)
  assert.equal(result.status, 'USER_DECISION_REQUIRED')
  assert.ok(has(result, 'DELIMITER_AMBIGUOUS') && has(result, 'USER_DECISION_REQUIRED'))
  assert.equal(result.parserPolicy.delimiter.status, 'AMBIGUOUS')
  assert.deepEqual([...result.parserPolicy.delimiter.viable], [',', ';'])
  assert.deepEqual(result.rows, [])
  // An explicit allowlisted choice resolves it; a non-allowlisted one is rejected.
  const chosen = customers('nome;email\nAna;ana@example.com\n', { delimiter: ';' })
  assert.equal(chosen.parserPolicy.delimiter.status, 'USER_SELECTED')
  assert.equal(customers('nome:email\nAna:x\n', { delimiter: ':' }).issues[0].code, 'DELIMITER_NOT_ALLOWED')
  // Single-column input has no viable candidate → undetected, user decides.
  assert.ok(has(customers('nome\nAna\n'), 'DELIMITER_UNDETECTED'))
  assert.equal(ie.ALLOWED_DELIMITERS.length, L.maxDelimiterCandidates)
})

test('delimiter detection reads a bounded sample of whole lines', () => {
  const line = 'Ana,ana@example.com,11999998888\n'
  const big = 'nome,email,telefone\n' + line.repeat(5000)
  assert.ok(ie.delimiterSample(big).length <= L.delimiterSampleBytes)
  assert.ok(ie.delimiterSample(big).endsWith('8888'))
  assert.equal(ie.delimiterSample('a,b\n1,2'), 'a,b\n1,2')
})

// ---- Parser contract (strict policy; csv-parse semantics via fixtures) ----------------------------------------
test('strict parser policy is exactly the mandated configuration and is what the parser receives', () => {
  const p = ie.STRICT_PARSER_POLICY
  assert.equal(p.cast, false)
  assert.equal(p.cast_date, false)
  assert.equal(p.bom, true)
  assert.equal(p.relax_quotes, false)
  assert.equal(p.relax_column_count, false)
  assert.equal(p.skip_records_with_error, false)
  assert.equal(p.comment, null)
  assert.equal(p.raw, false)
  assert.equal(p.columns, false)
  assert.equal(p.max_record_size, 256 * 1024)
  assert.ok(Object.isFrozen(p))
  requests.length = 0
  customers('nome,email\nAna,ana@example.com\n')
  assert.ok(requests.length > 0)
  for (const request of requests) {
    assert.equal(request.policy, ie.STRICT_PARSER_POLICY)
    assert.deepEqual(request.limits, { maxRecords: 25_001, maxColumns: 100, maxCells: 500_000, maxRecordBytes: 256 * 1024 })
  }
})

test('quoted commas, escaped quotes and embedded newlines are preserved as data (csv-parse fixture)', () => {
  const csv = 'nome,email\n"Silva, Ana ""Aninha""","ana@example.com"\n"Linha 1\nLinha 2",b@example.com\n'
  const parser = fixtureParser({
    [`,|${csv}`]: { ok: true, records: [['nome', 'email'], ['Silva, Ana "Aninha"', 'ana@example.com'], ['Linha 1\nLinha 2', 'b@example.com']] },
  })
  const result = run(csv, { entity: 'CUSTOMERS', delimiter: ',' }, parser)
  assert.equal(result.status, 'READY_FOR_REVIEW')
  assert.equal(result.rows[0].values['customer.name'], 'Silva, Ana "Aninha"')
  assert.equal(result.rows[1].values['customer.name'], 'Linha 1\nLinha 2')
  assert.equal(result.rows[1].rowNumber, 3, 'row identity = record number, not physical line')
})

test('malformed quote / inconsistent columns fail closed (no recovery, no skipped rows)', () => {
  const malformed = 'nome,email\n"Ana,ana@example.com\n'
  const result = run(malformed, { entity: 'CUSTOMERS', delimiter: ',' }, fixtureParser({ [`,|${malformed}`]: { ok: false, failure: 'SYNTAX', recordNumber: 2 } }))
  assert.equal(result.status, 'BLOCKED')
  assert.deepEqual(codes(result), ['CSV_SYNTAX_INVALID'])
  assert.deepEqual(result.rows, [])
  const inconsistent = customers('nome,email\nAna,a@example.com,extra\n', { delimiter: ',' })
  assert.equal(inconsistent.status, 'BLOCKED')
  assert.deepEqual(codes(inconsistent), ['CSV_INCONSISTENT_COLUMNS'])
  // The core re-verifies the matrix even if a parser is permissive.
  const lying = run('x', { entity: 'CUSTOMERS', delimiter: ',' }, () => ({ ok: true, records: [['nome', 'email'], ['Ana']] }))
  assert.deepEqual(codes(lying), ['CSV_INCONSISTENT_COLUMNS'])
  const throwing = run('x', { entity: 'CUSTOMERS', delimiter: ',' }, () => { throw new Error('secret row data ana@example.com') })
  assert.deepEqual(codes(throwing), ['CSV_SYNTAX_INVALID'])
  assert.ok(!JSON.stringify(throwing).includes('ana@example.com'))
})

test('parser contract violations and missing parser are reported, never trusted', () => {
  for (const bad of [null, 42, { ok: true, records: 'x' }, { ok: true, records: [['a', 1]] }, { ok: true, records: [[]] }, { ok: true, records: [['a'], 'b'] }, { ok: false, failure: 'WHATEVER' }, { ok: true, records: [['a', '\ud800']] }]) {
    const result = run('x', { entity: 'CUSTOMERS', delimiter: ',' }, () => bad)
    assert.equal(result.status, 'BLOCKED')
    assert.equal(codes(result)[0], 'CSV_PARSER_CONTRACT_VIOLATION', JSON.stringify(bad))
  }
  assert.deepEqual(codes(run('x', { entity: 'CUSTOMERS', delimiter: ',' }, () => ({ ok: true, records: [] }))), ['CSV_EMPTY'])
  const noParser = ie.importCsvDryRun('nome,email\nAna,a@example.com\n', { entity: 'CUSTOMERS' }, { hashes })
  assert.equal(noParser.status, 'BLOCKED')
  assert.ok(has(noParser, 'CSV_PARSER_UNAVAILABLE'))
  assert.equal(ie.importCsvDryRun('nome,email\n', { entity: 'CUSTOMERS', delimiter: ',' }, { hashes }).issues[0].code, 'CSV_PARSER_UNAVAILABLE')
  for (const [failure, code] of [['RECORD_TOO_LARGE', 'CSV_RECORD_TOO_LARGE'], ['TOO_MANY_COLUMNS', 'CSV_TOO_MANY_COLUMNS'], ['TOO_MANY_CELLS', 'CSV_TOO_MANY_CELLS'], ['TOO_MANY_RECORDS', 'CSV_TOO_MANY_ROWS']]) {
    assert.deepEqual(codes(run('x', { entity: 'CUSTOMERS', delimiter: ',' }, () => ({ ok: false, failure, recordNumber: 9 }))), [code])
  }
})

// ---- Encoding --------------------------------------------------------------------------------------------------
test('UTF-8 BOM is accepted and removed; exact bytes still fingerprinted', () => {
  const csv = 'nome,email\nAna,ana@example.com\n'
  const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(csv)])
  const result = customers(withBom)
  assert.equal(result.status, 'READY_FOR_REVIEW')
  assert.equal(result.parserPolicy.hadBom, true)
  assert.equal(result.mapping[0].sourceHeader, 'nome')
  assert.equal(result.inputFingerprint, hashes.bytes(withBom))
  assert.notEqual(result.inputFingerprint, customers(encode(csv)).inputFingerprint)
  assert.equal(customers('﻿' + csv).parserPolicy.hadBom, true)
})

test('invalid UTF-8, NUL, binary controls and unsupported input types are rejected (no guessing)', () => {
  const latin1 = new Uint8Array([...encode('nome,email\nJos'), 0xe9, ...encode(',j@example.com\n')])
  assert.deepEqual(codes(customers(latin1)), ['CSV_INVALID_UTF8'])
  assert.deepEqual(codes(customers(new Uint8Array([...encode('nome,email\nA'), 0x00, ...encode(',x\n')]))), ['CSV_NUL_BYTE'])
  assert.deepEqual(codes(customers('nome,email\nA\u0000,x\n')), ['CSV_NUL_BYTE'])
  for (const control of ['\u0001', '\u0008', '\u000b', '\u000c', '\u001b', '\u007f']) assert.deepEqual(codes(customers(`nome,email\nA${control},x\n`)), ['CSV_BINARY_CONTENT'], JSON.stringify(control))
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.deepEqual(codes(customers(png)), ['CSV_INVALID_UTF8'])
  assert.deepEqual(codes(customers('nome\ud800,email\n')), ['CSV_INVALID_UTF8'])
  for (const bad of [42, null, { text: 'a,b' }, new ArrayBuffer(4)]) assert.deepEqual(codes(customers(bad)), ['CSV_ENCODING_UNSUPPORTED'])
  assert.deepEqual(codes(customers('')), ['CSV_EMPTY'])
  assert.deepEqual(codes(customers(new Uint8Array([0xef, 0xbb, 0xbf]))), ['CSV_EMPTY'])
  // Tab/CR/LF remain allowed.
  assert.equal(customers('nome\temail\r\nAna\tana@example.com\r\n').status, 'READY_FOR_REVIEW')
})

// ---- Limits -------------------------------------------------------------------------------------------------------
test('byte limit: exactly 10 MiB passes the gate, 10 MiB + 1 is rejected before parsing', () => {
  requests.length = 0
  const over = new Uint8Array(L.maxInputBytes + 1).fill(0x61)
  const result = customers(over)
  assert.deepEqual(codes(result), ['CSV_INPUT_TOO_LARGE'])
  assert.equal(requests.length, 0, 'parser never invoked for oversized input')
  assert.equal(result.inputFingerprint, null)
  const exact = new Uint8Array(L.maxInputBytes).fill(0x61)
  assert.ok(!has(customers(exact), 'CSV_INPUT_TOO_LARGE'))
  assert.deepEqual(codes(customers('é'.repeat(L.maxInputBytes / 2 + 1))), ['CSV_INPUT_TOO_LARGE'], 'string input measured in UTF-8 bytes')
})

test('row limit: 25,000 data rows accepted; 25,001 rejected (core re-verifies the parser)', () => {
  const header = 'nome,email\n'
  const ok = header + 'Ana,\n'.repeat(L.maxDataRows)
  const okResult = customers(ok, { delimiter: ',' })
  assert.equal(okResult.summary.dataRows, 25_000)
  assert.ok(!has(okResult, 'CSV_TOO_MANY_ROWS'))
  assert.deepEqual(codes(customers(header + 'Ana,\n'.repeat(L.maxDataRows + 1), { delimiter: ',' })), ['CSV_TOO_MANY_ROWS'])
  const permissive = () => ({ ok: true, records: [['nome', 'email'], ...Array.from({ length: L.maxDataRows + 1 }, () => ['Ana', ''])] })
  assert.deepEqual(codes(run('x', { entity: 'CUSTOMERS', delimiter: ',' }, permissive)), ['CSV_TOO_MANY_ROWS'])
})

test('column limit: 100 columns accepted, 101 rejected', () => {
  const cols = (n) => Array.from({ length: n }, (_, i) => `c${i}`).join(',')
  const hundred = customers(`${cols(100)}\n${cols(100)}\n`, { delimiter: ',' })
  assert.ok(!has(hundred, 'CSV_TOO_MANY_COLUMNS'))
  assert.deepEqual(codes(customers(`${cols(101)}\n${cols(101)}\n`, { delimiter: ',' })), ['CSV_TOO_MANY_COLUMNS'])
})

test('total-cell limit: 500,000 accepted, 500,001+ rejected', () => {
  const at = () => ({ ok: true, records: Array.from({ length: 5000 }, () => Array.from({ length: 100 }, () => 'x')) })
  assert.ok(ie.parseCsvMatrix('x', ',', at).ok)
  const over = () => ({ ok: true, records: Array.from({ length: 5001 }, () => Array.from({ length: 100 }, () => 'x')) })
  const result = ie.parseCsvMatrix('x', ',', over)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'CSV_TOO_MANY_CELLS')
})

test('giant cell (chars and UTF-8 bytes) and oversized record are rejected', () => {
  const charLimit = 'a'.repeat(L.maxCellChars)
  assert.ok(ie.parseCsvMatrix('x', ',', () => ({ ok: true, records: [['nome', 'b'], [charLimit, 'x']] })).ok)
  const tooManyChars = ie.parseCsvMatrix('x', ',', () => ({ ok: true, records: [['nome', 'b'], ['a'.repeat(L.maxCellChars + 1), 'x']] }))
  assert.deepEqual([tooManyChars.code, tooManyChars.rowNumber, tooManyChars.columnIndex], ['CSV_CELL_TOO_LONG', 2, 0])
  const tooManyBytes = ie.parseCsvMatrix('x', ',', () => ({ ok: true, records: [['nome', 'b'], ['😀'.repeat(16385), 'x']] }))
  assert.equal(tooManyBytes.code, 'CSV_CELL_TOO_LONG')
  // 5 cells × 20,000 three-byte chars = 300,000 bytes: each cell within limits, the record is not.
  const record = ie.parseCsvMatrix('x', ',', () => ({ ok: true, records: [['a', 'b', 'c', 'd', 'e'], Array.from({ length: 5 }, () => '€'.repeat(20000))] }))
  assert.equal(record.code, 'CSV_RECORD_TOO_LARGE')
  // The code is surfaced by the dry run with safe metadata only.
  const giant = 'nome,email\n' + 'a'.repeat(L.maxCellChars + 1) + ',x\n'
  const result = customers(giant, { delimiter: ',' })
  assert.deepEqual(result.issues, [{ code: 'CSV_CELL_TOO_LONG', severity: 'error', rowNumber: 2, columnId: 'col:0' }])
})

test('issue cap: at most 2,000 issue objects, aggregate counters keep counting, diagnosticsTruncated', () => {
  const csv = 'nome,email\n' + 'Ana,not-an-email\n'.repeat(3000)
  const result = customers(csv, { delimiter: ',' })
  assert.equal(result.issues.length, L.maxIssuesRetained)
  assert.equal(result.issueTotals.INVALID_EMAIL, 3000)
  assert.equal(result.diagnosticsTruncated, true)
  assert.equal(result.summary.invalidRows, 3000)
  const small = customers('nome,email\nAna,bad\n', { delimiter: ',' })
  assert.equal(small.diagnosticsTruncated, false)
})

test('duplicate diagnostics cap: at most 1,000 groups retained, totals preserved', () => {
  const lines = ['nome,email']
  for (let i = 0; i < 1500; i += 1) lines.push(`Pessoa ${i},p${i}@example.com`, `Pessoa ${i} B,p${i}@example.com`)
  const result = customers(lines.join('\n') + '\n', { delimiter: ',' })
  assert.equal(result.summary.duplicateGroups, 1500)
  assert.equal(result.duplicateCandidates.length + result.conflicts.length, L.maxDuplicateDiagnosticsRetained)
  assert.equal(result.diagnosticsTruncated, true)
})

// ---- Headers ------------------------------------------------------------------------------------------------------
test('headers: empty, too long, duplicate (exact and case/whitespace/NFC) are blocking — never last-wins', () => {
  assert.deepEqual(codes(customers('nome,,email\nA,b,c\n', { delimiter: ',' })), ['HEADER_EMPTY'])
  assert.deepEqual(codes(customers('nome,   ,email\nA,b,c\n', { delimiter: ',' })), ['HEADER_EMPTY'])
  const long = 'h'.repeat(L.maxHeaderChars + 1)
  assert.deepEqual(codes(customers(`nome,${long}\nA,b\n`, { delimiter: ',' })), ['HEADER_TOO_LONG'])
  assert.ok(!has(customers(`nome,${'h'.repeat(L.maxHeaderChars)}\nA,b\n`, { delimiter: ',' }), 'HEADER_TOO_LONG'))
  const dup = customers('Email,nome, email \na@example.com,Ana,b@example.com\n', { delimiter: ',' })
  assert.equal(dup.status, 'BLOCKED')
  assert.deepEqual(dup.issues.map((issue) => `${issue.code}@${issue.columnId}`), ['DUPLICATE_HEADER@col:0', 'DUPLICATE_HEADER@col:2'])
  assert.deepEqual(dup.rows, [])
  assert.equal(customers('EMAIL,nome,e-mail\nx,y,z\n', { delimiter: ',' }).status, 'USER_DECISION_REQUIRED', 'different canonical headers mapping to the same destination')
  const nfc = customers('Descrição,nome,Descrição\nx,y,z\n', { delimiter: ',' })
  assert.ok(has(nfc, 'DUPLICATE_HEADER'), 'NFC-equivalent headers collide')
  assert.equal(ie.canonicalHeader('  Nome   do\tCliente '), 'nome do cliente')
})

// ---- Mapping / allowlists / reserved ---------------------------------------------------------------------------------
test('unknown column → UNKNOWN_COLUMN + USER_DECISION_REQUIRED; explicit ignore resolves it', () => {
  const csv = 'nome,apelido\nAna,Aninha\n'
  const result = customers(csv, { delimiter: ',' })
  assert.equal(result.status, 'USER_DECISION_REQUIRED')
  assert.deepEqual([...codes(result)].sort(), ['UNKNOWN_COLUMN', 'USER_DECISION_REQUIRED'])
  assert.equal(result.mapping[1].status, 'UNKNOWN')
  assert.deepEqual(result.rows, [])
  const ignored = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }] })
  assert.equal(ignored.status, 'READY_FOR_REVIEW')
  assert.equal(ignored.mapping[1].decisionSource, 'IGNORED')
  assert.deepEqual(Object.keys(ignored.rows[0].values), ['customer.name', 'customer.email', 'customer.phone'])
  // Mapping an unknown column to an allowlisted destination.
  const mapped = customers('nome,correio\nAna,ana@example.com\n', { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: 'customer.email' }] })
  assert.equal(mapped.mapping[1].decisionSource, 'USER_SELECTED')
  assert.equal(mapped.rows[0].values['customer.email'], 'ana@example.com')
})

test('reserved/internal columns (company_id, tenant, metadata, secrets, automation) can only be ignored', () => {
  for (const header of ['company_id', 'Company ID', 'tenant_id', 'owner_id', 'user_id', 'id', 'metadata', 'created_at', 'email_normalized', 'api_key', 'access_token', 'plan', 'trigger_automation', 'source_id']) {
    const csv = `nome,${header}\nAna,00000000-0000-4000-8000-000000000009\n`
    const result = customers(csv, { delimiter: ',' })
    assert.equal(result.mapping[1].status, 'RESERVED', header)
    assert.ok(has(result, 'RESERVED_COLUMN'), header)
    const forced = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: 'customer.email' }] })
    assert.equal(forced.mapping[1].status, 'RESERVED', `${header} cannot be mapped even by the user`)
    assert.equal(forced.status, 'USER_DECISION_REQUIRED')
    const ignored = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }] })
    assert.equal(ignored.status, 'READY_FOR_REVIEW')
    assert.ok(!JSON.stringify(ignored.rows).includes('00000000-0000-4000-8000-000000000009'), `${header} value never enters a record`)
  }
  for (const header of ['business_type', 'custo', 'configuracoes', 'extras', 'variacoes', 'adicionais', 'variations', 'addons']) {
    assert.equal(products(`nome,preco,${header}\nX,1,y\n`, { delimiter: ',' }).mapping[2].status, 'RESERVED', header)
  }
})

test('__proto__, constructor and prototype headers never become object keys (no prototype pollution)', () => {
  for (const header of ['__proto__', 'constructor', 'prototype']) {
    const csv = `nome,${header}\nAna,{polluted:true}\n`
    const result = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }] })
    assert.equal(result.status, 'READY_FOR_REVIEW', header)
    assert.equal(({}).polluted, undefined)
    assert.equal(Object.prototype.polluted, undefined)
    for (const row of result.rows) {
      assert.deepEqual(Object.keys(row.values), ['customer.name', 'customer.email', 'customer.phone'])
      assert.equal(Object.getPrototypeOf(row.values), Object.prototype)
    }
    assert.equal(customers(csv, { delimiter: ',' }).mapping[1].status, 'RESERVED')
  }
  const hostile = customers('nome,email\nAna,a@example.com\n', { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: '__proto__' }] })
  assert.ok(has(hostile, 'UNSUPPORTED_FIELD'))
  assert.equal(ie.destinationFor('CUSTOMERS', '__proto__'), null)
  assert.equal(ie.destinationFor('CUSTOMERS', 'constructor'), null)
})

test('allowlists: only 3 customer and 8 product destinations; company_id / document / address never allowed', () => {
  assert.deepEqual(ie.DESTINATIONS.CUSTOMERS.map((field) => field.id), ['customer.name', 'customer.email', 'customer.phone'])
  assert.deepEqual(ie.DESTINATIONS.PRODUCTS.map((field) => field.id), ['product.name', 'product.sku', 'product.price', 'product.stock', 'product.description', 'product.category', 'product.active', 'product.price_on_request'])
  for (const forbidden of ['company_id', 'customer.company_id', 'customer.document', 'customer.address', 'customer.notes', 'customer.metadata', 'product.cost', 'product.company_id', 'product.business_type', 'product.variations', 'product.configuracoes']) {
    assert.equal(ie.destinationFor('CUSTOMERS', forbidden), null, forbidden)
    assert.equal(ie.destinationFor('PRODUCTS', forbidden), null, forbidden)
  }
  assert.equal(ie.destinationFor('CUSTOMERS', 'product.name'), null, 'destinations are entity-scoped')
  const result = customers('nome,cpf\nAna,123\n', { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: 'customer.document' }] })
  assert.ok(has(result, 'UNSUPPORTED_FIELD'))
  assert.equal(result.mapping[1].status, 'INVALID')
})

test('ambiguous alias → AMBIGUOUS_COLUMN_MAPPING; never auto-resolved; user decides', () => {
  const csv = 'nome,contato\nAna,ana@example.com\n'
  const result = customers(csv, { delimiter: ',' })
  assert.equal(result.status, 'USER_DECISION_REQUIRED')
  assert.equal(result.mapping[1].status, 'AMBIGUOUS')
  assert.deepEqual([...result.mapping[1].candidates], ['customer.email', 'customer.phone'])
  assert.equal(result.mapping[1].destinationField, null)
  assert.ok(has(result, 'AMBIGUOUS_COLUMN_MAPPING'))
  const decided = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'MAP', destinationField: 'customer.email' }] })
  assert.equal(decided.status, 'READY_FOR_REVIEW')
  // Two columns into one destination: neither wins.
  const twice = customers('nome,email,e-mail\nAna,a@example.com,b@example.com\n', { delimiter: ',' })
  assert.ok(has(twice, 'DUPLICATE_DESTINATION_MAPPING'))
  assert.deepEqual(twice.mapping.slice(1).map((entry) => entry.status), ['AMBIGUOUS', 'AMBIGUOUS'])
  // Required destination missing.
  assert.ok(has(customers('email,telefone\na@example.com,11999998888\n', { delimiter: ',' }), 'MISSING_REQUIRED_FIELD'))
  // Invalid decisions are rejected, not guessed.
  const bad = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 9, action: 'MAP', destinationField: 'customer.email' }, { sourceIndex: 1, action: 'MERGE' }, 'x'] })
  assert.equal(bad.issues.filter((issue) => issue.code === 'INVALID_MAPPING_DECISION').length, 3)
  assert.ok(has(customers(csv, { delimiter: ',', mappingDecisions: 'all' }), 'INVALID_MAPPING_DECISION'))
  const twiceDecided = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }, { sourceIndex: 1, action: 'IGNORE' }] })
  assert.ok(has(twiceDecided, 'INVALID_MAPPING_DECISION'))
})

test('no fuzzy auto-mapping: near-miss headers stay UNKNOWN', () => {
  for (const header of ['emial', 'nomes', 'telefone1', 'e_mail_do_cliente', 'Email:']) {
    assert.equal(customers(`nome,${header}\nAna,x\n`, { delimiter: ',' }).mapping[1].status, 'UNKNOWN', header)
  }
  assert.ok(ie.aliasRegistrySize('CUSTOMERS') < 64 && ie.aliasRegistrySize('PRODUCTS') < 64, 'bounded alias registry')
})

// ---- Formula safety -------------------------------------------------------------------------------------------------
test('formula-like text (= + - @) is preserved inert with FORMULA_LIKE_TEXT; never prefixed or evaluated', () => {
  for (const value of ['=HYPERLINK("http://x")', '+SUM(A1)', '-2+3', '@cmd', '   =1+1']) {
    const csv = `nome,email\n${value.replace(/"/g, '')},\n`
    const result = customers(csv, { delimiter: ',' })
    const stored = value.replace(/"/g, '').trim()
    assert.equal(result.rows[0].values['customer.name'], stored)
    assert.ok(!String(result.rows[0].values['customer.name']).startsWith("'"))
    assert.ok(rowIssues(result, 2).includes('FORMULA_LIKE_TEXT@customer.name'), value)
    assert.equal(result.rows[0].status, 'VALID_WITH_WARNINGS')
  }
  assert.equal(ie.formulaTrigger('  @x'), '@')
  assert.equal(ie.formulaTrigger('abc'), null)
})

test('numeric destinations: formulas not allowed; negative literal parses but price/stock reject it', () => {
  const csv = 'nome,preco,estoque\nA,=10+5,1\nB,+5,2\nC,@SUM,3\nD,-10,4\nE,10,-3\nF,10,=A1\nG,-,1\nH,10,-\n'
  const result = products(csv, { delimiter: ',' })
  assert.ok(rowIssues(result, 2).includes('FIELD_FORMULA_NOT_ALLOWED@product.price'))
  assert.ok(rowIssues(result, 3).includes('FIELD_FORMULA_NOT_ALLOWED@product.price'))
  assert.ok(rowIssues(result, 4).includes('FIELD_FORMULA_NOT_ALLOWED@product.price'))
  assert.deepEqual(rowIssues(result, 5), ['NEGATIVE_NOT_ALLOWED@product.price'])
  assert.deepEqual(rowIssues(result, 6), ['NEGATIVE_NOT_ALLOWED@product.stock'])
  assert.ok(rowIssues(result, 7).includes('FIELD_FORMULA_NOT_ALLOWED@product.stock'))
  assert.ok(rowIssues(result, 8).includes('FIELD_FORMULA_NOT_ALLOWED@product.price'))
  assert.ok(rowIssues(result, 9).includes('FIELD_FORMULA_NOT_ALLOWED@product.stock'))
  assert.deepEqual(ie.parseDecimalValue('-10', 'DOT'), { ok: true, value: '10', negative: true }, 'negative is lexically valid')
  assert.equal(result.rows.every((row) => row.status === 'INVALID'), true)
  const booleanFormula = products('nome,preco,ativo\nX,1,=TRUE()\n', { delimiter: ',' })
  assert.ok(rowIssues(booleanFormula, 2).includes('FIELD_FORMULA_NOT_ALLOWED@product.active'))
})

test('valid +55 phone follows phone grammar (not formula); BR normalization only with trusted region', () => {
  const csv = 'nome,telefone\nAna,+55 (11) 99999-8888\nBia,11 99999-7777\nCai,+1 415 555 0100\n'
  const br = customers(csv, { delimiter: ',', phoneRegion: 'BR' })
  assert.equal(br.rows[0].values['customer.phone'], '+5511999998888')
  assert.equal(br.rows[1].values['customer.phone'], '+5511999997777')
  assert.ok(rowIssues(br, 4).includes('INVALID_PHONE@customer.phone'), 'non-BR number under BR policy')
  assert.ok(!br.issues.some((issue) => issue.code === 'FORMULA_LIKE_TEXT' || issue.code === 'FIELD_FORMULA_NOT_ALLOWED'))
  const neutral = customers(csv, { delimiter: ',' })
  assert.equal(neutral.rows[0].values['customer.phone'], '+55 (11) 99999-8888', 'no region inferred from CSV')
  assert.equal(neutral.rows[2].status, 'VALID')
  for (const bad of ['=11999998888', '12', '11 9999 8888 ext 3', '55+11999998888']) assert.equal(ie.parsePhoneValue(bad, 'BR'), null, bad)
  assert.equal(ie.parsePhoneValue('5511999998888', 'BR').value, '+5511999998888')
  assert.equal(ie.parsePhoneValue('+5411999998888', 'BR'), null)
  assert.equal(ie.parsePhoneValue('01199999888', 'BR'), null)
  assert.equal(ie.parsePhoneValue('1109999888', 'BR'), null)
  assert.equal(ie.parsePhoneValue('11899998888', 'BR'), null, '11-digit mobile must start with 9')
  assert.equal(ie.parsePhoneValue('1133334444', 'BR').value, '+551133334444')
})

// ---- Normalization / values -----------------------------------------------------------------------------------------------
test('"false" is false: closed boolean vocabulary, case-insensitive; everything else INVALID_BOOLEAN', () => {
  for (const [raw, expected] of [['false', false], ['FALSE', false], [' False ', false], ['0', false], ['não', false], ['NÃO', false], ['no', false], ['true', true], ['1', true], ['Sim', true], ['YES', true], ['', null]]) {
    assert.equal(ie.parseBooleanValue(raw), expected, raw)
  }
  for (const raw of ['f', 'verdadeiro', 'nao', 'y', '2', 'null', 'off', 'on']) assert.equal(ie.parseBooleanValue(raw), 'INVALID', raw)
  const result = products('nome,preco,ativo,sob consulta\nX,1,false,false\nY,1,talvez,0\n', { delimiter: ',' })
  assert.equal(result.rows[0].values['product.active'], false)
  assert.ok(rowIssues(result, 3).includes('INVALID_BOOLEAN@product.active'))
})

test('decimal: explicit DOT/COMMA convention; 1,234 never guessed; currency and thousands rejected', () => {
  assert.deepEqual(ie.parseDecimalValue('1,234', 'DOT'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('1.234', 'COMMA'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('1,234', 'UNSPECIFIED'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('1.234,50', 'COMMA'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('1,234.50', 'DOT'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('1.234.567', 'DOT'), { ok: false, code: 'NUMBER_FORMAT_AMBIGUOUS' })
  assert.deepEqual(ie.parseDecimalValue('12.50', 'DOT'), { ok: true, value: '12.5', negative: false })
  assert.deepEqual(ie.parseDecimalValue('12,50', 'COMMA'), { ok: true, value: '12.5', negative: false })
  assert.deepEqual(ie.parseDecimalValue('0012', 'UNSPECIFIED'), { ok: true, value: '12', negative: false })
  assert.deepEqual(ie.parseDecimalValue('0.00', 'DOT'), { ok: true, value: '0', negative: false })
  for (const bad of ['R$ 10', '$10', '10 reais', '1e3', 'Infinity', 'NaN', '10.', '.5', '0x10', '١٢', '10,5.', '1 000']) {
    const parsed = ie.parseDecimalValue(bad, 'DOT')
    assert.equal(parsed.ok, false, bad)
  }
  assert.deepEqual(ie.parseDecimalValue('1234567890123', 'DOT'), { ok: false, code: 'INVALID_DECIMAL' })
  assert.deepEqual(ie.parseDecimalValue('1.12345', 'DOT'), { ok: false, code: 'INVALID_DECIMAL' })
  const result = products('nome,preco\nX,"1,234"\n'.replace(/"/g, ''), { delimiter: ';', numberLocale: 'DOT' })
  assert.equal(result.status, 'USER_DECISION_REQUIRED')
  const semicolon = products('nome;preco\nX;1,234\n', { delimiter: ';', numberLocale: 'DOT' })
  assert.ok(rowIssues(semicolon, 2).includes('NUMBER_FORMAT_AMBIGUOUS@product.price'))
  assert.ok(!/\bNumber\(|\bBoolean\(|parseFloat|toFixed/.test(readFileSync(path.join(root, 'lib/import-engine/core/values.ts'), 'utf8').replace(/\/\/.*$/gm, '')))
})

test('stock is a non-negative integer (no floats, no units); SKU is opaque (leading zeros, case, spaces kept)', () => {
  const csv = 'nome,sku,preco,estoque\nA,000123,1,10\nB,abc-XY,1,1.5\nC, 0042 ,1,10un\nD,,1,\nE,x,1,1234567890\n'
  const result = products(csv, { delimiter: ',' })
  assert.equal(result.rows[0].values['product.sku'], '000123')
  assert.equal(result.rows[0].values['product.stock'], 10)
  assert.equal(result.rows[1].values['product.sku'], 'abc-XY')
  assert.ok(rowIssues(result, 3).includes('INVALID_INTEGER@product.stock'))
  assert.equal(result.rows[2].values['product.sku'], ' 0042 ')
  assert.ok(rowIssues(result, 4).includes('INVALID_INTEGER@product.stock'))
  assert.equal(result.rows[3].values['product.sku'], null)
  assert.equal(result.rows[3].values['product.stock'], null, 'absent stock = tracking absent (null), never 0')
  assert.ok(rowIssues(result, 6).includes('INVALID_INTEGER@product.stock'))
})

test('price rules: required unless price_on_request = true; absent flag is not true', () => {
  const csv = 'nome,preco,sob consulta\nA,10.5,\nB,,true\nC,,false\nD,,\nE,0,\n'
  const result = products(csv, { delimiter: ',' })
  assert.equal(result.rows[0].values['product.price'], '10.5')
  assert.equal(result.rows[1].status, 'VALID')
  assert.ok(rowIssues(result, 4).includes('MISSING_REQUIRED_FIELD@product.price'))
  assert.ok(rowIssues(result, 5).includes('MISSING_REQUIRED_FIELD@product.price'))
  assert.equal(result.rows[4].values['product.price'], '0')
  const noColumn = products('nome,estoque\nA,1\n', { delimiter: ',' })
  assert.ok(rowIssues(noColumn, 2).includes('MISSING_REQUIRED_FIELD@product.price'))
})

test('empty/null: empty cell → null only; "null", "N/A", "undefined" stay literal text; required empty → error', () => {
  const csv = 'nome,descricao,categoria,preco\nX,null,N/A,1\nY,,undefined,1\n,d,c,1\n   ,d,c,1\n'
  const result = products(csv, { delimiter: ',' })
  assert.equal(result.rows[0].values['product.description'], 'null')
  assert.equal(result.rows[0].values['product.category'], 'N/A')
  assert.equal(result.rows[1].values['product.description'], null)
  assert.equal(result.rows[1].values['product.category'], 'undefined')
  assert.ok(rowIssues(result, 4).includes('MISSING_REQUIRED_FIELD@product.name'))
  assert.ok(rowIssues(result, 5).includes('MISSING_REQUIRED_FIELD@product.name'), 'whitespace-only name is empty after field trim')
  // Description keeps whitespace exactly (no generic trim); NFC applied, never NFKC.
  const desc = products('nome,descricao,preco\nX,  espaços  ,1\nY,ﬁ ①,1\n', { delimiter: ',' })
  assert.equal(desc.rows[0].values['product.description'], '  espaços  ')
  assert.equal(desc.rows[1].values['product.description'], 'ﬁ ①', 'NFKC would have changed this')
})

test('text limits, markup and email grammar (no correction)', () => {
  const longName = 'n'.repeat(201)
  const result = customers(`nome,email\n${longName},a@example.com\nAna,<script>x</script>@x.com\nBia,bia@gmial.con\n`, { delimiter: ',' })
  assert.deepEqual(result.issues.find((issue) => issue.rowNumber === 2), { code: 'VALUE_TOO_LONG', severity: 'error', rowNumber: 2, columnId: 'customer.name', params: { maxChars: 200, valueLength: 201, valueType: 'string' } })
  assert.equal(result.rows[1].status, 'INVALID')
  assert.equal(result.rows[2].values['customer.email'], 'bia@gmial.con', 'typos are not "fixed"')
  const markup = customers('nome,email\n<img src=x onerror=alert(1)>,\n', { delimiter: ',' })
  assert.equal(markup.rows[0].values['customer.name'], '<img src=x onerror=alert(1)>')
  assert.ok(has(markup, 'POTENTIAL_MARKUP_TEXT'))
  for (const ok of ['a@b.co', 'a.b+c@x-y.example.com', 'A@EXAMPLE.COM']) assert.ok(ie.isValidEmail(ok), ok)
  for (const bad of ['a', '@x.com', 'a@', 'a@b', 'a@@b.com', 'a..b@x.com', '.a@x.com', 'a.@x.com', 'a@-x.com', 'a@x.c', 'a b@x.com', 'a@x_y.com', `${'a'.repeat(65)}@x.com`, `a@${'b'.repeat(250)}.com`]) assert.ok(!ie.isValidEmail(bad), bad)
  assert.equal(ie.emailKey('  Ana@Example.COM '), 'ana@example.com')
})

// ---- PII / error safety ------------------------------------------------------------------------------------------------------
test('diagnostics never contain PII values, raw rows or raw CSV (only lengths/types)', () => {
  const secret = 'joao.secret@exemplo'
  const csv = `nome,email,telefone\nJoão Segredo,${secret},12\n`
  const result = customers(csv, { delimiter: ',', phoneRegion: 'BR' })
  const diagnostics = JSON.stringify({ issues: result.issues, totals: result.issueTotals, duplicates: result.duplicateCandidates, conflicts: result.conflicts, summary: result.summary, mapping: result.mapping })
  for (const fragment of [secret, 'Segredo', 'João']) assert.ok(!diagnostics.includes(fragment), fragment)
  const emailIssue = result.issues.find((issue) => issue.code === 'INVALID_EMAIL')
  assert.deepEqual(emailIssue.params, { valueLength: secret.length, valueType: 'string' })
  // The explicit dry-run preview may contain parsed values (not diagnostics): the valid name is there.
  assert.equal(result.rows[0].values['customer.name'], 'João Segredo')
  for (const issue of result.issues) assert.deepEqual(Object.keys(issue).filter((key) => !['code', 'severity', 'rowNumber', 'columnId', 'params'].includes(key)), [])
})

test('issue vocabulary is closed and every emitted code belongs to it', () => {
  const vocabulary = new Set(ie.ISSUE_CODES)
  for (const code of ['CSV_INPUT_TOO_LARGE', 'CSV_INVALID_UTF8', 'CSV_BINARY_CONTENT', 'CSV_NUL_BYTE', 'CSV_SYNTAX_INVALID', 'CSV_TOO_MANY_ROWS', 'CSV_TOO_MANY_COLUMNS', 'CSV_TOO_MANY_CELLS', 'CSV_RECORD_TOO_LARGE', 'CSV_CELL_TOO_LONG', 'HEADER_EMPTY', 'HEADER_TOO_LONG', 'DUPLICATE_HEADER', 'DELIMITER_AMBIGUOUS', 'UNKNOWN_COLUMN', 'RESERVED_COLUMN', 'AMBIGUOUS_COLUMN_MAPPING', 'USER_DECISION_REQUIRED', 'MISSING_REQUIRED_FIELD', 'INVALID_BOOLEAN', 'INVALID_DECIMAL', 'NUMBER_FORMAT_AMBIGUOUS', 'FORMULA_LIKE_TEXT', 'FIELD_FORMULA_NOT_ALLOWED', 'INVALID_EMAIL', 'INVALID_PHONE', 'EXACT_DUPLICATE_ROW', 'STRONG_DUPLICATE_CANDIDATE', 'WEAK_DUPLICATE_CANDIDATE', 'IDENTITY_CONFLICT', 'DUPLICATE_SKU_CANDIDATE', 'SKU_CONFLICT', 'VALUE_TOO_LONG', 'INVALID_VALUE_TYPE', 'UNSUPPORTED_FIELD']) {
    assert.ok(vocabulary.has(code), code)
  }
  const samples = [customers('nome,contato\nA,x\n', { delimiter: ',' }), products('nome,preco,estoque\n=A,-1,1.5\n', { delimiter: ',' }), customers('nome,email,telefone\nA,bad,1\n', { delimiter: ',', phoneRegion: 'BR' })]
  for (const sample of samples) for (const issue of sample.issues) assert.ok(vocabulary.has(issue.code), issue.code)
})

// ---- Duplicates / conflicts ------------------------------------------------------------------------------------------------
test('customers: exact duplicate row, strong email/phone candidates, name-only weak — never merged', () => {
  const csv = [
    'nome,email,telefone',
    'Ana,ana@example.com,11999990001', // 2
    'Ana,ana@example.com,11999990001', // 3 exact of 2
    'Ana Paula, ANA@example.com ,', //    4 same email (case/space) as 2
    'Bruno,,11 99999-0001', //            5 same phone as 2 (BR normalized)
    'Carla,carla@example.com,', //        6
    'Carla,carla2@example.com,', //       7 name-only with 6
  ].join('\n') + '\n'
  const result = customers(csv, { delimiter: ',', phoneRegion: 'BR' })
  const view = result.duplicateCandidates.map((candidate) => `${candidate.code}:${candidate.basis}:${candidate.rowNumbers.join('-')}`)
  // Ordered by first row, then second row. "Ana" rows 2–3 are one exact row (no extra weak group);
  // "Ana Paula" is a different name; Carla rows 6–7 share only the name → WEAK.
  assert.deepEqual(view, ['EXACT_DUPLICATE_ROW:ROW_FINGERPRINT:2-3', 'STRONG_DUPLICATE_CANDIDATE:EMAIL:2-3-4', 'STRONG_DUPLICATE_CANDIDATE:PHONE:2-3-5', 'WEAK_DUPLICATE_CANDIDATE:NAME:6-7'])
  for (const candidate of result.duplicateCandidates) assert.equal(candidate.autoMerge, false)
  assert.equal(result.rows.length, 6, 'no row is dropped or merged')
  assert.deepEqual(result.conflicts, [])
  // Name alone never becomes STRONG.
  const nameOnly = customers('nome,email\nMaria,m1@example.com\nMaria,m2@example.com\n', { delimiter: ',' })
  assert.deepEqual(nameOnly.duplicateCandidates.map((candidate) => candidate.code), ['WEAK_DUPLICATE_CANDIDATE'])
})

test('customers: identity conflicts (same email, different phones / same phone, different emails) — no winner', () => {
  const csv = 'nome,email,telefone\nAna,ana@example.com,11999990001\nAna B,ana@example.com,11999990002\nCai,cai@example.com,11999990009\nDiu,diu@example.com,11999990009\nEva,eva@example.com,\nEva2,eva@example.com,11999990003\n'
  const result = customers(csv, { delimiter: ',', phoneRegion: 'BR' })
  assert.deepEqual(result.conflicts.map((conflict) => `${conflict.code}:${conflict.reason}:${conflict.rowNumbers.join('-')}`), ['IDENTITY_CONFLICT:EMAIL_WITH_DIFFERENT_PHONES:2-3', 'IDENTITY_CONFLICT:PHONE_WITH_DIFFERENT_EMAILS:4-5'])
  for (const conflict of result.conflicts) assert.equal(conflict.winner, null)
  assert.ok(!result.conflicts.some((conflict) => conflict.rowNumbers.includes(6)), 'empty phone is not a conflicting phone')
  assert.equal(result.summary.estimatedActions.reviewRequired >= 4, true)
})

test('products: exact duplicate, duplicate SKU (same business fields), SKU conflict — no overwrite', () => {
  const csv = 'nome,sku,preco,categoria,estoque\nA,S1,10,c,1\nA,S1,10,c,1\nA,S1,10,c,5\nB,S2,10,c,1\nB2,S2,10,c,1\nC,,10,c,1\nC,,10,c,2\n'
  const result = products(csv, { delimiter: ',' })
  const view = result.duplicateCandidates.map((candidate) => `${candidate.code}:${candidate.rowNumbers.join('-')}`)
  assert.ok(view.includes('EXACT_DUPLICATE_ROW:2-3'))
  assert.ok(view.includes('DUPLICATE_SKU_CANDIDATE:2-3-4'))
  assert.deepEqual(result.conflicts.map((conflict) => `${conflict.code}:${conflict.rowNumbers.join('-')}`), ['SKU_CONFLICT:5-6'])
  assert.ok(!view.some((entry) => entry.includes('7-8')), 'empty SKU is never a duplicate key')
  assert.equal(result.rows.length, 7)
})

test('trusted existing snapshot (tenant-scoped by the caller) only adds review candidates', () => {
  const csv = 'nome,email,telefone\nAna,ANA@example.com,\nBia,,11999990001\n'
  const result = customers(csv, { delimiter: ',', phoneRegion: 'BR', existing: { customers: [{ ref: 'c-1', email: 'ana@example.com' }, { ref: 'c-2', phone: '+5511999990001' }, { ref: '', email: 'x@example.com' }, null] } })
  const existing = result.duplicateCandidates.filter((candidate) => candidate.scope === 'EXISTING')
  assert.deepEqual(existing.map((candidate) => `${candidate.basis}:${candidate.rowNumbers[0]}:${candidate.existingRefs.join()}`), ['EMAIL:2:c-1', 'PHONE:3:c-2'])
  const productResult = products('nome,sku,preco\nX,S1,1\n', { delimiter: ',', existing: { products: [{ ref: 'p-9', sku: 'S1' }, { ref: 'p-8', sku: 's1' }] } })
  assert.deepEqual(productResult.duplicateCandidates.map((candidate) => candidate.existingRefs.join()), ['p-9'], 'SKU compared exactly (opaque)')
})

test('duplicate matching is linear (Map-indexed): 25,000 rows complete quickly', () => {
  const lines = ['nome,email,telefone']
  for (let i = 0; i < 25_000; i += 1) lines.push(`Pessoa ${i % 500},p${i % 12000}@example.com,${11_900_000_000 + (i % 9000)}`)
  const started = process.hrtime.bigint()
  const result = customers(lines.join('\n') + '\n', { delimiter: ',' })
  const ms = Number(process.hrtime.bigint() - started) / 1e6
  assert.equal(result.summary.dataRows, 25_000)
  assert.ok(ms < 8000, `took ${ms}ms`)
  const source = readFileSync(path.join(root, 'lib/import-engine/core/duplicates.ts'), 'utf8')
  assert.ok(/new Map</.test(source))
})

// ---- Dry run / automation / tenant ------------------------------------------------------------------------------------------
test('dry-run contract: flags always set; no apply/tenant/job/provider fields; automations suppressed', () => {
  const inputs = [['nome,email\nAna,a@example.com\n', { entity: 'CUSTOMERS' }], ['', { entity: 'CUSTOMERS' }], ['x', { entity: 'LEADS' }], ['nome,trigger_automation\nAna,true\n', { entity: 'CUSTOMERS', delimiter: ',' }]]
  for (const [input, options] of inputs) {
    const result = run(input, options)
    assert.equal(result.dryRun, true)
    assert.equal(result.notApplied, true)
    assert.equal(result.requiresUserConfirmation, true)
    assert.equal(result.automationPolicy, 'SUPPRESSED_BY_DEFAULT')
    const serialized = JSON.stringify(result)
    for (const forbidden of ['companyIdFromCsv', 'applyToken', 'databaseAction', 'providerAction', 'jobId', 'tenantId']) assert.ok(!serialized.includes(forbidden), forbidden)
  }
  const automation = run('nome,trigger_automation\nAna,true\n', { entity: 'CUSTOMERS', delimiter: ',', mappingDecisions: [{ sourceIndex: 1, action: 'IGNORE' }] })
  assert.equal(automation.automationPolicy, 'SUPPRESSED_BY_DEFAULT')
  assert.equal(automation.mapping[1].status, 'IGNORED')
  assert.equal(run('x', { entity: 'LEADS' }).issues[0].code, 'UNSUPPORTED_ENTITY')
  assert.equal(ie.importCsvDryRun('a,b\n', { entity: 'CUSTOMERS' }, { parser: naiveParser }).issues[0].code, 'INVALID_OPTIONS')
  assert.equal(run('a,b\n', { entity: 'CUSTOMERS', numberLocale: 'pt-BR' }).issues[0].code, 'INVALID_OPTIONS')
  assert.equal(run('a,b\n', { entity: 'CUSTOMERS', phoneRegion: 'US' }).issues[0].code, 'INVALID_OPTIONS')
})

test('CSV cannot choose tenant: company_id/tenant_id columns have no destination; tenant only in future idempotency material', () => {
  const csv = 'company_id,tenant_id,nome\n11111111-1111-4111-8111-111111111111,t,Ana\n'
  const result = customers(csv, { delimiter: ',', mappingDecisions: [{ sourceIndex: 0, action: 'IGNORE' }, { sourceIndex: 1, action: 'IGNORE' }] })
  assert.equal(result.status, 'READY_FOR_REVIEW')
  assert.ok(!JSON.stringify(result).includes('11111111-1111-4111-8111-111111111111'))
  const material = ie.futureIdempotencyMaterial({ trustedTenantId: 'tenant-from-auth', entity: 'CUSTOMERS', inputFingerprint: result.inputFingerprint, mappingFingerprint: result.mappingFingerprint })
  assert.ok(material.includes('tenant-from-auth') && material.includes(result.inputFingerprint) && material.includes(ie.IMPORT_RULESET_VERSION))
  assert.equal(ie.futureIdempotencyMaterial({ trustedTenantId: '', entity: 'CUSTOMERS', inputFingerprint: 'a', mappingFingerprint: 'b' }), null)
  assert.notEqual(ie.futureIdempotencyMaterial({ trustedTenantId: 't1', entity: 'CUSTOMERS', inputFingerprint: 'a', mappingFingerprint: 'b' }), ie.futureIdempotencyMaterial({ trustedTenantId: 't2', entity: 'CUSTOMERS', inputFingerprint: 'a', mappingFingerprint: 'b' }))
})

test('summary estimates: valid / warnings / invalid / review counts are consistent', () => {
  const csv = 'nome,email\nAna,a@example.com\n=Bia,b@example.com\nCai,bad\nAna,a@example.com\n'
  const result = customers(csv, { delimiter: ',' })
  assert.deepEqual([result.summary.validRows, result.summary.validWithWarningsRows, result.summary.invalidRows], [2, 1, 1])
  assert.deepEqual(result.summary.estimatedActions, { createCandidates: 1, reviewRequired: 2, skipInvalid: 1 })
  assert.equal(result.summary.dataRows, 4)
  assert.equal(result.summary.columns, 2)
})

// ---- Determinism & fingerprints ----------------------------------------------------------------------------------------------
test('deterministic output: same bytes + policy + mapping + ruleset → byte-equivalent result', () => {
  const csv = 'nome,email,telefone\nAna,ana@example.com,11999990001\nAna,ana@example.com,11999990001\nZé,,\n'
  const a = stableStringify(customers(csv, { phoneRegion: 'BR' }))
  for (let i = 0; i < 20; i += 1) assert.equal(stableStringify(customers(csv, { phoneRegion: 'BR' })), a)
  assert.ok(a !== null)
  const p = stableStringify(products('nome,sku,preco\nA,1,1\nA,1,2\n', { delimiter: ',' }))
  assert.equal(stableStringify(products('nome,sku,preco\nA,1,1\nA,1,2\n', { delimiter: ',' })), p)
})

test('fingerprints: input = SHA-256 of exact bytes; mapping and row fingerprints are canonical and tenant-free', () => {
  const csv = 'nome,email\nAna,ana@example.com\n'
  const result = customers(csv)
  assert.equal(result.inputFingerprint, hashes.bytes(encode(csv)))
  assert.notEqual(customers(csv.replace(/\n/g, '\r\n')).inputFingerprint, result.inputFingerprint, 'line endings are not normalized')
  assert.match(result.mappingFingerprint, /^[0-9a-f]{64}$/)
  const other = customers('nome,e-mail\nAna,ana@example.com\n')
  assert.notEqual(other.mappingFingerprint, result.mappingFingerprint)
  assert.notEqual(customers(csv, { phoneRegion: 'BR' }).mappingFingerprint, result.mappingFingerprint, 'policy is part of the mapping fingerprint')
  // Same normalized values in different rows/positions → same row fingerprint; row number excluded.
  const twice = customers('nome,email\nAna,ana@example.com\nBia,\nAna,ana@example.com\n')
  assert.equal(twice.rows[0].rowFingerprint, twice.rows[2].rowFingerprint)
  assert.notEqual(twice.rows[0].rowFingerprint, twice.rows[1].rowFingerprint)
  // Column order in the file does not change the row fingerprint (canonical destination order).
  const swapped = customers('email,nome\nana@example.com,Ana\n')
  assert.equal(swapped.rows[0].rowFingerprint, result.rows[0].rowFingerprint)
  assert.equal(ie.rowFingerprint('CUSTOMERS', { 'customer.name': 'Ana' }, hashes), ie.rowFingerprint('CUSTOMERS', { 'customer.name': 'Ana', 'customer.email': null }, hashes))
})

// ---- Manifest --------------------------------------------------------------------------------------------------------------------
test('Wave 1 manifest importCsv section: safe metadata only', () => {
  const manifest = buildImportCsvManifest()
  assert.deepEqual(manifest.entityTypes, ['CUSTOMERS', 'PRODUCTS'])
  assert.equal(manifest.runtimeStatus, 'PURE_DRY_RUN_ONLY')
  assert.equal(manifest.applyStatus, 'NOT_AUTHORIZED')
  assert.equal(manifest.automationPolicy, 'SUPPRESSED_BY_DEFAULT')
  assert.equal(manifest.xlsxStatus, 'HOLD')
  assert.equal(manifest.parserStatus, 'CSV_PARSE_ADAPTER_PENDING')
  assert.deepEqual(manifest.supportedDelimiters, [',', ';', '\t', '|'])
  assert.equal(manifest.limits.maxInputBytes, 10 * 1024 * 1024)
  assert.equal(manifest.rulesetVersion, ie.IMPORT_RULESET_VERSION)
  assert.ok(stableStringify(manifest) !== null)
})

// ---- Purity: no time, randomness, network, DB, filesystem, Supabase, automations, providers, XLSX -----------------------------------
test('pure core: no clock/randomness/network/DB/filesystem/Supabase/automation/provider/XLSX imports or calls', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.ts')) files.push(full)
    }
  }
  walk(path.join(root, 'lib/import-engine/core'))
  assert.ok(files.length >= 13)
  const forbidden = [
    /Date\.now|new Date\(|performance\.now/, /Math\.random|crypto\.getRandomValues|randomUUID/, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/,
    /supabase/i, /from\s+['"]node:/, /\brequire\(/, /process\.env/, /\bfs\b\.|readFile|writeFile/,
    /automation-recipes|automation runner|recipes\/|from\s+['"].*\/jobs/i, /\b(openai|anthropic|llm|chatgpt)\b|gpt-\d/i,
    /xlsx|exceljs|sheetjs|jszip|\.zip\b/i, /from\s+['"]next\//, /from\s+['"]@\/app|from\s+['"]@\/components/, /sha256\.server/,
    /\bNumber\(|\bBoolean\(|\beval\(|new Function\(/, /columns:\s*true/, /relax_quotes:\s*true|relax_column_count:\s*true|skip_records_with_error:\s*true|cast:\s*true/,
    /console\.(log|info|warn|error|debug)/, /innerHTML/,
  ]
  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '')
    for (const pattern of forbidden) assert.ok(!pattern.test(source), `${path.relative(root, file)} matches ${pattern}`)
  }
})

// ---- Branch coverage: snapshot bounds, hash contract, bounded issue collector ---------------------------------------------------
test('existing snapshot: refs deduplicated and bounded per key; malformed entries ignored', () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ ref: `c-${String(i).padStart(3, '0')}`, email: 'ana@example.com' }))
  const result = customers('nome,email\nAna,ana@example.com\n', { delimiter: ',', existing: { customers: [...many, { ref: 'c-000', email: 'ana@example.com' }, { ref: 7, email: 'ana@example.com' }, { ref: 'c-x' }] } })
  const candidate = result.duplicateCandidates.find((entry) => entry.scope === 'EXISTING')
  assert.equal(candidate.existingRefs.length, L.maxRowsListedPerGroup)
  assert.equal(new Set(candidate.existingRefs).size, candidate.existingRefs.length)
  const productResult = products('nome,sku,preco\nX,S1,1\nY,,1\n', { delimiter: ',', existing: { products: [{ ref: 'p-1', sku: 'S1' }, { ref: 'p-1', sku: 'S1' }, { ref: 'p-2', sku: '' }, { ref: '', sku: 'S1' }, null] } })
  assert.deepEqual(productResult.duplicateCandidates.map((entry) => entry.existingRefs.join()), ['p-1'])
  // Group listing is bounded; rowCount keeps the full size.
  const lines = ['nome,email']
  for (let i = 0; i < 70; i += 1) lines.push(`P${i},same@example.com`)
  const big = customers(lines.join('\n') + '\n', { delimiter: ',' })
  const group = big.duplicateCandidates.find((entry) => entry.basis === 'EMAIL')
  assert.equal(group.rowNumbers.length, L.maxRowsListedPerGroup)
  assert.equal(group.rowCount, 70)
})

test('hash contract and idempotency-material guards', () => {
  for (const bad of [null, 'x', { bytes: () => 'a' }, { text: () => 'a' }, { bytes: 1, text: () => 'a' }]) {
    assert.equal(ie.isImportHashes(bad), false)
    const result = ie.importCsvDryRun('a,b\n', { entity: 'CUSTOMERS' }, { parser: naiveParser, hashes: bad })
    assert.equal(result.issues[0].code, 'INVALID_OPTIONS')
  }
  assert.equal(ie.importCsvDryRun('a,b\n', { entity: 'CUSTOMERS' }, undefined).issues[0].code, 'INVALID_OPTIONS')
  assert.equal(ie.futureIdempotencyMaterial({ trustedTenantId: 42, entity: 'CUSTOMERS', inputFingerprint: 'a', mappingFingerprint: 'b' }), null)
  assert.equal(ie.futureIdempotencyMaterial({ trustedTenantId: '   ', entity: 'CUSTOMERS', inputFingerprint: 'a', mappingFingerprint: 'b' }), null)
})

test('bounded issue collector keeps counting after the cap', () => {
  const collector = new ie.BoundedIssues(2)
  collector.add('INVALID_EMAIL', 'error', 3, 'customer.email')
  collector.add('FORMULA_LIKE_TEXT', 'warning', 2, 'customer.name', { trigger: '=' })
  collector.add('INVALID_EMAIL', 'error', 1, 'customer.email')
  assert.equal(collector.truncated, true)
  assert.equal(collector.count('INVALID_EMAIL'), 2)
  assert.equal(collector.count('INVALID_PHONE'), 0)
  assert.deepEqual([collector.errors, collector.warnings], [2, 1])
  assert.deepEqual(collector.list().map((issue) => issue.rowNumber), [2, 3])
  assert.deepEqual(collector.totals(), { FORMULA_LIKE_TEXT: 1, INVALID_EMAIL: 2 })
})
