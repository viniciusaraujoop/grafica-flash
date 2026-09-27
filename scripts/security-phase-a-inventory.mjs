import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoots = ['app', 'components', 'lib', 'proxy.ts', 'next.config.ts']
const codeExt = /\.(?:ts|tsx|js|jsx|mjs)$/

function walk(entry) {
  const full = path.join(root, entry)
  if (!fs.existsSync(full)) return []
  const stat = fs.statSync(full)
  if (stat.isFile()) return codeExt.test(entry) ? [full] : []
  const out = []
  for (const item of fs.readdirSync(full, { withFileTypes: true })) {
    const next = path.join(entry, item.name)
    if (item.isDirectory()) out.push(...walk(next))
    else if (codeExt.test(item.name) && !item.name.includes('.backup-') && !item.name.endsWith('.bak')) out.push(path.join(root, next))
  }
  return out
}

const files = sourceRoots.flatMap(walk)
const routes = files.filter((file) => {
  const rel = path.relative(root, file).replaceAll('\\\\', '/')
  return rel.startsWith('app/api/') && rel.endsWith('/route.ts')
})

function has(source, rx) { return rx.test(source) }
function envNames(source) { return [...new Set([...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort() }

function classifyPath(rel, signals) {
  if (rel.includes('/webhook')) return 'WEBHOOK_SIGNED'
  if (rel.includes('/callback/')) return 'OAUTH_CALLBACK'
  if (rel.startsWith('app/api/cron/')) return 'INTERNAL_CRON'
  if (rel.startsWith('app/api/internal/')) return 'INTERNAL_QA'
  if (rel.startsWith('app/api/admin/') || rel.startsWith('app/api/platform-admin/')) return 'ADMIN_ONLY'
  if (rel.startsWith('app/api/wealth/')) return 'PERSONAL_SCOPED'
  if (rel === 'app/api/parceiros/register/route.ts' || rel === 'app/api/parceiros/track/route.ts') return 'PUBLIC_ANON'
  if (rel.startsWith('app/api/parceiros/')) return 'PARTNER_SCOPED'
  if (rel.endsWith('/health/route.ts') || rel === 'app/api/system/health/route.ts' || rel === 'app/api/v1/health/route.ts') return 'PUBLIC_HEALTH_READONLY'
  if (
    rel.startsWith('app/api/public/') ||
    rel.startsWith('app/api/checkout/') ||
    rel.startsWith('app/api/marketplace/store/') ||
    rel === 'app/api/marketplace/order/route.ts' ||
    rel === 'app/api/marketplace/coupon/route.ts' ||
    rel.includes('/[token]/') ||
    rel.startsWith('app/api/founders/activate/') ||
    rel.startsWith('app/api/team-invites/activate/') ||
    rel.startsWith('app/api/arte/')
  ) return 'PUBLIC_ANON'
  if (
    rel.startsWith('app/api/company/') ||
    rel.startsWith('app/api/orders/') ||
    rel.startsWith('app/api/tasks/') ||
    rel.startsWith('app/api/reports/') ||
    rel.startsWith('app/api/payments/') ||
    rel.startsWith('app/api/integrations/') ||
    rel.startsWith('app/api/crm/') ||
    rel.startsWith('app/api/customer-') ||
    rel.startsWith('app/api/coupons/') ||
    rel.startsWith('app/api/site/') ||
    rel.startsWith('app/api/notifications/') ||
    rel.startsWith('app/api/onboarding/') ||
    rel.startsWith('app/api/opportunities/') ||
    rel.startsWith('app/api/panel/') ||
    rel.startsWith('app/api/producao/') ||
    rel.startsWith('app/api/products/') ||
    rel.startsWith('app/api/balcao/') ||
    rel.startsWith('app/api/data-quality/')
  ) return 'COMPANY_SCOPED'
  if (signals.authUser) return 'AUTH_USER'
  return 'UNKNOWN'
}

function authSummary(signals) {
  if (signals.platformAdmin) return 'platform-admin helper'
  if (signals.cronSecret) return 'CRON secret'
  if (signals.webhookSignature) return 'provider signature/token'
  if (signals.oauthState) return 'OAuth state/callback contract'
  if (signals.partner) return 'partner/affiliate context'
  if (signals.company) return 'authenticated + company context'
  if (signals.authUser) return 'authenticated user'
  return 'none detected'
}

function statusFor(cls, signals, methods) {
  const mutating = methods.some((m) => !['GET','HEAD','OPTIONS'].includes(m))
  if (cls === 'PUBLIC_ANON') return 'INTENTIONAL_PUBLIC'
  if (cls === 'PUBLIC_HEALTH_READONLY') return mutating ? 'PARTIAL' : 'PASS'
  if (cls === 'WEBHOOK_SIGNED') return signals.webhookSignature ? (signals.bodyBound || signals.idempotency ? 'PASS' : 'PARTIAL') : 'FAIL'
  if (cls === 'OAUTH_CALLBACK') return signals.oauthState ? 'PASS' : 'FAIL'
  if (cls === 'INTERNAL_CRON') return signals.cronSecret ? 'PASS' : 'FAIL'
  if (cls === 'INTERNAL_QA') return (signals.internalGuard || signals.authUser) ? 'PASS' : 'PARTIAL'
  if (cls === 'ADMIN_ONLY') return signals.platformAdmin ? 'PASS' : 'FAIL'
  if (cls === 'PARTNER_SCOPED') return (signals.partner || signals.authUser || signals.platformAdmin) ? 'PASS' : 'PARTIAL'
  if (cls === 'PERSONAL_SCOPED') return (signals.personalOwner || signals.entitlement) ? 'PASS' : (signals.authUser ? 'PARTIAL' : 'FAIL')
  if (cls === 'COMPANY_SCOPED') return signals.company ? 'PASS' : (signals.authUser ? 'PARTIAL' : 'FAIL')
  if (cls === 'AUTH_USER') return signals.authUser ? 'PASS' : 'FAIL'
  return 'UNKNOWN'
}

const routeRows = routes.map((file) => {
  const rel = path.relative(root, file).replaceAll('\\\\', '/')
  const source = fs.readFileSync(file, 'utf8')
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g)].map((m) => m[1])
  const signals = {
    platformAdmin: has(source, /requirePlatformAdmin|requireOfficialPlatformOwner|getCurrentAdmin|requireOfficialPlatformOwner/),
    authUser: has(source, /getRequester\(|auth\.getUser\(|auth\.getClaims\(|requireUser\b|resolve.*ServerContext|requireUserCompany\(/i),
    company: has(source, /getCompanyAccess|requireUserCompany\(|resolveIntegrationServerContext|company_id|companyId|access\.company|context\.company/i),
    personalOwner: has(source, /wealth|owner_id|user_id|personal/i),
    entitlement: has(source, /entitlement|requireProductAccess|product_entitlement|wealth.*access/i),
    partner: has(source, /affiliate|partner|parceiro/i),
    mfa: has(source, /requireMfa|aal2|step.?up/i),
    rateLimit: has(source, /enforceRateLimit|consumeRateLimit|rate.?limit/i),
    origin: has(source, /requireSameOrigin|sameOriginAllowed|sec-fetch-site|headers\.get\(['"]origin/i),
    inputValidation: has(source, /readJsonBody|rejectOversizedRequest|safeParse|zod|isUuid|validate|normalize|ALLOWED_|MAX_|\.slice\(/i),
    idempotency: has(source, /idempoten|provider_event_id|event_idempotency|payload_hash|duplicate/i),
    webhookSignature: has(source, /timingSafeEqual|verify[A-Za-z0-9]*Webhook|verifySvix|x-signature|x-hub-signature|asaas-access-token|webhook.*secret|secureCalendarChannelTokenMatches/i),
    replayDefense: has(source, /timestamp|tolerance|idempoten|provider_event_id|event_idempotency|payload_hash/i),
    bodyBound: has(source, /rejectOversizedRequest|readJsonBody|content-length|1_000_000|arrayBuffer\(\)/i),
    oauthState: has(source, /oauth.*state|consume.*state|code_verifier|pkce|stateToken|oauthState/i),
    cronSecret: has(source, /CRON_SECRET|x-cron|authorization.*bearer/i),
    internalGuard: has(source, /PREVIEW|QA_|INTERNAL_|VERCEL|authorization|secret/i),
    serviceRole: has(source, /SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdmin\(|supabaseAdmin/i),
    sharedErrorReporter: has(source, /recordApplicationError|application_error|reportApplication/i),
    consoleLog: has(source, /console\.(?:log|info|warn|error)/),
  }
  const cls = classifyPath(rel, signals)
  return {
    path: '/' + rel.replace(/^app\//, '').replace(/\/route\.ts$/, ''),
    file: rel,
    methods: methods.length ? methods : ['UNKNOWN'],
    class: cls,
    authentication: authSummary(signals),
    authorization: signals.platformAdmin ? 'platform permission/role' : signals.company ? 'company/resource context' : signals.entitlement ? 'personal entitlement/owner' : signals.partner ? 'partner context' : signals.authUser ? 'user session' : cls === 'PUBLIC_ANON' ? 'public by design' : 'not detected',
    tenantOwnership: signals.company ? 'company/resource predicates detected' : signals.personalOwner ? 'personal/owner predicates detected' : cls === 'PUBLIC_ANON' ? 'public/token/store scope' : 'not detected',
    entitlement: signals.entitlement ? 'yes' : 'n/a/not detected',
    mfa: signals.mfa ? 'step-up detected' : 'not detected/not applicable',
    validation: signals.inputValidation || signals.bodyBound ? 'detected' : 'limited/not detected',
    rateLimit: signals.rateLimit ? 'yes' : 'no/not detected',
    csrfOrigin: signals.origin ? 'origin control detected' : (['WEBHOOK_SIGNED','OAUTH_CALLBACK','INTERNAL_CRON'].includes(cls) ? 'not browser-CSRF route' : 'not detected'),
    idempotency: signals.idempotency ? 'yes' : 'no/not detected',
    webhookSignature: signals.webhookSignature ? 'yes' : cls === 'WEBHOOK_SIGNED' ? 'NO DETECTED' : 'n/a',
    replayDefense: signals.replayDefense ? 'detected' : cls === 'WEBHOOK_SIGNED' ? 'not detected' : 'n/a',
    secretUse: envNames(source).filter((n) => !n.startsWith('NEXT_PUBLIC_')),
    responseSensitivity: /admin|finance|payment|wealth|company|order|customer|user|audit|security|document/i.test(rel) ? 'sensitive/internal' : 'low/public-or-operational',
    logging: signals.sharedErrorReporter ? 'shared reporter' : signals.consoleLog ? 'console logging present' : 'no explicit logging detected',
    status: statusFor(cls, signals, methods),
  }
}).sort((a,b) => a.file.localeCompare(b.file))

const envMap = new Map()
const browserStorage = []
const serviceRoleFiles = []
const clientSecretViolations = []

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\\\', '/')
  const source = fs.readFileSync(file, 'utf8')
  const client = /^\s*['"]use client['"];?/m.test(source)
  const names = envNames(source)
  for (const name of names) {
    const row = envMap.get(name) || { name, files: new Set(), clientFiles: new Set() }
    row.files.add(rel)
    if (client) row.clientFiles.add(rel)
    envMap.set(name, row)
  }
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(source)) serviceRoleFiles.push({ file: rel, client })
  for (const match of source.matchAll(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/g)) {
    browserStorage.push({ file: rel, api: match[1] })
  }
  if (client && /process\.env\.(?!NEXT_PUBLIC_)/.test(source)) clientSecretViolations.push(rel)
}

function envClass(name) {
  if (name.startsWith('NEXT_PUBLIC_')) {
    if (/(SERVICE_ROLE|SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY|ENCRYPTION_KEY|CRON)/.test(name)) return 'INVALID_PUBLIC_SECRET_NAME'
    if (/(PUBLIC_KEY|ANON_KEY|URL|DOMAIN|SITE|APP)/.test(name)) return 'PUBLIC_INTENDED'
    return 'PUBLIC_INTENDED'
  }
  if (/(SECRET|SERVICE_ROLE|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY|ENCRYPTION_KEY|API_KEY|CRON_SECRET|WEBHOOK)/.test(name)) return 'SERVER_SECRET'
  if (/(CLIENT_ID|REDIRECT_URI|URL|DOMAIN|ENV|MODE)/.test(name)) return 'SERVER_CONFIG'
  return 'UNKNOWN'
}

const envRows = [...envMap.values()].map((row) => ({
  name: row.name,
  classification: envClass(row.name),
  files: [...row.files].sort(),
  clientFiles: [...row.clientFiles].sort(),
})).sort((a,b) => a.name.localeCompare(b.name))

console.log('SECURITY_INVENTORY_JSON_BEGIN')
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  routeCount: routeRows.length,
  routes: routeRows,
  envs: envRows,
  browserStorage,
  serviceRoleFiles: serviceRoleFiles.sort((a,b) => a.file.localeCompare(b.file)),
  clientSecretViolations: [...new Set(clientSecretViolations)].sort(),
}, null, 2))
console.log('SECURITY_INVENTORY_JSON_END')
