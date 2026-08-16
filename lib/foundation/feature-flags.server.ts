import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { FeatureKey } from './contracts'
import {
  resolveFeatureFlag,
  type FeatureFlagDecision,
} from './feature-flags'
import {
  hasFoundationPermission,
  type FoundationPermissionContext,
} from './permissions'
import { createAuditLog } from '@/lib/orcaly-audit'

type FeatureFlagContext = {
  companyId?: string | null
  supabase: SupabaseClient
}

type FeatureFlagRow = {
  key: FeatureKey
  globally_enabled: boolean
  company_overrides_enabled: boolean
}

export class FeatureDisabledError extends Error {
  readonly feature: FeatureKey

  constructor(feature: FeatureKey) {
    super(`Feature desabilitada: ${feature}`)
    this.name = 'FeatureDisabledError'
    this.feature = feature
  }
}

export async function getFeatureDecision(
  key: FeatureKey,
  context: FeatureFlagContext,
): Promise<FeatureFlagDecision> {
  const { data: flagData, error: flagError } = await context.supabase
    .from('feature_flags')
    .select('key,globally_enabled,company_overrides_enabled')
    .eq('key', key)
    .maybeSingle()

  if (flagError) throw flagError

  const flag = flagData as FeatureFlagRow | null
  if (!flag) return resolveFeatureFlag(null, key)

  let companyOverride: boolean | null = null

  if (context.companyId && flag.company_overrides_enabled) {
    const { data: overrideData, error: overrideError } = await context.supabase
      .from('company_feature_flags')
      .select('enabled')
      .eq('company_id', context.companyId)
      .eq('feature_key', key)
      .maybeSingle()

    if (overrideError) throw overrideError
    companyOverride = typeof overrideData?.enabled === 'boolean'
      ? overrideData.enabled
      : null
  }

  return resolveFeatureFlag({
    key,
    globallyEnabled: flag.globally_enabled,
    companyOverridesEnabled: flag.company_overrides_enabled,
    companyOverride,
  })
}

export async function isFeatureEnabled(
  key: FeatureKey,
  context: FeatureFlagContext,
): Promise<boolean> {
  try {
    return (await getFeatureDecision(key, context)).enabled
  } catch (error) {
    console.error('[Orcaly Feature Flag] Avaliacao falhou; usando fail-closed.', {
      feature: key,
      companyId: context.companyId || null,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return false
  }
}

export async function assertFeatureEnabled(
  key: FeatureKey,
  context: FeatureFlagContext,
) {
  const decision = await getFeatureDecision(key, context)
  if (!decision.enabled) throw new FeatureDisabledError(key)
  return decision
}

export async function setCompanyFeatureFlag(
  key: FeatureKey,
  enabled: boolean,
  context: FeatureFlagContext & FoundationPermissionContext & {
    companyId: string
    userId: string
    request?: NextRequest
  },
) {
  if (!hasFoundationPermission(context, 'automation.manage')) {
    throw new Error('Sem permissao para gerenciar feature flags.')
  }

  const { data, error } = await context.supabase
    .from('company_feature_flags')
    .upsert({
      company_id: context.companyId,
      feature_key: key,
      enabled,
      updated_by: context.userId,
    }, { onConflict: 'company_id,feature_key' })
    .select('company_id,feature_key,enabled,updated_at')
    .single()

  if (error) throw error

  await createAuditLog(context.supabase, {
    company_id: context.companyId,
    user_id: context.userId,
    action: enabled ? 'feature_enabled' : 'feature_disabled',
    entity: 'company_feature_flags',
    entity_id: key,
    details: { feature: key, enabled },
    request: context.request,
  })

  return data
}
