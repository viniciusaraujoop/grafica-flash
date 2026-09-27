/**
 * Future provider integration contract. NOTHING here talks to an external service.
 * Every provider is NOT_CONFIGURED in this phase; only MANUAL data exists.
 * Spec: docs/product/growth/GROWTH_INTEGRATION_CONTRACT.md
 */

import type { BaseMetricKey, GrowthSource, SourceStatus } from './types'

export type ProviderId = 'meta_ads' | 'google_ads' | 'google_analytics' | 'tiktok_ads'

export type ProviderHealth =
  | { status: 'NOT_CONFIGURED' }
  | { status: 'CONNECTED'; checkedAt: string }
  | { status: 'STALE'; lastSuccessAt: string; maxAgeHours: number }
  | { status: 'ERROR'; code: 'AUTH_EXPIRED' | 'PERMISSION_REVOKED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'SCHEMA_CHANGED' | 'UNKNOWN'; at: string; retryable: boolean }
  | { status: 'BLOCKED_EXTERNAL'; reason: string }

export type ProviderContract = {
  id: ProviderId
  label: string
  /** Base metrics the provider may supply, and only these. Nothing is inferred. */
  supplies: readonly BaseMetricKey[]
  /** Data older than this is STALE and flagged in every result that uses it. */
  freshnessMaxAgeHours: number
  /** Opaque, provider-specific incremental sync position. */
  cursor: { kind: 'date' | 'token'; description: string }
  /** How rows are attributed to an experiment arm. */
  attribution: string
  health: ProviderHealth
}

export const PROVIDERS: readonly ProviderContract[] = [
  { id: 'meta_ads', label: 'Meta Ads', supplies: ['impressions', 'clicks', 'spend_cents', 'leads', 'conversions'], freshnessMaxAgeHours: 24, cursor: { kind: 'date', description: 'último dia completo sincronizado por conta de anúncios' }, attribution: 'campanha/conjunto/anúncio mapeado explicitamente para um braço pelo usuário', health: { status: 'NOT_CONFIGURED' } },
  { id: 'google_ads', label: 'Google Ads', supplies: ['impressions', 'clicks', 'spend_cents', 'conversions'], freshnessMaxAgeHours: 24, cursor: { kind: 'date', description: 'último dia completo por customer id' }, attribution: 'campanha/grupo de anúncios mapeado explicitamente para um braço', health: { status: 'NOT_CONFIGURED' } },
  { id: 'google_analytics', label: 'Google Analytics', supplies: ['conversions', 'revenue_cents'], freshnessMaxAgeHours: 48, cursor: { kind: 'date', description: 'último dia processado pela propriedade' }, attribution: 'parâmetro de campanha (utm) declarado por braço', health: { status: 'NOT_CONFIGURED' } },
  { id: 'tiktok_ads', label: 'TikTok Ads', supplies: ['impressions', 'clicks', 'spend_cents', 'conversions'], freshnessMaxAgeHours: 24, cursor: { kind: 'date', description: 'último dia completo por anunciante' }, attribution: 'campanha/grupo mapeado explicitamente para um braço', health: { status: 'NOT_CONFIGURED' } },
]

/** Sources available in the MVP: manual entry plus the four providers, all NOT_CONFIGURED. */
export function mvpSources(): GrowthSource[] {
  return [
    { id: 'manual', label: 'Registro manual', kind: 'manual', status: 'MANUAL', lastObservedAt: null },
    ...PROVIDERS.map((provider) => ({ id: provider.id, label: provider.label, kind: provider.id, status: provider.health.status as SourceStatus, lastObservedAt: null })),
  ]
}

export const SOURCE_STATUS_COPY: Record<SourceStatus, { label: string; detail: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  MANUAL: { label: 'Manual', detail: 'Valores digitados por uma pessoa (DECLARED).', tone: 'info' },
  CONNECTED: { label: 'Conectado', detail: 'Sincronizando com a fonte.', tone: 'success' },
  STALE: { label: 'Desatualizado', detail: 'Última sincronização acima do limite de frescor.', tone: 'warning' },
  ERROR: { label: 'Erro', detail: 'A última sincronização falhou.', tone: 'danger' },
  NOT_CONFIGURED: { label: 'Não configurado', detail: 'Integração ainda não disponível. Nenhum dado é importado.', tone: 'neutral' },
  BLOCKED_EXTERNAL: { label: 'Bloqueado externamente', detail: 'Depende de aprovação ou serviço externo.', tone: 'warning' },
}
