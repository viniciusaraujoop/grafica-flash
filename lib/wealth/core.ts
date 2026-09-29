export const wealthKinds = ['income', 'expense', 'asset', 'liability'] as const
export type WealthKind = typeof wealthKinds[number]
export const wealthCategories = ['salary','housing','food','transport','education','health','leisure','investment','property','loan','other'] as const
export const moneyLimit = 100_000_000_000_000

export function parseMoney(value: unknown, allowZero = true): number {
  if (typeof value !== 'string' || !/^\d{1,13}([.,]\d{1,2})?$/.test(value.trim())) throw new Error('Informe um valor monetário válido, com até duas casas decimais.')
  const [whole, decimals = ''] = value.trim().replace(',', '.').split('.')
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > moneyLimit || cents < (allowZero ? 0 : 1)) throw new Error('Valor fora do limite permitido.')
  return cents
}

export function financialDate(value: unknown): string {
  if (typeof value !== 'string' || !/^(19|20|21|22)\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida.')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value > '2200-12-31') throw new Error('Informe uma data válida.')
  return value
}

export function title(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 160) throw new Error('Use um nome entre 1 e 160 caracteres.')
  return value.trim()
}

export function integer(value: unknown, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`Informe um inteiro entre ${min} e ${max}.`)
  return number
}

export function parseRateBps(value: unknown): number {
  if (typeof value !== 'string') throw new Error('Informe uma taxa percentual válida.')
  const raw = value.trim()
  const negative = raw.startsWith('-')
  const bps = parseMoney(negative ? raw.slice(1) : raw)
  return integer(negative ? -bps : bps, -10000, 10000)
}

export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Identificador inválido.')
  return value
}

export type WealthLifecycle = { version?: number; archived_at?: string | null; updated_at?: string; valuation_status?:string }
export type WealthEntry = WealthLifecycle & { id: string; title: string; kind: WealthKind; category: string; amount_cents: number; financial_date: string; currency: 'BRL'; recurrence: 'none' | 'monthly' | 'yearly' }
export type WealthGoal = WealthLifecycle & { id: string; title: string; target_cents: number; saved_cents: number; monthly_contribution_cents: number; target_date: string; status?: 'active' | 'paused' | 'completed' }

export function validateEntry(input: Record<string, unknown>) {
  if (!wealthKinds.some((kind) => kind === input.kind)) throw new Error('Tipo de lançamento inválido.')
  if (!wealthCategories.some((category) => category === input.category)) throw new Error('Categoria inválida.')
  if (!['none','monthly','yearly'].includes(String(input.recurrence))) throw new Error('Recorrência inválida.')
  return { title: title(input.title), kind: input.kind as WealthKind, category: String(input.category), amount_cents: parseMoney(input.amount, input.kind === 'liability'), financial_date: financialDate(input.financial_date), recurrence: String(input.recurrence), currency: 'BRL' as const, idempotency_key: uuid(input.idempotency_key) }
}

export function validateGoal(input: Record<string, unknown>) {
  return { title: title(input.title), target_cents: parseMoney(input.target, false), saved_cents: parseMoney(input.saved), monthly_contribution_cents: parseMoney(input.monthly_contribution), target_date: financialDate(input.target_date), currency: 'BRL' as const, idempotency_key: uuid(input.idempotency_key) }
}

export function validateProfile(input: Record<string, unknown>) {
  const timezone = typeof input.timezone === 'string' ? input.timezone : 'America/Sao_Paulo'
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(0) } catch { throw new Error('Fuso horário inválido.') }
  return { monthly_income_cents: parseMoney(input.monthly_income), monthly_budget_cents: parseMoney(input.monthly_budget), dependents: integer(input.dependents, 0, 50), emergency_months: integer(input.emergency_months, 1, 36), timezone, currency: 'BRL' as const }
}

/** End-of-month contribution; monthly rate is a declared scenario, never a market quote. */
export function simulateGoal(input: { initialCents: number; monthlyCents: number; monthlyRateBps: number; months: number }) {
  integer(input.initialCents, 0, moneyLimit); integer(input.monthlyCents, 0, moneyLimit)
  integer(input.monthlyRateBps, -10000, 10000); integer(input.months, 1, 600)
  let balance = BigInt(input.initialCents)
  const contribution = BigInt(input.monthlyCents)
  const multiplier = BigInt(10000 + input.monthlyRateBps)
  const points: { month: number; balanceCents: number; contributedCents: number }[] = []
  for (let month = 1; month <= input.months; month++) {
    balance = (balance * multiplier + BigInt(5000)) / BigInt(10000) + contribution
    const contributed = BigInt(input.initialCents) + contribution * BigInt(month)
    if (balance > BigInt(Number.MAX_SAFE_INTEGER) || contributed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Cenário excede a precisão monetária permitida.')
    points.push({ month, balanceCents: Number(balance), contributedCents: Number(contributed) })
  }
  return { kind: 'scenario' as const, assumption: 'Taxa mensal hipotética constante; aporte no final do mês; não inclui impostos, taxas ou inflação.', points, finalCents: Number(balance) }
}

export function summarizeEntries(entries: readonly WealthEntry[], month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido.')
  const totals = { income: BigInt(0), expense: BigInt(0), asset: BigInt(0), liability: BigInt(0) }
  for (const entry of entries) {
    integer(entry.amount_cents, 1, moneyLimit)
    if (entry.kind === 'asset' || entry.kind === 'liability' || entry.financial_date.startsWith(month)) totals[entry.kind] += BigInt(entry.amount_cents)
  }
  function safe(value: bigint) { if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) throw new Error('Total excede a precisão monetária permitida.'); return Number(value) }
  return { income: safe(totals.income), expenses: safe(totals.expense), assets: safe(totals.asset), liabilities: safe(totals.liability), netWorth: safe(totals.asset - totals.liability), cashFlow: safe(totals.income - totals.expense) }
}

export function formatMoney(cents: number | string | bigint) {
  if (typeof cents === 'number' && !Number.isSafeInteger(cents)) throw new Error('Valor monetário sem precisão segura.')
  if (typeof cents === 'string' && !/^-?\d{1,60}$/.test(cents)) throw new Error('Valor monetário inválido.')
  const value = BigInt(cents), absolute = value < 0 ? -value : value
  return `${value < 0 ? '-' : ''}R$\u00a0${(absolute / BigInt(100)).toLocaleString('pt-BR')},${String(absolute % BigInt(100)).padStart(2, '0')}`
}

export function moneyInputValue(cents: number) {
  integer(cents, 0, moneyLimit)
  const exact = BigInt(cents)
  return `${exact / BigInt(100)},${String(exact % BigInt(100)).padStart(2, '0')}`
}

export function formatFinancialDate(value: string) {
  const [year, month, day] = financialDate(value).split('-')
  return `${day}/${month}/${year}`
}
