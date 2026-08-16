#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const migrationsDirectory = join(repositoryRoot, 'supabase', 'migrations')
const legacyDirectory = join(repositoryRoot, 'supabase', 'migrations_legacy')
const config = readFileSync(join(repositoryRoot, 'supabase', 'config.toml'), 'utf8')
const siteHelper = readFileSync(
  join(repositoryRoot, 'lib', 'site', 'create-default-site.server.ts'),
  'utf8',
)
const adminSiteRoute = readFileSync(
  join(repositoryRoot, 'app', 'api', 'admin', 'site', '[id]', 'route.ts'),
  'utf8',
)
const completeAccountRoute = readFileSync(
  join(repositoryRoot, 'app', 'api', 'leads', 'complete-account', 'route.ts'),
  'utf8',
)
const taskCreateRoute = readFileSync(
  join(repositoryRoot, 'app', 'api', 'tasks', 'route.ts'),
  'utf8',
)
const taskUpdateRoute = readFileSync(
  join(repositoryRoot, 'app', 'api', 'tasks', '[id]', 'route.ts'),
  'utf8',
)

const baselineFiles = {
  extensions: '20260816191215_baseline_extensions_and_schemas.sql',
  tables: '20260816191217_baseline_tables.sql',
  constraints: '20260816191219_baseline_constraints_and_indexes.sql',
  routines: '20260816191222_baseline_functions_triggers_views.sql',
  authorization: '20260816191224_baseline_rls_and_grants.sql',
  platform: '20260816191227_baseline_storage_and_cron.sql',
}

function abort(message) {
  console.error(`[recovery-baseline] FALHOU: ${message}`)
  process.exit(1)
}

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) abort(message)
}

function requireCount(value, pattern, expected, label) {
  const count = value.match(pattern)?.length ?? 0
  if (count !== expected) {
    abort(`${label}: esperado ${expected}, encontrado ${count}`)
  }
}

for (const filename of Object.values(baselineFiles)) {
  if (!existsSync(join(migrationsDirectory, filename))) {
    abort(`migration ausente: ${filename}`)
  }
}

const sql = Object.fromEntries(
  Object.entries(baselineFiles).map(([key, filename]) => [
    key,
    readFileSync(join(migrationsDirectory, filename), 'utf8'),
  ]),
)

requireCount(sql.tables, /^create table /gim, 88, 'tabelas public + privadas')
requireCount(
  sql.tables,
  /^create table public\./gim,
  86,
  'tabelas public do baseline',
)
requireCount(
  sql.tables,
  /^create table orcaly_private\./gim,
  2,
  'tabelas privadas do baseline',
)
requireCount(
  sql.constraints,
  /^alter table .* add constraint /gim,
  369,
  'constraints',
)
requireCount(
  sql.constraints,
  /^create (?:unique )?index /gim,
  288,
  'indices independentes',
)
requireCount(sql.routines, /^create or replace function /gim, 62, 'funcoes')
requireCount(sql.routines, /^create trigger /gim, 26, 'triggers')
requireCount(sql.routines, /^create view /gim, 11, 'views')
requireCount(
  sql.routines,
  /^create view .*security_invoker=true/gim,
  11,
  'views security_invoker',
)
requireCount(
  sql.authorization,
  /^alter table public\..* enable row level security;/gim,
  86,
  'tabelas public com RLS',
)
requireCount(sql.authorization, /^create policy /gim, 143, 'policies public')
requireCount(sql.platform, /^create policy /gim, 4, 'policies storage')

