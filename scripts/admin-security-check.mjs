// ORCALY_PLATFORM_ADMIN_SECURITY_CHECK_V1
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const checkedRoutes = []

function read(relative) {
  const full = path.join(root, relative)

  if (!fs.existsSync(full)) {
    failures.push(`Arquivo obrigatório ausente: ${relative}`)
    return ''
  }

  return fs.readFileSync(full, 'utf8')
}

function walk(directory) {
  const full = path.join(root, directory)

  if (!fs.existsSync(full)) return []

  const result = []

  for (const entry of fs.readdirSync(full, {
    withFileTypes: true,
  })) {
    const relative = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      result.push(...walk(relative))
    } else {
      result.push(relative.replaceAll('\\', '/'))
    }
  }

  return result
}

function requireText(source, marker, label) {
  if (!source.includes(marker)) {
    failures.push(`${label}: marcador ausente: ${marker}`)
  }
}

const proxy = read('proxy.ts')
requireText(
  proxy,
  'ORCALY_PLATFORM_ADMIN_HARDENING_V1',
  'proxy.ts',
)
requireText(
  proxy,
  "get_my_platform_admin_access",
  'proxy.ts',
)
requireText(
  proxy,
  "adminAccess?.admin_is_active",
  'proxy.ts',
)
requireText(
  proxy,
  "viniciusadm@orcaly.com",
  'proxy.ts',
)
requireText(
  proxy,
  "Cache-Control",
  'proxy.ts',
)
requireText(
  proxy,
  "X-Robots-Tag",
  'proxy.ts',
)

const platformAdmin = read('lib/platform-admin.ts')
requireText(
  platformAdmin,
  ".eq('is_active', true)",
  'lib/platform-admin.ts',
)
requireText(
  platformAdmin,
  "requirePlatformAdmin",
  'lib/platform-admin.ts',
)
requireText(
  platformAdmin,
  "OWNER_ONLY",
  'lib/platform-admin.ts',
)

const adminAuth = read('lib/admin-auth.ts')
requireText(
  adminAuth,
  "requirePlatformAdmin",
  'lib/admin-auth.ts',
)
requireText(
  adminAuth,
  "getCurrentPlatformAdminFromRequest",
  'lib/admin-auth.ts',
)

const apiRoots = [
  'app/api/admin',
  'app/api/platform-admin',
]

const acceptedGuards = [
  'requireAdmin(',
  'requirePlatformAdmin(',
  'getCurrentAdmin(',
  'getCurrentPlatformAdminFromRequest(',
]

for (const apiRoot of apiRoots) {
  for (const relative of walk(apiRoot)) {
    if (!relative.endsWith('/route.ts')) continue

    const source = read(relative)
    const importsGuard =
      source.includes("@/lib/admin-auth") ||
      source.includes("@/lib/platform-admin")
    const executesGuard = acceptedGuards.some(
      (marker) => source.includes(marker),
    )

    checkedRoutes.push(relative)

    if (!importsGuard || !executesGuard) {
      failures.push(
        `${relative}: rota administrativa sem guarda reconhecida.`,
      )
    }

    if (
      source.includes(
        'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
      )
    ) {
      failures.push(
        `${relative}: service role exposta como variável pública.`,
      )
    }
  }
}

const sensitiveFiles = [
  ...walk('app/admin'),
  ...walk('app/api/admin'),
  ...walk('app/api/platform-admin'),
  'lib/admin-auth.ts',
  'lib/platform-admin.ts',
  'proxy.ts',
]

for (const relative of sensitiveFiles) {
  if (!/\.(ts|tsx|js|mjs)$/.test(relative)) continue

  const source = read(relative)

  if (source.includes('Vini1503.')) {
    failures.push(
      `${relative}: senha conhecida foi encontrada no código.`,
    )
  }

  if (
    source.includes(
      'SUPABASE_SERVICE_ROLE_KEY',
    ) &&
    relative.startsWith('app/admin/')
  ) {
    failures.push(
      `${relative}: página cliente não pode acessar a service role.`,
    )
  }
}

if (checkedRoutes.length === 0) {
  failures.push(
    'Nenhuma rota administrativa foi encontrada para auditoria.',
  )
}

if (failures.length > 0) {
  console.error('')
  console.error('ADMIN_SECURITY_CHECK_FAILED=1')

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(`ADMIN_ROUTES_CHECKED=${checkedRoutes.length}`)
console.log('ADMIN_DATABASE_GATE=1')
console.log('ADMIN_NO_STORE=1')
console.log('ADMIN_SINGLE_OWNER=1')
console.log('ADMIN_SECURITY_CHECK_EXIT_CODE=0')
