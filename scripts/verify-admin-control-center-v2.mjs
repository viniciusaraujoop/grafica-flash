import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const platformAdmin = read('lib/platform-admin.ts')
const control = read('lib/admin/control-center-v2.ts')
const companyAction = read('app/api/admin/company/[id]/route.ts')
const webhooks = read('app/api/admin/webhooks/route.ts')
const supportMode = read('app/api/admin/support-mode/route.ts')
const flags = read('lib/admin/feature-flags.ts')
const ai = read('app/api/admin/ai/route.ts')
const migration = read('supabase/migrations/20260819230000_admin_control_center_v2.sql')
const shell = read('components/admin/AdminShellV2.tsx')
const clientFiles = [
  'components/admin/AdminShellV2.tsx',
  'components/admin/AdminControlCenterV2.tsx',
  'components/admin/AdminCompaniesV2.tsx',
  'components/admin/AdminCompany360.tsx',
  'components/admin/AdminUsersV2.tsx',
  'components/admin/AdminMetricsV2.tsx',
  'components/admin/AdminFeatureFlagsV2.tsx',
  'components/admin/AdminSupportCenterV2.tsx',
  'components/admin/AdminWebhookInspectorV2.tsx',
  'components/admin/AdminSecurityCenterV2.tsx',
  'components/admin/AdminSystemHealthV2.tsx',
  'components/admin/AdminCustomerSuccessV2.tsx',
  'components/admin/AdminPaymentsV2.tsx',
  'components/admin/AdminNotificationsV2.tsx',
  'components/admin/AdminDailyBriefV2.tsx',
  'components/admin/AdminTeamV2.tsx',
]

for (const role of ['platform_admin','finance','support','security','operations','viewer','prospector']) assert(platformAdmin.includes(`'${role}'`), `RBAC role missing: ${role}`)
for (const permission of ['companies.read','companies.block','billing.manage','partners.payout','support.impersonate_readonly','security.manage','features.manage','admins.manage','webhooks.retry']) assert(platformAdmin.includes(`'${permission}'`), `RBAC permission missing: ${permission}`)
assert(platformAdmin.includes('SECRET_KEY') && platformAdmin.includes('[REDACTED]'), 'Audit sanitization invariant missing')
assert(companyAction.includes("reason.length < 8"), 'Sensitive company actions must require reason')
assert(companyAction.includes("'Idempotency-Key'") || companyAction.includes("'idempotency-key'"), 'Billing admin actions must use idempotency key')
assert(companyAction.includes("company_${action}"), 'Admin company actions must be audited')
assert(control.includes('mrrCoverage') && control.includes("churn: { value: null"), 'Control Center must expose data quality and avoid fake churn')
assert(control.includes('calculateCompanyHealth') && control.includes("'AT_RISK'"), 'Explainable health score missing')
assert(webhooks.includes('retrySupported: false'), 'Webhook replay must remain blocked until proven idempotent')
assert(webhooks.includes('payload_sanitized'), 'Webhook inspector must use sanitized payload')
assert(supportMode.includes('support.impersonate_readonly') && supportMode.includes('support_mode_readonly_started'), 'Support mode must be permissioned and audited')
assert(flags.includes("priority = { global: 1, plan: 2, segment: 3, company: 4 }"), 'Feature flag precedence invariant missing')
assert(ai.includes('Não invente evento') && ai.includes('fallback'), 'Admin AI guardrails/fallback missing')
assert(!ai.includes('tools:'), 'Admin AI must not receive action tools')
assert(migration.includes('platform_support_tickets') && migration.includes('platform_feature_flags'), 'Required additive schema missing')
assert(migration.includes('enable row level security'), 'New admin tables must enable RLS')
assert(migration.includes('complete_platform_admin_invite'), 'RBAC invitation RPC evolution missing')
assert(shell.includes('Ctrl K') && shell.includes('/admin/notificacoes'), 'Global search or critical alerts missing from shell')
for (const file of clientFiles) {
  const source = read(file)
  assert(!source.includes('SUPABASE_SERVICE_ROLE_KEY'), `Service role reference leaked to client file: ${file}`)
  assert(!source.includes('service_role'), `service_role literal leaked to client file: ${file}`)
}

console.log('Admin Control Center v2 invariants: PASS')
