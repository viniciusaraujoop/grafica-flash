/**
 * Exact numbers for Growth. Money is integer cents as BigInt; counts are BigInt.
 * No float is ever a source of truth. BigInt literals are avoided on purpose
 * (project tsconfig targets ES2017).
 */

export const ZERO = BigInt(0)
export const ONE = BigInt(1)
const TEN = BigInt(10)

/** Upper bound for any single manual value: 10^15 (≈ R$ 10 trilhões in cents). Above MAX_SAFE_INTEGER, below abuse. */
export const MAX_MANUAL_VALUE = BigInt('1000000000000000')

export class GrowthInputError extends Error {
  readonly field: string
  constructor(field: string, message: string) {
    super(`${field}: ${message}`)
    this.field = field
  }
}

/** Non-negative integer from a string or safe integer. Rejects floats, exponents, signs, separators and overflow. */
export function parseCount(field: string, input: unknown, max: bigint = MAX_MANUAL_VALUE): bigint {
  let text: string
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input) || input < 0) throw new GrowthInputError(field, 'deve ser um inteiro não negativo')
    text = String(input)
  } else if (typeof input === 'string') {
    text = input.trim()
  } else if (typeof input === 'bigint') {
    text = input.toString()
  } else {
    throw new GrowthInputError(field, 'valor ausente ou de tipo inválido')
  }
  if (text.length === 0 || text.length > 19) throw new GrowthInputError(field, 'fora do tamanho permitido')
  if (!/^\d+$/.test(text)) throw new GrowthInputError(field, 'use apenas dígitos (sem sinais, vírgulas ou pontos)')
  const value = BigInt(text)
  if (value > max) throw new GrowthInputError(field, 'acima do limite permitido')
  return value
}

/**
 * Money typed by a person in pt-BR ("1.234,56", "1234,5", "1234") → exact cents.
 * Rejects negatives, more than 2 decimals, malformed grouping and overflow.
 */
export function parseMoneyToCents(field: string, input: unknown): bigint {
  if (typeof input !== 'string') throw new GrowthInputError(field, 'informe o valor como texto')
  const text = input.trim().replace(/^R\$\s?/, '')
  if (!text || text.length > 24) throw new GrowthInputError(field, 'fora do tamanho permitido')
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text)
  if (!match) throw new GrowthInputError(field, 'formato inválido (ex.: 1.234,56)')
  const integer = match[1].replace(/\./g, '')
  const decimals = (match[2] ?? '').padEnd(2, '0')
  const cents = BigInt(integer) * BigInt(100) + BigInt(decimals)
  if (cents > MAX_MANUAL_VALUE) throw new GrowthInputError(field, 'acima do limite permitido')
  return cents
}

/** Exact BRL formatting of integer cents, grouping by thousands, no float. */
export function formatCents(cents: bigint): string {
  const negative = cents < ZERO
  const abs = negative ? -cents : cents
  const units = (abs / BigInt(100)).toString()
  const rest = (abs % BigInt(100)).toString().padStart(2, '0')
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}R$ ${grouped},${rest}`
}

export function formatCount(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * numerator/denominator × scale, rounded half away from zero, as BigInt.
 * Returns null for a zero denominator (caller maps to UNKNOWN / NOT_AVAILABLE).
 */
export function divideRounded(numerator: bigint, denominator: bigint, scale: bigint = ONE): bigint | null {
  if (denominator === ZERO) return null
  const scaled = numerator * scale
  const negative = (scaled < ZERO) !== (denominator < ZERO)
  const absNum = scaled < ZERO ? -scaled : scaled
  const absDen = denominator < ZERO ? -denominator : denominator
  const quotient = absNum / absDen
  const remainder = absNum % absDen
  const rounded = remainder * BigInt(2) >= absDen ? quotient + ONE : quotient
  return negative ? -rounded : rounded
}

/** Fixed-point decimal string of a ratio, e.g. (1, 3, 2) → "0,33". Null for zero denominator. */
export function ratioToDecimal(numerator: bigint, denominator: bigint, places: number): string | null {
  const scale = TEN ** BigInt(places)
  const value = divideRounded(numerator, denominator, scale)
  if (value === null) return null
  const negative = value < ZERO
  const digits = (negative ? -value : value).toString().padStart(places + 1, '0')
  const whole = digits.slice(0, digits.length - places).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraction = places ? `,${digits.slice(-places)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
}

/** Relative change (b − a)/a in basis points. Null when a is zero (no defined relative change). */
export function relativeChangeBps(before: { numerator: bigint; denominator: bigint }, after: { numerator: bigint; denominator: bigint }): number | null {
  // (after/before − 1) × 10000 = (an·bd − bn·ad) / (bn·ad) × 10000
  const numerator = after.numerator * before.denominator - before.numerator * after.denominator
  const denominator = before.numerator * after.denominator
  const bps = divideRounded(numerator, denominator, BigInt(10000))
  if (bps === null) return null
  const limit = BigInt(Number.MAX_SAFE_INTEGER)
  if (bps > limit || bps < -limit) return null
  return Number(bps)
}
