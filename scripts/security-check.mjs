import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function requireText(file, text, label) {
  if (!read(file).includes(text)) {
    failures.push(`${label}: ${file}`)
  }
}

function forbidText(file, text, label) {
  if (read(file).includes(text)) {
    failures.push(`${label}: ${file}`)
  }
}

requireText(
  'lib/orcaly-security.ts',
  'Content-Security-Policy',
  'CSP obrigatoria ausente',
)
forbidText(
  'lib/orcaly-security.ts',
  'Content-Security-Policy-Report-Only',
  'CSP ainda esta apenas em report-only',
)
requireText(
  'lib/mercado-pago.ts',
  'if (!secret || !xSignature || !xRequestId || !dataId) return false',
  'Webhook ainda permite segredo ausente',
)
forbidText(
  'lib/admin-auth.ts',
  'araujovinicius249@gmail.com',
  'Super admin fixo no codigo',
)
forbidText(
  'lib/company-access.ts',
  'araujovinicius249@gmail.com',
  'Super admin fixo no acesso da empresa',
)
forbidText(
  'lib/company-access.ts',
  'shouldAttachOwner',
  'Vinculo automatico por e-mail ainda ativo',
)
forbidText(
  'app/api/public-site/[slug]/route.ts',
  ".select('*')",
  'API publica ainda seleciona todos os campos',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  'type PublicCompanyRow = Record<string, unknown>',
  'Tipagem da empresa publica ausente',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  'rawCompany as unknown as PublicCompanyRow | null',
  'Consulta dinamica da empresa continua sem tipagem',
)
requireText(
  'app/api/public-site/[slug]/route.ts',
  '(rawProducts || []) as unknown as PublicProductRow[]',
  'Consulta dinamica dos produtos continua sem tipagem',
)
requireText(
  'supabase/migrations/20260729133000_orcaly_security_hardening.sql',
  'revoke all privileges on table public.%I from anon',
  'Revogacao de privilegios anonimos ausente',
)
requireText(
  'supabase/migrations/20260729133000_orcaly_security_hardening.sql',
  'drop policy if exists "Público cria pedido em empresa ativa"',
  'Politica publica de pedidos ainda nao foi removida',
)

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

for (const file of walk(path.join(root, 'app'))) {
  if (!/\.(ts|tsx)$/.test(file)) continue
  const content = fs.readFileSync(file, 'utf8')
  if (
    content.includes("'use client'") &&
    /\.from\(['"]artes['"]\)/.test(content)
  ) {
    failures.push(
      `Upload direto para o bucket artes em componente cliente: ${path.relative(root, file)}`,
    )
  }
}

if (failures.length) {
  console.error('\nFALHAS DE SEGURANCA ENCONTRADAS:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('SECURITY_CHECK_EXIT_CODE=0')
