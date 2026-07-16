/* eslint-disable @typescript-eslint/no-explicit-any */
import type { getSupabaseAdmin } from '@/lib/company-access'

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export function normalizePlanKey(company: any) {
  const raw = String(
    company?.assinatura_plano ||
    company?.plano ||
    company?.plan_key ||
    company?.subscription_plan ||
    ''
  ).trim().toLowerCase()

  if (['basico', 'básico', 'basic', 'essencial'].includes(raw)) return 'essencial'
  if (['intermediario', 'intermediário', 'profissional', 'professional', 'pro'].includes(raw)) return 'profissional'
  if (['premium', 'avancado', 'avançado'].includes(raw)) return 'premium'

  return raw
}

export function fallbackCommissionPercentage(planKey?: string | null) {
  const plan = String(planKey || '').toLowerCase()
  if (plan === 'premium') return 2
  if (plan === 'profissional') return 3
  if (plan === 'essencial') return 3.5

  const envFallback = toNumber(process.env.ORCALY_MARKETPLACE_DEFAULT_COMMISSION_PERCENTAGE, 3.5)
  return envFallback > 0 ? envFallback : 3.5
}

export async function getMarketplaceCommissionForCompany(
  supabaseAdmin: SupabaseAdmin,
  company: any
) {
  const companyId = String(company?.id || '')
  const planKey = normalizePlanKey(company)

  if (companyId) {
    const { data: companyRule, error: companyRuleError } = await supabaseAdmin
      .from('marketplace_commission_rules')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!companyRuleError && companyRule) {
      return {
        source: 'company_override',
        plan_key: companyRule.plan_key || planKey,
        commission_percentage: toNumber(companyRule.commission_percentage, fallbackCommissionPercentage(planKey)),
        commission_fixed: toNumber(companyRule.commission_fixed, 0),
      }
    }
  }

  if (planKey) {
    const { data: planRule, error: planRuleError } = await supabaseAdmin
      .from('marketplace_commission_rules')
      .select('*')
      .is('company_id', null)
      .eq('plan_key', planKey)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planRuleError && planRule) {
      return {
        source: 'plan_rule',
        plan_key: planRule.plan_key || planKey,
        commission_percentage: toNumber(planRule.commission_percentage, fallbackCommissionPercentage(planKey)),
        commission_fixed: toNumber(planRule.commission_fixed, 0),
      }
    }
  }

  return {
    source: 'fallback',
    plan_key: planKey,
    commission_percentage: fallbackCommissionPercentage(planKey),
    commission_fixed: 0,
  }
}

export function calculateMarketplaceCommission(totalAmount: number, percentage: number, fixed = 0) {
  const total = Math.max(0, roundMoney(totalAmount))
  const percent = Math.max(0, toNumber(percentage, 0))
  const fixedAmount = Math.max(0, toNumber(fixed, 0))
  const raw = roundMoney(total * (percent / 100) + fixedAmount)
  return Math.min(total, Math.max(0, raw))
}
