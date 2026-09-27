/**
 * Manual data MVP: parsing and validation of observations typed by a person,
 * plus link safety. All input is treated as untrusted and bounded.
 */

import type { BaseMetricKey, GrowthObservation, GrowthTimeWindow } from './types'
import { GrowthInputError, parseCount, parseMoneyToCents } from './exact'
import { parseIsoDate } from './experiment'

const COUNT_FIELDS = ['impressions', 'clicks', 'leads', 'conversions'] as const
const MONEY_FIELDS = ['spend_cents', 'revenue_cents'] as const
const ALLOWED_TOP = new Set(['window_start', 'window_end', ...COUNT_FIELDS, 'spend', 'revenue', 'custom', 'evidence_url'])
const CUSTOM_KEY = /^[a-z][a-z0-9_]{0,39}$/
export const MAX_CUSTOM_METRICS = 20

export type ManualObservationInput = Record<string, unknown>

export type ParsedObservation = {
  window: GrowthTimeWindow
  values: GrowthObservation['values']
  evidenceUrl: string | null
  warnings: string[]
}

/** https only, no credentials, no control characters, bounded. Returns normalized URL or null. */
export function safeEvidenceUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text || text.length > 2048 || /[\u0000-\u001f\u007f\s]/.test(text)) return null
  let url: URL
  try { url = new URL(text) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) return null
  return url.toString()
}

/** Internal app path only: single leading slash, no scheme, no traversal, no backslash. */
export function safeInternalHref(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 512) return null
  if (!/^\/(?!\/)[A-Za-z0-9\-._~/%?=&#]*$/.test(input) || input.includes('..') || input.includes('\\')) return null
  return input
}

export function parseManualObservation(raw: ManualObservationInput): ParsedObservation {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new GrowthInputError('observation', 'formato inválido')
  for (const key of Object.keys(raw)) if (!ALLOWED_TOP.has(key)) throw new GrowthInputError(key, 'campo não permitido')

  const start = typeof raw.window_start === 'string' ? raw.window_start : ''
  const end = typeof raw.window_end === 'string' ? raw.window_end : ''
  const startTime = parseIsoDate(start)
  const endTime = parseIsoDate(end)
  if (startTime === null) throw new GrowthInputError('window_start', 'data inválida (AAAA-MM-DD)')
  if (endTime === null) throw new GrowthInputError('window_end', 'data inválida (AAAA-MM-DD)')
  if (endTime < startTime) throw new GrowthInputError('window_end', 'fim antes do início')
  if ((endTime - startTime) / 86_400_000 > 366) throw new GrowthInputError('window_end', 'período acima de 366 dias')

  const values: GrowthObservation['values'] = {}
  for (const field of COUNT_FIELDS) {
    const value = raw[field]
    if (value === undefined || value === null || value === '') continue // absent ⇒ UNKNOWN, never zero
    values[field] = parseCount(field, value)
  }
  const money: Record<(typeof MONEY_FIELDS)[number], unknown> = { spend_cents: raw.spend, revenue_cents: raw.revenue }
  for (const field of MONEY_FIELDS) {
    const value = money[field]
    if (value === undefined || value === null || value === '') continue
    values[field] = parseMoneyToCents(field === 'spend_cents' ? 'spend' : 'revenue', value)
  }

  if (raw.custom !== undefined) {
    if (raw.custom === null || typeof raw.custom !== 'object' || Array.isArray(raw.custom)) throw new GrowthInputError('custom', 'formato inválido')
    const entries = Object.entries(raw.custom as Record<string, unknown>)
    if (entries.length > MAX_CUSTOM_METRICS) throw new GrowthInputError('custom', `no máximo ${MAX_CUSTOM_METRICS} métricas personalizadas`)
    const custom: Record<string, bigint> = Object.create(null)
    for (const [key, value] of entries) {
      if (!CUSTOM_KEY.test(key)) throw new GrowthInputError(`custom.${key.slice(0, 40)}`, 'nome inválido (minúsculas, números e _)')
      if (value === undefined || value === null || value === '') continue
      custom[key] = parseCount(`custom.${key}`, value)
    }
    if (Object.keys(custom).length) values.custom = custom
  }

  const warnings: string[] = []
  if (values.clicks !== undefined && values.impressions !== undefined && values.clicks > values.impressions) {
    throw new GrowthInputError('clicks', 'cliques maiores que impressões')
  }
  if (values.conversions !== undefined && values.clicks !== undefined && values.conversions > values.clicks) {
    warnings.push('Conversões maiores que cliques: confirme se inclui conversões sem clique (ex.: visualização).')
  }
  const hasAny = [...COUNT_FIELDS, ...MONEY_FIELDS].some((field) => values[field as BaseMetricKey] !== undefined) || Boolean(values.custom)
  if (!hasAny) throw new GrowthInputError('observation', 'informe ao menos uma métrica')

  let evidenceUrl: string | null = null
  if (raw.evidence_url !== undefined && raw.evidence_url !== '') {
    evidenceUrl = safeEvidenceUrl(raw.evidence_url)
    if (!evidenceUrl) throw new GrowthInputError('evidence_url', 'use um link https válido')
  }
  return { window: { start, end }, values, evidenceUrl, warnings }
}
