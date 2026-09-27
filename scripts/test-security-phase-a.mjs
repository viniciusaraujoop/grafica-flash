import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

function walk(dir) {
  const start = path.join(root, dir)
  if (!fs.existsSync(start)) return []
  const output = []
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const full = path.join(start, entry.name)
    if (entry.isDirectory()) output.push(...walk(path.relative(root, full)))
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) && !entry.name.includes('.backup-') && !entry.name.endsWith('.bak')) {
      output.push(full)
    }
  }
  return output
}

test('paid signup completion requires signed checkout proof before service-role account creation', () => {
  const source = read('app/api/leads/complete-account/route.ts')
  const verify = source.indexOf('verifySignupCheckoutToken(leadId, body.expires, body.token)')
  const leadRead = source.indexOf('.from("signup_leads")')
  const createUser = source.indexOf('auth.admin.createUser')
  assert.ok(verify >= 0, 'signed checkout proof must be verified')
  assert.ok(leadRead > verify, 'lead must not be read with service role before proof')
  assert.ok(createUser > verify, 'account must not be created before proof')
  assert.match(source, /requireSameOrigin\(request\)/)
  assert.match(source, /scope: "signup-complete-account"/)
})

test('signup checkout forwards token and expiry when creating account', () => {
  const source = read('components/checkout/SignupCheckout.tsx')
  const block = source.slice(source.indexOf('fetch("/api/leads/complete-account"'), source.indexOf('const payload = await response.json', source.indexOf('fetch("/api/leads/complete-account"')))
  assert.match(block, /lead_id: leadId/)
  assert.match(block, /expires/)
  assert.match(block, /token/)
})

test('company authorization has no identity-specific master-email bypass', () => {
  for (const file of ['app/api/company/settings/route.ts', 'app/api/company/team/route.ts']) {
    const source = read(file)
    assert.doesNotMatch(source, /araujovinicius249@gmail\.com/i)
    assert.match(source, /getCompanyAccess/)
  }
  assert.match(read('app/api/company/settings/route.ts'), /access\.canConfig/)
  const team = read('app/api/company/team/route.ts')
  assert.match(team, /access\.isOwner/)
  assert.match(team, /access\.isAdminMaster/)
})

test('payout Pix mutation and removal require MFA step-up', () => {
  const source = read('app/api/payments/asaas/payout-key/route.ts')
  const matches = source.match(/requireMfaStepUpForRequest\(request, "pix\.update"\)/g) || []
  assert.equal(matches.length, 2)
})

test('login uses existing DB limiter and avoids account-state enumeration copy', () => {
  const source = read('app/login/actions.ts')
  assert.match(source, /consumeRateLimit/)
  assert.match(source, /auth-login-network/)
  assert.match(source, /auth-login-identifier/)
  assert.doesNotMatch(source, /Confirme seu e-mail antes de entrar\./)
  assert.match(source, /invalid login credentials[\s\S]*email not confirmed/)
})

test('admin password change is origin checked, bounded and rate limited', () => {
  const source = read('app/api/admin/change-password/route.ts')
  assert.match(source, /requireSameOrigin\(request\)/)
  assert.match(source, /scope: 'admin-change-password'/)
  assert.match(source, /readJsonBody<Record<string, unknown>>\(request, 4 \* 1024\)/)
})

test('site asset upload validates real bytes and applies origin/rate controls', () => {
  const source = read('app/api/site/upload/route.ts')
  assert.match(source, /requireSameOrigin\(request\)/)
  assert.match(source, /scope: 'site-assets-upload'/)
  assert.match(source, /validMagic\(bytes, file\.type\)/)
  assert.doesNotMatch(source, /image\/svg\+xml/)
})

