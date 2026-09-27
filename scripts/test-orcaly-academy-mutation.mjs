#!/usr/bin/env node
/**
 * Orçaly Academy — mutation sensitivity for the domain suite.
 * Each mutant injects a deliberate bug into lib/orcaly-next/academy/**, runs
 * scripts/test-orcaly-academy-domain.mjs and restores the original file (always,
 * even on failure). A mutant that does not make the suite fail is SURVIVED.
 * Usage: node scripts/test-orcaly-academy-mutation.mjs  (exit 1 if any survive)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MUTANTS = [
 {
  "name": "M01 unknown progress vira 0",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "progress: unknown('ainda não aberto')",
  "to": "progress: known(0)"
 },
 {
  "name": "M02 formatBps unknown mostra 0%",
  "file": "lib/orcaly-next/academy/core.ts",
  "from": "if (value.kind === 'UNKNOWN') return 'Progresso desconhecido'",
  "to": "if (value.kind === 'UNKNOWN') return '0%'"
 },
 {
  "name": "M03 8999 completa (limiar-1)",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "progress.progress.value >= policy.thresholdBps",
  "to": "progress.progress.value >= policy.thresholdBps - 1"
 },
 {
  "name": "M04 abrir conclui",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "status: 'IN_PROGRESS', startedAt: current.startedAt ?? at",
  "to": "status: 'COMPLETED', startedAt: current.startedAt ?? at"
 },
 {
  "name": "M05 URL insegura aceita (http)",
  "file": "lib/orcaly-next/academy/core.ts",
  "from": "url.protocol !== 'https:' ||",
  "to": "(url.protocol !== 'https:' && url.protocol !== 'http:') ||"
 },
 {
  "name": "M06 URL com credenciais aceita",
  "file": "lib/orcaly-next/academy/core.ts",
  "from": "url.username || url.password ||",
  "to": ""
 },
 {
  "name": "M07 BLOCKED conta na trilha (status)",
  "file": "lib/orcaly-next/academy/tracks.ts",
  "from": "status: usable ? status : 'NOT_STARTED'",
  "to": "status"
 },
 {
  "name": "M08 BLOCKED conta na trilha (countable)",
  "file": "lib/orcaly-next/academy/tracks.ts",
  "from": "countable: item.required && usable",
  "to": "countable: item.required"
 },
 {
  "name": "M09 trilha completa ignora bloqueados",
  "file": "lib/orcaly-next/academy/tracks.ts",
  "from": "complete: excludedUnavailable === 0 && completedRequired",
  "to": "complete: completedRequired"
 },
 {
  "name": "M10 versão da nota ignorada",
  "file": "lib/orcaly-next/academy/notes.ts",
  "from": "if (note.version !== input.expectedVersion)",
  "to": "if (false)"
 },
 {
  "name": "M11 dono da nota ignorado",
  "file": "lib/orcaly-next/academy/notes.ts",
  "from": "if (note.userId !== input.userId)",
  "to": "if (false)"
 },
 {
  "name": "M12 nota sem limite",
  "file": "lib/orcaly-next/academy/notes.ts",
  "from": "[...normalized].length > NOTE_MAX",
  "to": "false"
 },
 {
  "name": "M13 CAS de progresso ignorado",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "if (input.expectedVersion !== current.version) return { ok: false, code: 'VERSION_CONFLICT', message: 'progresso alterado em outro dispositivo; recarregue' }\n  let",
  "to": "let"
 },
 {
  "name": "M14 ranking não determinístico (sem desempate)",
  "file": "lib/orcaly-next/academy/search.ts",
  "from": "      if (a.document.kind !== b.document.kind) return a.document.kind === 'TRACK' ? -1 : 1\n      const ta = normalizeText(a.document.title); const tb = normalizeText(b.document.title)\n      if (ta !== tb) return ta < tb ? -1 : 1\n      return a.document.id < b.document.id ? -1 : a.document.id > b.document.id ? 1 : 0",
  "to": "      return 0"
 },
 {
  "name": "M15 busca sensível a acento",
  "file": "lib/orcaly-next/academy/search.ts",
  "from": ".replace(/[\\u0300-\\u036f]/g, '')",
  "to": ""
 },
 {
  "name": "M16 busca sem limite de tokens",
  "file": "lib/orcaly-next/academy/search.ts",
  "from": ".filter(Boolean).slice(0, MAX_QUERY_TOKENS)",
  "to": ".filter(Boolean)"
 },
 {
  "name": "M17 licença UNKNOWN renderiza",
  "file": "lib/orcaly-next/academy/core.ts",
  "from": "case 'UNKNOWN': return none('Licença desconhecida: só metadados.')",
  "to": "case 'UNKNOWN': return { displayMetadata: true, renderFullContent: true, download: false, offlineCache: false, quoteExcerpt: false, summarizeWithAi: false, reason: 'x' }"
 },
 {
  "name": "M18 licença expirada ignorada",
  "file": "lib/orcaly-next/academy/core.ts",
  "from": "return license.status === 'EXPIRED' || (license.expiresAt !== null && license.expiresAt <= now)",
  "to": "return false"
 },
 {
  "name": "M19 favorito não idempotente",
  "file": "lib/orcaly-next/academy/notes.ts",
  "from": "if (existing) return { ok: true, list: [...list], bookmark: existing, created: false }",
  "to": ""
 },
 {
  "name": "M20 continuar vaza outro usuário",
  "file": "lib/orcaly-next/academy/continue.ts",
  "from": ".filter((entry) => entry.userId === state.userId && entry.status === 'IN_PROGRESS')",
  "to": ".filter((entry) => entry.status === 'IN_PROGRESS')"
 },
 {
  "name": "M21 sessão: tempo de aba vira estudo",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "activeSeconds: active,",
  "to": "activeSeconds: known(Math.max(0, Math.round((Date.parse(input.endedAt) - Date.parse(input.startedAt)) / 1000))),"
 },
 {
  "name": "M22 limiar 0 aceito",
  "file": "lib/orcaly-next/academy/progress.ts",
  "from": "if (policy.thresholdBps === 0) return 'limiar 0 equivaleria a concluir ao abrir'",
  "to": ""
 },
 {
  "name": "M23 duração desconhecida ordena como 0",
  "file": "lib/orcaly-next/academy/library.ts",
  "from": ": Number.POSITIVE_INFINITY\n    const db",
  "to": ": 0\n    const db"
 }
]

const results = []
for (const mutant of MUTANTS) {
  const path = join(ROOT, mutant.file)
  const original = readFileSync(path, 'utf8')
  const count = original.split(mutant.from).length - 1
  if (count !== 1) { results.push({ name: mutant.name, outcome: `INVALID (pattern x${count})` }); continue }
  try {
    writeFileSync(path, original.replace(mutant.from, () => mutant.to))
    const run = spawnSync(process.execPath, ['--test', 'scripts/test-orcaly-academy-domain.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
    const fail = Number(/# fail (\d+)/.exec(run.stdout ?? '')?.[1] ?? -1)
    results.push({ name: mutant.name, outcome: fail > 0 ? `KILLED (fail ${fail})` : fail === 0 ? 'SURVIVED' : 'ERROR' })
  } finally {
    writeFileSync(path, original)
  }
}
for (const r of results) console.log(`${r.name.padEnd(50)} ${r.outcome}`)
const killed = results.filter((r) => r.outcome.startsWith('KILLED')).length
console.log(`\nmutants killed ${killed}/${results.length}`)
process.exit(killed === results.length ? 0 : 1)
