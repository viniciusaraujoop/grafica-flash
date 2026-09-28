// Industry Pack Contract v1 — closed vocabularies and allowlists.

import type { ItemRequirement, PackItemKind, PackStatus, SettingPath, StatusScope, StatusSemantic, TemplateKind } from './types'

export const PACK_SCHEMA_VERSION = 1 as const

export const PACK_STATUSES: readonly PackStatus[] = ['draft', 'preview', 'published', 'deprecated', 'retired']

export const ITEM_REQUIREMENTS: readonly ItemRequirement[] = ['required', 'default', 'recommended', 'optional']

/** Canonical ordering of kinds used for deterministic output. */
export const PACK_ITEM_KINDS: readonly PackItemKind[] = [
  'module',
  'status',
  'category',
  'dashboard',
  'report',
  'recipe',
  'integration',
  'permission',
  'template',
  'onboarding',
  'setting',
]

export const STATUS_SCOPES: readonly StatusScope[] = ['order', 'proposal', 'lead', 'task']

export const STATUS_SEMANTICS: readonly StatusSemantic[] = [
  'new',
  'in_progress',
  'waiting_customer',
  'waiting_payment',
  'ready',
  'delivered',
  'cancelled',
]

export const TEMPLATE_KINDS: readonly TemplateKind[] = [
  'proposal',
  'ready_message',
  'order_question',
  'site_preset',
  'recommended_field',
]

/** Smart Setup capability vocabulary (closed, v1). Packs declare capabilities from this list only. */
export const CAPABILITY_KEYS = [
  'cap.quotes',
  'cap.custom_production',
  'cap.art_approval',
  'cap.production_tracking',
  'cap.menu_daily_orders',
  'cap.delivery',
  'cap.pickup',
  'cap.on_site_service',
  'cap.appointments',
  'cap.catalog_sales',
  'cap.stock',
  'cap.deposit',
  'cap.crm_followup',
  'cap.team_tasks',
  'cap.marketplace_channel',
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

export const TEMPLATE_PLACEHOLDERS: readonly string[] = ['cliente_nome', 'pedido_numero', 'empresa_nome', 'prazo']

export type SettingValidator = (value: unknown) => boolean

const isStringList = (max: number, maxLen: number): SettingValidator => (value) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= maxLen)

/** Settings a pack may suggest. Credentials, Pix keys, contacts, prices, domains and billing are never allowed. */
export const SETTING_VALIDATORS: Readonly<Record<SettingPath, SettingValidator>> = {
  'orders.questions': isStringList(20, 160),
  'orders.recommendedFields': (value) =>
    Array.isArray(value) &&
    value.length <= 30 &&
    value.every((item) => typeof item === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(item)),
  'proposals.defaultValidityHours': (value) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 24 * 90,
  'payments.depositEnabled': (value) => typeof value === 'boolean',
  'payments.depositPercent': (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
  'site.templateKey': (value) => typeof value === 'string' && /^[a-z][a-z0-9_-]{1,39}$/.test(value),
  'delivery.enabled': (value) => typeof value === 'boolean',
}

export const SETTING_PATHS = Object.keys(SETTING_VALIDATORS) as SettingPath[]

export const PACK_LIMITS = {
  maxItems: 400,
  maxSerializedBytes: 64 * 1024,
  maxSubsegments: 20,
  maxSubsegmentLength: 60,
  maxNameLength: 80,
  maxDescriptionLength: 280,
  maxTemplateTextLength: 1000,
  maxLabelLength: 80,
} as const

export const PACK_KEY_SLUG = /^[a-z][a-z0-9_]{1,39}$/
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
export const ITEM_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/
export const PROVIDER_KEY = /^[a-z0-9_]{2,80}$/
export const REPORT_KEY = /^[a-z][a-z0-9_.]{2,79}$/
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