test('client modules do not reference known server secrets or privileged server helpers', () => {
  const violations = []
  for (const file of [...walk('app'), ...walk('components'), ...walk('lib')]) {
    const source = fs.readFileSync(file, 'utf8')
    if (!/^\s*['"]use client['"];?/m.test(source)) continue
    if (/SUPABASE_SERVICE_ROLE_KEY|PAYMENT_CREDENTIALS_ENCRYPTION_KEY|CRON_SECRET|process\.env\.(?!NEXT_PUBLIC_)/.test(source)) {
      violations.push(path.relative(root, file))
      continue
    }
    if (/@\/lib\/(?:company-access|security\/rate-limit|payments\/credential-encryption)/.test(source)) {
      violations.push(path.relative(root, file))
    }
  }
  assert.deepEqual(violations, [])
})

test('NEXT_PUBLIC names do not look like server secrets', () => {
  const bad = new Set()
  const files = [...walk('app'), ...walk('components'), ...walk('lib'), path.join(root, 'proxy.ts')]
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
      const name = match[0]
      if (/(?:SERVICE_ROLE|SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY|ENCRYPTION_KEY|CRON_SECRET)/.test(name)) bad.add(name)
    }
  }
  assert.deepEqual([...bad].sort(), [])
})

test('private application areas are forced no-store by proxy', () => {
  const source = read('proxy.ts')
  assert.match(source, /protectedPanel/)
  assert.match(source, /protectedEcosystem/)
  assert.match(source, /Cache-Control', 'private, no-store, no-cache/)
  assert.match(source, /X-Robots-Tag/)
})

test('known external webhooks retain provider-specific authenticity controls', () => {
  assert.match(read('app/api/integrations/google/calendar/webhook/route.ts'), /secureCalendarChannelTokenMatches/)
  assert.match(read('app/api/integrations/resend/webhook/[connectionId]/route.ts'), /verifySvixWebhook/)
  assert.match(read('app/api/mercado-pago/webhook/route.ts'), /verifyMercadoPagoWebhookSignature/)
  assert.match(read('app/api/whatsapp/webhook/route.ts'), /verifyWhatsAppSignature/)
  assert.match(read('app/api/webhooks/asaas/route.ts'), /requireAsaasWebhookToken/)
})

test('service-role key is never declared as NEXT_PUBLIC', () => {
  const source = read('.env.example')
  assert.match(source, /^SUPABASE_SERVICE_ROLE_KEY=/m)
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/)
})


test('public account creation and payment routes have abuse controls', () => {
  for (const file of [
    'app/api/checkout/lead/route.ts',
    'app/api/parceiros/register/route.ts',
    'app/api/founders/activate/route.ts',
    'app/api/team-invites/activate/route.ts',
    'app/api/checkout/signup/card/route.ts',
    'app/api/checkout/signup/pix/route.ts',
  ]) {
    const source = read(file)
    assert.match(source, /enforceRateLimit/)
    assert.match(source, /requireSameOrigin/)
  }
})

test('Asaas webhook uses constant-time secret comparison and body bounds', () => {
  const source = read('app/api/webhooks/asaas/route.ts')
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /rawText\.length > 1_000_000/)
})


test('public checkout rate limit cannot be exhausted globally by store slug', () => {
  for (const file of ['app/api/checkout/[slug]/card/route.ts', 'app/api/checkout/[slug]/pix/route.ts']) {
    const source = read(file)
    assert.match(source, /getClientIp\(request\)/)
    assert.match(source, /identity: `\$\{getClientIp\(request\)\}:\$\{slug\}`/)
  }
})

test('Mercado Pago webhooks reject oversized bodies before JSON processing', () => {
  for (const file of [
    'app/api/assinatura/checkout/webhook/route.ts',
    'app/api/marketplace/payments/webhook/mercado-pago/route.ts',
    'app/api/mercado-pago/webhook-leads/route.ts',
    'app/api/mercado-pago/webhook/route.ts',
  ]) {
    assert.match(read(file), /rejectOversizedRequest\(request, 1_000_000\)/)
  }
})


test('financial server context enforces capability, not authentication alone', () => {
  const source = read('lib/payments/server-context.ts')
  assert.match(source, /getCompanyAccess/)
  assert.match(source, /capability === "finance" && access\.canFinance/)
  assert.match(source, /capability === "subscription" && access\.canSubscription/)
  for (const file of [
    'app/api/payments/asaas/payout-key/route.ts',
    'app/api/payments/asaas/payouts/retry/route.ts',
    'app/api/payments/asaas/payouts/route.ts',
    'app/api/payments/asaas/transactions/route.ts',
    'app/api/payments/asaas/account/status/route.ts',
  ]) assert.match(read(file), /requireUserCompany\(request, "finance"\)/)
  assert.match(read('lib/payments/subscription-asaas.ts'), /requireUserCompany\(request, "subscription"\)/)
})
