// csv-parse@7.0.2 adapter → core `CsvParserFn`. The ONLY module that imports csv-parse.
// input text + validated delimiter → strict synchronous parse → string[][] → closed failure vocabulary.
// Policy, limit guard and error mapping live in `csv-parse-policy.ts`; the core re-verifies the matrix.
// Pure: no filesystem, network, database, logging or telemetry. Library errors never escape.

import { parse } from 'csv-parse/sync'
import type { CsvParserFn, CsvParserOutcome } from './core/parser'
import { checkParserRequest, createRecordGuard, CSV_PARSE_OPTIONS, mapCsvParseError } from './csv-parse-policy'

export const csvParseAdapter: CsvParserFn = (request): CsvParserOutcome => {
  if (!checkParserRequest(request)) return { ok: false, failure: 'SYNTAX', recordNumber: null }
  let records: string[][]
  try {
    records = parse(request.text, {
      ...CSV_PARSE_OPTIONS,
      delimiter: request.delimiter,
      on_record: createRecordGuard(request.limits),
    })
  } catch (error) {
    const mapped = mapCsvParseError(error)
    return { ok: false, failure: mapped.failure, recordNumber: mapped.recordNumber }
  }
  return { ok: true, records }
}
