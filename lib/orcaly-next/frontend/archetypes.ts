export const ORCALY_PAGE_ARCHETYPES = [
  { key: 'dashboard', title: 'Dashboard', density: 'comfortable', intent: 'prioritize' },
  { key: 'data-list', title: 'Data List', density: 'compact', intent: 'scan-act' },
  { key: 'detail', title: 'Detail', density: 'comfortable', intent: 'understand-act' },
  { key: 'analytics', title: 'Analytics', density: 'comfortable', intent: 'compare' },
  { key: 'settings', title: 'Settings', density: 'comfortable', intent: 'configure' },
  { key: 'editor', title: 'Editor', density: 'comfortable', intent: 'create' },
  { key: 'wizard', title: 'Wizard', density: 'comfortable', intent: 'complete-steps' },
  { key: 'checkout', title: 'Checkout', density: 'comfortable', intent: 'confirm' },
  { key: 'reader', title: 'Reader', density: 'editorial', intent: 'read' },
  { key: 'search', title: 'Search', density: 'comfortable', intent: 'find' },
  { key: 'empty', title: 'Empty State', density: 'comfortable', intent: 'recover-empty' },
  { key: 'error', title: 'Error State', density: 'comfortable', intent: 'recover-error' },
  { key: 'onboarding', title: 'Onboarding', density: 'editorial', intent: 'orient' },
  { key: 'command', title: 'Command Surface', density: 'compact', intent: 'navigate-fast' },
  { key: 'timeline', title: 'Timeline', density: 'comfortable', intent: 'trace' },
  { key: 'workflow', title: 'Workflow Canvas', density: 'compact', intent: 'compose-flow' },
  { key: 'market', title: 'Marketplace Discovery', density: 'comfortable', intent: 'discover-compare' },
  { key: 'financial', title: 'Financial Overview', density: 'comfortable', intent: 'understand-money' },
] as const

export type OrcalyArchetypeKey = (typeof ORCALY_PAGE_ARCHETYPES)[number]['key']
export type OrcalyArchetype = (typeof ORCALY_PAGE_ARCHETYPES)[number]

export const REQUIRED_STATES = [
  'default', 'hover', 'focus', 'active', 'pressed', 'selected', 'disabled', 'loading',
  'success', 'warning', 'error', 'empty', 'no_permission', 'no_entitlement', 'offline', 'unavailable',
] as const

export type OrcalyUiState = (typeof REQUIRED_STATES)[number]

export const PRODUCT_EXPERIENCE = {
  hub: { tone: 'neutral', density: 'comfortable', composition: 'navigation-first' },
  business: { tone: 'operational', density: 'compact', composition: 'queue-and-actions' },
  wealth: { tone: 'calm', density: 'editorial', composition: 'explain-before-act' },
  growth: { tone: 'energetic', density: 'comfortable', composition: 'compare-and-learn' },
  academy: { tone: 'editorial', density: 'editorial', composition: 'content-first' },
  flow: { tone: 'technical', density: 'compact', composition: 'canvas-first' },
  market: { tone: 'solution', density: 'comfortable', composition: 'search-and-compare' },
  partners: { tone: 'commercial', density: 'comfortable', composition: 'pipeline-first' },
  one: { tone: 'premium', density: 'editorial', composition: 'access-pass' },
} as const

export function getArchetype(key: OrcalyArchetypeKey): OrcalyArchetype {
  return ORCALY_PAGE_ARCHETYPES.find((item) => item.key === key)!
}
