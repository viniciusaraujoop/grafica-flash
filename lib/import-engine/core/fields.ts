// Destination allowlists (§11/§12, preflight §15/§16) and the bounded alias registry (§13).
// Destinations are conceptual field ids, never database column names. Registries are Maps.

import type { DestinationField, ImportEntity } from './types'

const field = (id: string, entity: ImportEntity, kind: DestinationField['kind'], required: boolean, maxChars: number, pii: boolean, trim: boolean): DestinationField => ({
  id,
  entity,
  kind,
  required,
  maxChars,
  pii,
  trim,
  allowNegative: false,
})

/** Canonical destination order per entity (also the row value / fingerprint order). */
export const DESTINATIONS: Readonly<Record<ImportEntity, readonly DestinationField[]>> = {
  CUSTOMERS: [
    field('customer.name', 'CUSTOMERS', 'text', true, 200, true, true),
    field('customer.email', 'CUSTOMERS', 'email', false, 254, true, true),
    field('customer.phone', 'CUSTOMERS', 'phone', false, 32, true, true),
  ],
  PRODUCTS: [
    field('product.name', 'PRODUCTS', 'text', true, 200, false, true),
    // SKU is opaque: no trim, no case change, no numeric conversion (leading zeros preserved).
    field('product.sku', 'PRODUCTS', 'opaque_text', false, 64, false, false),
    field('product.price', 'PRODUCTS', 'decimal', false, 32, false, true),
    field('product.stock', 'PRODUCTS', 'integer', false, 12, false, true),
    // Description keeps its whitespace exactly (no generic trim).
    field('product.description', 'PRODUCTS', 'text', false, 5000, false, false),
    field('product.category', 'PRODUCTS', 'text', false, 120, false, true),
    field('product.active', 'PRODUCTS', 'boolean', false, 8, false, true),
    field('product.price_on_request', 'PRODUCTS', 'boolean', false, 8, false, true),
  ],
}

const BY_ID = new Map<string, DestinationField>()
for (const entity of Object.keys(DESTINATIONS) as ImportEntity[]) for (const destination of DESTINATIONS[entity]) BY_ID.set(destination.id, destination)

export function destinationFor(entity: ImportEntity, id: unknown): DestinationField | null {
  if (typeof id !== 'string') return null
  const destination = BY_ID.get(id)
  return destination && destination.entity === entity ? destination : null
}

/**
 * Internal / never-mappable names (§11, §12, preflight §21), compared on the reserved key
 * (canonical header with space/_/-/. unified). They can only be IGNORED; no destination accepts them.
 */
export const RESERVED_HEADER_KEYS: ReadonlySet<string> = new Set([
  // structural JS names (prototype pollution)
  '__proto__', 'prototype', 'constructor',
  // tenant / authority / identity
  'company_id', 'companyid', 'tenant_id', 'tenantid', 'owner_id', 'user_id', 'id', 'uuid', 'account_id',
  // generated / normalized / provenance
  'contact_key', 'normalized_name', 'phone_normalized', 'email_normalized', 'source', 'source_id',
  'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at', 'merged_into_id', 'archived', 'metadata',
  // products: internal / configuration / nested
  'business_type', 'cost', 'custo', 'margin', 'margem', 'internal_margin', 'configuracoes', 'configuracao', 'extras',
  'variations', 'variacoes', 'addons', 'adicionais', 'deposit', 'deposito_percentual', 'payment_config', 'payment_configuration',
  // platform / billing / secrets / integrations / audit
  'plan', 'plano', 'subscription_status', 'entitlement', 'entitlements', 'access_token', 'api_key', 'token', 'secret', 'password', 'senha',
  'provider', 'provider_state', 'integration', 'integration_state', 'webhook', 'audit', 'audit_log',
  // automation authority (CSV has none)
  'trigger_automation', 'automation', 'automations', 'send_whatsapp', 'notify',
])

/** Bounded alias registry: canonical header → allowlisted destinations. Multiple = ambiguous. */
const ALIASES: Readonly<Record<ImportEntity, ReadonlyArray<readonly [string, readonly string[]]>>> = {
  CUSTOMERS: [
    ['customer.name', ['customer.name']], ['nome', ['customer.name']], ['name', ['customer.name']], ['cliente', ['customer.name']],
    ['nome do cliente', ['customer.name']], ['nome completo', ['customer.name']], ['customer', ['customer.name']], ['customer name', ['customer.name']],
    ['customer.email', ['customer.email']], ['email', ['customer.email']], ['e-mail', ['customer.email']], ['e mail', ['customer.email']],
    ['customer.phone', ['customer.phone']], ['telefone', ['customer.phone']], ['celular', ['customer.phone']], ['whatsapp', ['customer.phone']],
    ['fone', ['customer.phone']], ['phone', ['customer.phone']], ['tel', ['customer.phone']],
    // Deliberately ambiguous: a "contact" column may hold an email or a phone → user decides.
    ['contato', ['customer.email', 'customer.phone']], ['contact', ['customer.email', 'customer.phone']],
  ],
  PRODUCTS: [
    ['product.name', ['product.name']], ['nome', ['product.name']], ['produto', ['product.name']], ['nome do produto', ['product.name']], ['name', ['product.name']], ['product', ['product.name']],
    ['product.sku', ['product.sku']], ['sku', ['product.sku']], ['codigo', ['product.sku']], ['código', ['product.sku']], ['cod', ['product.sku']], ['referencia', ['product.sku']], ['referência', ['product.sku']], ['ref', ['product.sku']],
    ['product.price', ['product.price']], ['preco', ['product.price']], ['preço', ['product.price']], ['price', ['product.price']], ['valor', ['product.price']],
    ['product.stock', ['product.stock']], ['estoque', ['product.stock']], ['stock', ['product.stock']], ['quantidade em estoque', ['product.stock']],
    ['product.description', ['product.description']], ['descricao', ['product.description']], ['descrição', ['product.description']], ['description', ['product.description']],
    ['product.category', ['product.category']], ['categoria', ['product.category']], ['category', ['product.category']],
    ['product.active', ['product.active']], ['ativo', ['product.active']], ['active', ['product.active']],
    ['product.price_on_request', ['product.price_on_request']], ['sob consulta', ['product.price_on_request']], ['preco sob consulta', ['product.price_on_request']],
    ['preço sob consulta', ['product.price_on_request']], ['price on request', ['product.price_on_request']],
    // Ambiguous: "quantidade" may be stock or a sale quantity; "status" may be active or something else.
    ['quantidade', ['product.stock']], ['qtd', ['product.stock']],
  ],
}

const ALIAS_INDEX = new Map<ImportEntity, Map<string, readonly string[]>>()
for (const entity of Object.keys(ALIASES) as ImportEntity[]) ALIAS_INDEX.set(entity, new Map(ALIASES[entity]))

export function aliasCandidates(entity: ImportEntity, canonical: string): readonly string[] {
  return ALIAS_INDEX.get(entity)?.get(canonical) ?? []
}

export function aliasRegistrySize(entity: ImportEntity): number {
  return ALIASES[entity].length
}
