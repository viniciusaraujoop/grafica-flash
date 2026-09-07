import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const fail = (message) => { throw new Error(`Platform Evolution 3 foundation invariant failed: ${message}`) }
const has = (content, pattern, message) => { if (!pattern.test(content)) fail(message) }
const lacks = (content, pattern, message) => { if (pattern.test(content)) fail(message) }

const reporter = read('lib/observability/application-errors.ts')
const migration = read('supabase/migrations/20260830143000_platform_evolution_3_observability.sql')
const healthApi = read('app/api/admin/system-health/route.ts')
const healthUi = read('components/admin/AdminSystemHealthV3.tsx')
const routePage = read('app/admin/system-health/page.tsx')
const errorBoundary = read('app/error.tsx')
const globalError = read('app/global-error.tsx')

has(reporter, /import 'server-only'/, 'error reporter must be server-only')
has(reporter, /ORC-/, 'error reporter must create a public correlation code')
has(reporter, /REDACTED/, 'error reporter must redact sensitive values')
has(reporter, /SECRET_KEY/, 'metadata secret keys must be denied')
has(reporter, /application_error_events/, 'application errors must have their own storage domain')
lacks(reporter, /NEXT_PUBLIC_.*SERVICE|NEXT_PUBLIC_.*SECRET|NEXT_PUBLIC_.*TOKEN/i, 'server secrets must not become public env vars')
lacks(reporter, /console\.log\([^)]*(password|token|secret|cookie)/i, 'reporter must not log secret material')

has(migration, /create table if not exists public\.application_error_events/i, 'observability migration must be additive')
has(migration, /enable row level security/i, 'application error telemetry must use RLS')
has(migration, /revoke all on table public\.application_error_events from public, anon, authenticated/i, 'application error telemetry must not be client-readable')
has(migration, /grant select, insert on table public\.application_error_events to service_role/i, 'only server role may persist/read error telemetry')
lacks(migration, /\bdrop\s+(table|schema)\b|\btruncate\b|disable row level security|using\s*\(\s*true\s*\)/i, 'foundation migration must not weaken or destroy schema')

has(healthApi, /requirePlatformAdmin\(request, 'system\.read'\)/, 'health endpoint must remain admin-protected')
has(healthApi, /assistant_events/, 'AI health must use persisted telemetry when available')
has(healthApi, /application_error_events/, 'health center must expose application error telemetry readiness')
has(healthApi, /reportApplicationError/, 'health endpoint failures must return a correlated incident')
lacks(healthApi, /OPENAI_API_KEY\s*\?\s*'Operational'/, 'configured AI credential must not equal healthy provider')
has(healthApi, /status:\s*'Unknown'/, 'health checks need an honest Unknown state')

has(routePage, /AdminSystemHealthV3/, 'system health route must render v3 health center')
has(healthUi, /Migration pendente/, 'missing observability schema must be explicit')
has(healthUi, /Nenhum erro de aplicação registrado/, 'empty error state must be useful')
has(healthUi, /Tentar novamente/, 'health failure state must be recoverable')
has(healthUi, /motion-reduce/, 'health loading must respect reduced motion')

for (const boundary of [errorBoundary, globalError]) {
  has(boundary, /ORC-/, 'error boundary must expose a correlation code')
  has(boundary, /Tentar novamente/, 'error boundary must provide recovery')
  lacks(boundary, /error\.message/, 'public crash UI must not expose raw server error messages')
}

console.log('Platform Evolution 3 foundation invariants: PASS')
