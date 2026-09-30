/**
 * Orçaly Next — product status model (isolated, pure TypeScript).
 *
 * Separates two things the current runtime conflates:
 *  - ReleaseStatus: is the PRODUCT built and released? (catalog truth)
 *  - AccountSignal: what does THIS ACCOUNT have for the product? (commercial truth)
 * The eight Hub statuses are derived from both. Nothing here grants access:
 * authorization stays in lib/ecosystem/access.ts and on the server.
 */

export const HUB_STATUSES = [
  'ACTIVE',
  'TRIAL',
  'AVAILABLE',
  'NOT_SUBSCRIBED',
  'PAYMENT_PENDING',
  'SUSPENDED',
  'COMING_SOON',
  'BLOCKED_EXTERNAL',
] as const
export type HubStatus = (typeof HUB_STATUSES)[number]

/** Product release. Mirrors lib/ecosystem/products.ts: available → LIVE, preview → EARLY_ACCESS, planned → IN_DEVELOPMENT. */
export const RELEASE_STATUSES = ['LIVE', 'EARLY_ACCESS', 'IN_DEVELOPMENT'] as const
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number]

/**
 * Account signal for one product, already resolved by the server from effective entitlements.
 * NONE    = never had it.
 * LAPSED  = had it before (cancelled/expired), no current source.
 */
export const ACCOUNT_SIGNALS = ['NONE', 'LAPSED', 'ENTITLED', 'TRIAL', 'PAYMENT_PENDING', 'SUSPENDED'] as const
export type AccountSignal = (typeof ACCOUNT_SIGNALS)[number]

export type HubStatusInput = {
  release: ReleaseStatus
  account: AccountSignal
  /** true when a REQUIRED external dependency is missing (provider, partner API). */
  externalBlocked: boolean
}

/**
 * Deterministic precedence:
 * 1. IN_DEVELOPMENT → COMING_SOON (nothing to open, whatever the account says)
 * 2. SUSPENDED / PAYMENT_PENDING (account problems must be visible even if blocked externally)
 * 3. externalBlocked → BLOCKED_EXTERNAL
 * 4. TRIAL / ENTITLED → TRIAL / ACTIVE
 * 5. EARLY_ACCESS without entitlement → COMING_SOON (invite-only, not purchasable)
 * 6. LAPSED → NOT_SUBSCRIBED; NONE → AVAILABLE
 */
export function deriveHubStatus(input: HubStatusInput): HubStatus {
  if (input.release === 'IN_DEVELOPMENT') return 'COMING_SOON'
  if (input.account === 'SUSPENDED') return 'SUSPENDED'
  if (input.account === 'PAYMENT_PENDING') return 'PAYMENT_PENDING'
  if (input.externalBlocked) return 'BLOCKED_EXTERNAL'
  if (input.account === 'TRIAL') return 'TRIAL'
  if (input.account === 'ENTITLED') return 'ACTIVE'
  if (input.release === 'EARLY_ACCESS') return 'COMING_SOON'
  if (input.account === 'LAPSED') return 'NOT_SUBSCRIBED'
  return 'AVAILABLE'
}

/** Statuses whose primary action opens the authenticated app. */
export const APP_DESTINATION_STATUSES: readonly HubStatus[] = ['ACTIVE', 'TRIAL']

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

export type HubStatusCopy = {
  label: string
  /** One sentence. Never promises a date, price or feature. */
  detail: string
  action: string
  tone: Tone
}

export const hubStatusCopy: Record<HubStatus, HubStatusCopy> = {
  ACTIVE: { label: 'Ativo', detail: 'Seu acesso está ativo.', action: 'Abrir', tone: 'success' },
  TRIAL: { label: 'Em teste', detail: 'Você está no período de teste deste produto.', action: 'Abrir', tone: 'info' },
  AVAILABLE: { label: 'Disponível', detail: 'Confira a disponibilidade e como começar.', action: 'Conhecer', tone: 'accent' },
  NOT_SUBSCRIBED: { label: 'Sem assinatura', detail: 'Sua assinatura deste produto não está ativa.', action: 'Ver opções', tone: 'neutral' },
  PAYMENT_PENDING: { label: 'Pagamento pendente', detail: 'Há um pagamento aguardando confirmação.', action: 'Ver pagamento', tone: 'warning' },
  SUSPENDED: { label: 'Suspenso', detail: 'O acesso está suspenso. Seus dados não foram apagados.', action: 'Entender', tone: 'danger' },
  COMING_SOON: { label: 'Em breve', detail: 'Ainda não disponível para contratação.', action: 'Saiba mais', tone: 'neutral' },
  BLOCKED_EXTERNAL: { label: 'Aguardando integração', detail: 'Depende de um serviço externo que ainda não está configurado.', action: 'Detalhes', tone: 'warning' },
}

export function isHubStatus(value: unknown): value is HubStatus {
  return typeof value === 'string' && (HUB_STATUSES as readonly string[]).includes(value)
}

/** Maps the current runtime vocabulary (lib/ecosystem/products.ts) to ReleaseStatus. */
export function releaseFromLegacy(status: 'available' | 'preview' | 'planned'): ReleaseStatus {
  return status === 'available' ? 'LIVE' : status === 'preview' ? 'EARLY_ACCESS' : 'IN_DEVELOPMENT'
}
