#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const EXPECTED_STAGING_REF = 'hdlqlvqsugnacijcokrg'
const PRODUCTION_REF = 'ozrasuktfthsvbqprtel'
const RECOVERY_TARGET = 'staging'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..')
const linkedProjectRefPath = join(
  repositoryRoot,
  'supabase',
  '.temp',
  'project-ref',
)

function abort(message) {
  console.error(`[recovery-guardrail] ABORTADO: ${message}`)
  process.exit(1)
}

if (process.env.ORCALY_RECOVERY_TARGET !== RECOVERY_TARGET) {
  abort('defina ORCALY_RECOVERY_TARGET=staging explicitamente')
}

if (!existsSync(linkedProjectRefPath)) {
  abort('Project Ref vinculado nao encontrado em supabase/.temp/project-ref')
}

const linkedProjectRef = readFileSync(linkedProjectRefPath, 'utf8').trim()

if (!/^[a-z]{20}$/.test(linkedProjectRef)) {
  abort('Project Ref vinculado ausente ou malformado')
}

if (linkedProjectRef === PRODUCTION_REF) {
  abort(`producao (${PRODUCTION_REF}) nunca e um destino Recovery permitido`)
}

if (linkedProjectRef !== EXPECTED_STAGING_REF) {
  abort(`Project Ref inesperado: ${linkedProjectRef}`)
}

console.log(
  `[recovery-guardrail] Destino validado: staging (${EXPECTED_STAGING_REF})`,
)

const command = process.argv.slice(2)

if (command.length === 1 && command[0] === '--check') {
  process.exit(0)
}

const isAllowedPush = command[0] === 'db' && command[1] === 'push'
const allowedFlags = new Set(['--dry-run'])

if (
  !isAllowedPush ||
  command.slice(2).some((argument) => !allowedFlags.has(argument))
) {
  abort('somente `db push` e `db push --dry-run` sao permitidos por este wrapper')
}

const localCli = join(
  repositoryRoot,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
)

if (!existsSync(localCli)) {
  abort('Supabase CLI local nao encontrada; execute npm install')
}

const result = spawnSync(process.execPath, [localCli, ...command], {
  cwd: repositoryRoot,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) {
  abort(`falha ao iniciar a CLI local: ${result.error.message}`)
}

process.exit(result.status ?? 1)