const publicTables = new Set(
  [...sql.tables.matchAll(/^create table public\.([^\s(]+)/gim)].map(
    (match) => match[1].toLowerCase(),
  ),
)
const rlsTables = new Set(
  [
    ...sql.authorization.matchAll(
      /^alter table public\.([^\s;]+) enable row level security;/gim,
    ),
  ].map((match) => match[1].toLowerCase()),
)
if (
  publicTables.size !== rlsTables.size ||
  [...publicTables].some((table) => !rlsTables.has(table))
) {
  abort('a cobertura RLS nao corresponde exatamente as tabelas public')
}

const allBaselineSql = Object.values(sql).join('\n')
for (const forbidden of [
  /\bdrop\s+(?:table|schema|column)\b/i,
  /\btruncate\b/i,
  /ozrasuktfthsvbqprtel/i,
  /hdlqlvqsugnacijcokrg/i,
  /@[a-z0-9.-]+\.(?:com|com\.br|net|org)\b/i,
  /https?:\/\//i,
]) {
  if (forbidden.test(allBaselineSql)) {
    abort(`padrao proibido encontrado no SQL: ${forbidden}`)
  }
}

requireMatch(
  sql.authorization,
  /revoke all privileges on all tables in schema orcaly_private from public, anon, authenticated, service_role;/i,
  'faltou revogar acesso direto das tabelas privadas',
)
requireMatch(
  sql.authorization,
  /grant usage on schema orcaly_private to anon, authenticated, service_role;/i,
  'helpers privados allowlisted nao seriam resolviveis pelas policies',
)
requireMatch(
  sql.platform,
  /insert into storage\.buckets/i,
  'configuracao estrutural dos buckets ausente',
)
requireMatch(
  sql.platform,
  /create extension pg_cron with schema pg_catalog;/i,
  'extensao cron ausente',
)
requireMatch(
  sql.routines,
  /create trigger trg_internal_tasks_tenant_integrity[\s\S]+orcaly_private\.enforce_internal_task_tenant\(\);/i,
  'integridade tenant de internal_tasks ausente no banco',
)

requireMatch(config, /site_url = "http:\/\/localhost:3000"/i, 'Site URL insegura')
requireMatch(config, /enable_signup = false/i, 'signup publico ainda habilitado')
requireMatch(
  config,
  /enable_anonymous_sign_ins = false/i,
  'login anonimo ainda habilitado',
)
requireMatch(config, /minimum_password_length = 8/i, 'senha minima divergente')
requireMatch(config, /enable_confirmations = true/i, 'confirmacao de email desabilitada')
requireMatch(
  config,
  /additional_redirect_urls = \["http:\/\/localhost:3000\/\*\*", "http:\/\/127\.0\.0\.1:3000\/\*\*"\]/i,
  'redirects locais divergentes do contrato aprovado',
)

requireMatch(siteHelper, /^import 'server-only'/m, 'helper de site nao e server-only')
requireMatch(siteHelper, /companyCreationLocks/, 'serializacao concorrente local ausente')
requireMatch(
  siteHelper,
  /select\('id', \{ count: 'exact', head: true \}\)/,
  'checagem idempotente das secoes ausente',
)
requireMatch(siteHelper, /\.insert\(sections\)/, 'batch unico de secoes ausente')
for (const [label, route] of [
  ['admin site', adminSiteRoute],
  ['complete account', completeAccountRoute],
]) {
  requireMatch(route, /createDefaultSiteForCompany/, `${label}: helper server-only ausente`)
  if (/\.rpc\([^\n]*create_default_site_for_company/i.test(route)) {
    abort(`${label}: RPC publica legada ainda utilizada`)
  }
}
for (const [label, route] of [
  ['task create', taskCreateRoute],
  ['task update', taskUpdateRoute],
]) {
  requireMatch(
    route,
    /validateInternalTaskReferences/,
    `${label}: validacao tenant server-side ausente`,
  )
}

const functionChunks = sql.routines
  .split(/(?=create or replace function )/i)
  .slice(1)
  .map((chunk) => chunk.split(/(?=create or replace function |create view )/i)[0])
const definerWithoutSearchPath = functionChunks.filter(
  (chunk) =>
    /security definer/i.test(chunk) && !/set search_path\s*(?:to|=)/i.test(chunk),
)
if (definerWithoutSearchPath.length > 0) {
  abort('existe funcao SECURITY DEFINER sem search_path explicito')
}

const legacySqlFiles = readdirSync(legacyDirectory).filter((filename) =>
  filename.endsWith('.sql'),
)
if (legacySqlFiles.length !== 51) {
  abort(`legado: esperado 51 SQLs, encontrado ${legacySqlFiles.length}`)
}

const checksumLines = readFileSync(join(legacyDirectory, 'SHA256SUMS'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
if (checksumLines.length !== 51) {
  abort(`manifesto SHA256: esperado 51 entradas, encontrado ${checksumLines.length}`)
}

for (const line of checksumLines) {
  const match = line.match(/^([0-9a-f]{64})\s+(.+)$/i)
  if (!match) abort(`linha SHA256 malformada: ${line}`)
  const [, expected, filename] = match
  const actual = createHash('sha256')
    .update(readFileSync(join(legacyDirectory, filename)))
    .digest('hex')
  if (actual !== expected.toLowerCase()) abort(`checksum divergente: ${filename}`)
}

const remoteHistory = readFileSync(
  join(legacyDirectory, 'PRODUCTION_REMOTE_HISTORY.md'),
  'utf8',
)
requireCount(remoteHistory, /^\| `?\d{14}`? \|/gim, 33, 'historico remoto de producao')

console.log('[recovery-baseline] APROVADO')
console.log(
  '[recovery-baseline] 86 tabelas public, 2 privadas, 369 constraints, 406 indices totais, 62 funcoes, 26 triggers, 11 views, 147 policies',
)
