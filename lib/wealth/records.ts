import type { WealthEntry, WealthKind } from './core'

export const entryKindLabels: Record<WealthKind, string> = { income: 'Receita', expense: 'Despesa', asset: 'Ativo', liability: 'Passivo' }
export const recordsPageSize = 25
export const exportRowLimit = 1000
export type WealthFilters = { kind: WealthKind | null; month: string | null; page: number; archive?: 'active' | 'archived' | 'all' }
type QueryValues = Record<string, string | string[] | undefined>

export function parseWealthFilters(input: QueryValues): WealthFilters {
  const { kind, month, page, archive } = input
  if ([kind, month, page, archive].some(Array.isArray)) throw new Error('Use apenas um valor por filtro.')
  if (archive && !['active','archived','all'].includes(String(archive))) throw new Error('Estado de arquivamento inválido.')
  if (kind && (typeof kind !== 'string' || !Object.hasOwn(entryKindLabels, kind))) throw new Error('Tipo de lançamento inválido.')
  if (month && (typeof month !== 'string' || !/^(19\d{2}|20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(month))) throw new Error('Escolha um mês entre janeiro de 1900 e dezembro de 2200.')
  if (page && (typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page))) throw new Error('Página inválida.')
  return { kind: (kind || null) as WealthKind | null, month: (month || null) as string | null, page: page ? Number(page) : 1, ...(archive ? { archive: archive as WealthFilters['archive'] } : {}) }
}

export function monthBounds(month: string) {
  const checked = parseWealthFilters({ month }).month!
  const [year, number] = checked.split('-').map(Number)
  return { from: `${checked}-01`, through: new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10) }
}

export function recordsQuery(filters: WealthFilters, page = filters.page) {
  const params = new URLSearchParams()
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.month) params.set('month', filters.month)
  if (filters.archive && filters.archive !== 'active') params.set('archive', filters.archive)
  if (page > 1) params.set('page', String(page))
  return params.toString()
}

export function assertExportSize(count: number | null) {
  if (count === null || !Number.isSafeInteger(count) || count < 0) throw new Error('Não foi possível confirmar a quantidade de lançamentos.')
  if (count > exportRowLimit) throw new Error('A exportação aceita até 1.000 lançamentos. Escolha um mês ou tipo para reduzir o resultado.')
}

// Quote delimiters/newlines; treat formula-looking text as text on first spreadsheet import.
// CSV round-trips through arbitrary spreadsheet tools cannot preserve a universal security guarantee.
export function csvCell(value: string) {
  const guarded = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${guarded.replaceAll('"', '""')}"`
}

export function entriesCsv(entries: readonly WealthEntry[]) {
  assertExportSize(entries.length)
  const lines = [['id', 'nome', 'tipo', 'categoria', 'data', 'valor_brl', 'valor_centavos', 'moeda', 'recorrencia', 'arquivado_em', 'avaliacao'].map(csvCell).join(';')]
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amount_cents) || entry.amount_cents < (['asset','liability'].includes(entry.kind)?0:1) || entry.amount_cents > 100_000_000_000_000) throw new Error('Valor monetário inválido para exportação.')
    const cents = BigInt(entry.amount_cents)
    const amount = `${cents / BigInt(100)},${String(cents % BigInt(100)).padStart(2, '0')}`
    const unknown=entry.valuation_status==='NOT_AVAILABLE'
    lines.push([entry.id, entry.title, entryKindLabels[entry.kind], entry.category, entry.financial_date, unknown?'':amount, unknown?'':String(entry.amount_cents), entry.currency, entry.recurrence, entry.archived_at ?? '',entry.valuation_status??'MANUAL_VALUE'].map(csvCell).join(';'))
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
