import type { IntegrationProviderKey } from '@/lib/integrations/core/types'

export type ProviderConfigurationField = {
  key: string
  label: string
  kind: 'text' | 'secret' | 'select'
  required?: boolean
  options?: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
}

export type ProviderConfigurationSpec = {
  fields: readonly ProviderConfigurationField[]
  credentialKeys: readonly string[]
}

const environmentField: ProviderConfigurationField = {
  key: 'environment',
  label: 'Ambiente',
  kind: 'select',
  required: true,
  options: [
    { value: 'sandbox', label: 'Sandbox / homologação' },
    { value: 'production', label: 'Produção' },
  ],
}

const emptySpec: ProviderConfigurationSpec = { fields: [], credentialKeys: [] }

const specs: Partial<Record<IntegrationProviderKey, ProviderConfigurationSpec>> = {
  google_maps: {
    fields: [{ key: 'api_key', label: 'Chave da API do Google Maps', kind: 'secret', required: true, placeholder: 'Configurada somente no servidor' }],
    credentialKeys: ['api_key'],
  },
  nfse: {
    fields: [
      { key: 'provider_name', label: 'Provedor fiscal', kind: 'text', required: true, placeholder: 'Município ou integrador fiscal' },
      environmentField,
      { key: 'api_key', label: 'Credencial do provedor', kind: 'secret', required: true },
    ],
    credentialKeys: ['api_key'],
  },
  clicksign: {
    fields: [environmentField, { key: 'api_key', label: 'Token da Clicksign', kind: 'secret', required: true }],
    credentialKeys: ['api_key'],
  },
  shopee: {
    fields: [
      { key: 'partner_id', label: 'Partner ID', kind: 'text', required: true },
      { key: 'partner_key', label: 'Partner key', kind: 'secret', required: true },
    ],
    credentialKeys: ['partner_key'],
  },
  omie: {
    fields: [
      { key: 'app_key', label: 'App key', kind: 'secret', required: true },
      { key: 'app_secret', label: 'App secret', kind: 'secret', required: true },
    ],
    credentialKeys: ['app_key', 'app_secret'],
  },
}

export function getProviderConfigurationSpec(provider: IntegrationProviderKey): ProviderConfigurationSpec {
  return specs[provider] || emptySpec
}

export function providerHasConfigurationForm(provider: IntegrationProviderKey) {
  return getProviderConfigurationSpec(provider).fields.length > 0
}

function normalizeText(value: unknown, limit = 300) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized && normalized.length <= limit ? normalized : null
}

export function validateProviderConfiguration(provider: IntegrationProviderKey, value: unknown, previousCredentials: Record<string, unknown> | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false as const, error: 'Configuração inválida.' }
  const input = value as Record<string, unknown>
  const spec = getProviderConfigurationSpec(provider)
  if (!spec.fields.length) return { ok: false as const, error: 'Este provedor não possui configuração manual disponível.' }

  const config: Record<string, string> = {}
  const credentials: Record<string, string> = {}
  for (const field of spec.fields) {
    const raw = normalizeText(input[field.key], field.kind === 'secret' ? 1_000 : 300)
    const previousValue = previousCredentials?.[field.key]
    const existing = typeof previousValue === 'string' ? previousValue.trim() : ''
    if (field.kind === 'select' && raw && !field.options?.some((option) => option.value === raw)) {
      return { ok: false as const, error: `${field.label} inválido.` }
    }
    if (field.required && !raw && !(field.kind === 'secret' && existing)) {
      return { ok: false as const, error: `${field.label} é obrigatório.` }
    }
    if (!raw) continue
    if (spec.credentialKeys.includes(field.key)) credentials[field.key] = raw
    else config[field.key] = raw
  }

  return { ok: true as const, config, credentials }
}
