import {
  FEATURE_KEYS,
  type FeatureKey,
} from './contracts'

export type FeatureFlagState = {
  key: FeatureKey
  globallyEnabled: boolean
  companyOverridesEnabled: boolean
  companyOverride?: boolean | null
}

export type FeatureFlagDecision = {
  key: FeatureKey
  enabled: boolean
  source: 'global' | 'company' | 'missing'
}

const featureKeySet = new Set<string>(FEATURE_KEYS)

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && featureKeySet.has(value)
}

export function resolveFeatureFlag(
  state: FeatureFlagState | null,
  fallbackKey?: FeatureKey,
): FeatureFlagDecision {
  if (!state) {
    if (!fallbackKey) throw new Error('Feature key ausente.')
    return { key: fallbackKey, enabled: false, source: 'missing' }
  }

  if (
    state.companyOverridesEnabled &&
    typeof state.companyOverride === 'boolean'
  ) {
    return {
      key: state.key,
      enabled: state.companyOverride,
      source: 'company',
    }
  }

  return {
    key: state.key,
    enabled: state.globallyEnabled,
    source: 'global',
  }
}
