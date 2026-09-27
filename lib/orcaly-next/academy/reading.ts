/**
 * Reader preferences (typography, width, theme) and small display formatters.
 * Pure and bounded. Preferences live in component state only in this MVP — no
 * localStorage. Future persistence: see docs/product/academy/ACADEMY_OFFLINE_CONTRACT.md.
 */

export const READING_BOUNDS = {
  fontMin: 14, fontMax: 24, fontStep: 2, fontDefault: 18,
  /** Line-height in tenths (integers, no float drift): 14 = 1.4 … 20 = 2.0. */
  leadingMin: 14, leadingMax: 20, leadingDefault: 17,
} as const

export const READING_WIDTHS = ['narrow', 'standard', 'wide'] as const
export type ReadingWidth = (typeof READING_WIDTHS)[number]
export const READING_WIDTH_CH: Record<ReadingWidth, number> = { narrow: 58, standard: 68, wide: 80 }
export const READING_WIDTH_LABEL: Record<ReadingWidth, string> = { narrow: 'Estreita', standard: 'Padrão', wide: 'Ampla' }

export const READING_THEMES = ['inherit', 'light', 'dark'] as const
export type ReadingTheme = (typeof READING_THEMES)[number]
export const READING_THEME_LABEL: Record<ReadingTheme, string> = { inherit: 'Igual ao app', light: 'Claro', dark: 'Escuro' }

export type ReadingPrefs = { fontPx: number; leadingTenths: number; width: ReadingWidth; theme: ReadingTheme }

export const DEFAULT_READING_PREFS: ReadingPrefs = { fontPx: READING_BOUNDS.fontDefault, leadingTenths: READING_BOUNDS.leadingDefault, width: 'standard', theme: 'inherit' }

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Any input → valid prefs. Out-of-range values clamp; garbage falls back to defaults. */
export function clampReadingPrefs(input: Partial<Record<keyof ReadingPrefs, unknown>> | null | undefined): ReadingPrefs {
  const source = input ?? {}
  const fontRaw = clampInt(source.fontPx, READING_BOUNDS.fontMin, READING_BOUNDS.fontMax, READING_BOUNDS.fontDefault)
  const fontPx = fontRaw % 2 === 0 ? fontRaw : fontRaw - 1 // even steps only: 14, 16 … 24
  return {
    fontPx,
    leadingTenths: clampInt(source.leadingTenths, READING_BOUNDS.leadingMin, READING_BOUNDS.leadingMax, READING_BOUNDS.leadingDefault),
    width: READING_WIDTHS.includes(source.width as ReadingWidth) ? (source.width as ReadingWidth) : 'standard',
    theme: READING_THEMES.includes(source.theme as ReadingTheme) ? (source.theme as ReadingTheme) : 'inherit',
  }
}

export function formatLeading(tenths: number): string {
  return `${Math.floor(tenths / 10)},${tenths % 10}`
}

/** Deterministic dd/mm/aaaa from an ISO date (no locale APIs, no timezone shifting). */
export function formatDateBR(iso: string | null): string {
  if (!iso) return 'Data não informada'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Data não informada'
}

/** 0 → "0:00", 754 → "12:34". Negative/non-integer input is rejected upstream; guard anyway. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
