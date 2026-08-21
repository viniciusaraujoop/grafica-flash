import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = [
  'app/api/company/current/route.ts',
  'app/login/actions.ts',
  'app/login/page.tsx',
  'app/painel/actions.ts',
  'app/painel/layout.tsx',
  'components/painel/PanelAuthenticatedLayout.tsx',
  'components/painel/PanelPremiumHeader.tsx',
  'lib/current-company-client.ts',
  'lib/supabase-server.ts',
  'proxy.ts',
  'scripts/e2e-auth-first-login.mjs',
  'scripts/verify-auth-first-login-race.mjs',
  'scripts/verify-critical-hotfix.mjs',
]

for (const path of files) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8')
  const lines = text.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    assert.equal(
      /[ \t]+$/.test(line),
      false,
      `${path}:${index + 1} contém whitespace no fim da linha.`,
    )
  }

  assert.equal(
    /^(<<<<<<<|=======|>>>>>>>)/m.test(text),
    false,
    `${path} contém marcador de conflito Git.`,
  )
}

console.log('Auth hotfix whitespace/conflict checks: PASS')
