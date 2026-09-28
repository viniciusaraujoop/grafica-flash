// Wave 1 T2 — Smart Setup mutation sensitivity. Each mutant injects a deliberate bug into
// lib/smart-setup/**, runs scripts/wave1/test-smart-setup.mjs and ALWAYS restores the file.
// Usage: node scripts/wave1/test-smart-setup-mutation.mjs   (exit 1 if any mutant survives)
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MUTANTS = [
 {
  "name": "BusinessType becomes a score (+50)",
  "file": "lib/smart-setup/core/score.ts",
  "from": "maxAvailableSupport += WEIGHTS.SUBSEGMENT\n",
  "to": "maxAvailableSupport += WEIGHTS.SUBSEGMENT\n      if (declared) signals.push({ pack: declared.pack, questionId: question.id, option: 'BT', strength: 'SUBSEGMENT', code: 'SUBSEGMENT_MATCH', points: 50, nominalPoints: 50 })\n"
 },
 {
  "name": "declared pack replaced by best-scoring pack",
  "file": "lib/smart-setup/core/recommend.ts",
  "from": "return { outcome: clear ? 'CLEAR_MATCH' : 'BUSINESS_TYPE_ONLY', primaryPack: declaredPack,",
  "to": "return { outcome: clear ? 'CLEAR_MATCH' : 'BUSINESS_TYPE_ONLY', primaryPack: rankScores(scores)[0]?.pack ?? declaredPack,"
 },
 {
  "name": "AMBIGUOUS picks the first candidate",
  "file": "lib/smart-setup/core/recommend.ts",
  "from": "return { outcome: 'AMBIGUOUS', primaryPack: null,",
  "to": "return { outcome: 'AMBIGUOUS', primaryPack: meaningful[0].pack,"
 },
 {
  "name": "T_CLEAR lowered to 0.69",
  "file": "lib/smart-setup/core/ruleset.ts",
  "from": "T_CLEAR: 7000,",
  "to": "T_CLEAR: 6900,"
 },
 {
  "name": "MIN_COMPLETENESS 0.30 (rejected proposal)",
  "file": "lib/smart-setup/core/ruleset.ts",
  "from": "MIN_COMPLETENESS: 4000,",
  "to": "MIN_COMPLETENESS: 3000,"
 },
 {
  "name": "MARGIN made strict (>)",
  "file": "lib/smart-setup/core/recommend.ts",
  "from": "(a.rawScore - b.rawScore) * 10000 >= marginBps",
  "to": "(a.rawScore - b.rawScore) * 10000 > marginBps"
 },
 {
  "name": "per-question cap removed (multi-select inflates)",
  "file": "lib/smart-setup/core/score.ts",
  "from": "points: index === best ? Math.min(nominal, MAX_PACK_POINTS_PER_QUESTION) : 0,",
  "to": "points: nominal,"
 },
 {
  "name": "A1 family cap removed",
  "file": "lib/smart-setup/core/ruleset.ts",
  "from": "cap: 6,\n    source: 'ADAPTATION A1",
  "to": "cap: 12,\n    source: 'ADAPTATION A1"
 },
 {
  "name": "SIMPLE_STOCK strong Store (A2 undone)",
  "file": "lib/smart-setup/core/ruleset.ts",
  "from": "rule('q.stock_control', 'SIMPLE_STOCK', R, 'WEAK'",
  "to": "rule('q.stock_control', 'SIMPLE_STOCK', R, 'STRONG'"
 },
 {
  "name": "NOT_SURE counted as answered",
  "file": "lib/smart-setup/core/normalize.ts",
  "from": "status: notSure ? 'NOT_SURE' : 'ANSWERED',",
  "to": "status: 'ANSWERED',"
 },
 {
  "name": "hidden question counted in completeness",
  "file": "lib/smart-setup/core/score.ts",
  "from": "questions.filter((question) => question.scored && question.presented).length",
  "to": "questions.filter((question) => question.scored).length"
 },
 {
  "name": "team_mode scored",
  "file": "lib/smart-setup/core/questionnaire.ts",
  "from": "{ id: 'q.team_mode', role: 'CAPABILITY_ONLY', selection: 'single', scored: false,",
  "to": "{ id: 'q.team_mode', role: 'CAPABILITY_ONLY', selection: 'single', scored: true,"
 },
 {
  "name": "stereotype contradiction (store without stock -8)",
  "file": "lib/smart-setup/core/ruleset.ts",
  "from": "export const COUNTER_RULES: readonly CounterRule[] = [\n",
  "to": "export const COUNTER_RULES: readonly CounterRule[] = [\n  { questionId: 'q.stock_control', option: 'NO_STOCK', pack: R, code: 'COUNTER_SIGNAL_EXPLICIT', source: 'x' },\n"
 },
 {
  "name": "hard contradiction ignored",
  "file": "lib/smart-setup/core/recommend.ts",
  "from": "!hard &&\n",
  "to": "true &&\n"
 },
 {
  "name": "cross-segment alternative suppressed",
  "file": "lib/smart-setup/core/recommend.ts",
  "from": "if (reason) {",
  "to": "if (reason && false) {"
 },
 {
  "name": "invalid option accepted",
  "file": "lib/smart-setup/core/validate-answers.ts",
  "from": "if (!allowed.includes(raw)) {",
  "to": "if (false) {"
 },
 {
  "name": "input order leaks into multi-select",
  "file": "lib/smart-setup/core/validate-answers.ts",
  "from": "return allowed.filter((option) => picked.has(option))",
  "to": "return [...picked]"
 },
 {
  "name": "invalid free text echoed in issues",
  "file": "lib/smart-setup/core/validate-answers.ts",
  "from": "issues.push({ code: 'INVALID_OPTION', questionId: id })\n      return undefined",
  "to": "issues.push({ code: 'INVALID_OPTION', questionId: id, value: raw })\n      return undefined"
 },
 {
  "name": "lead_followup shown for Food",
  "file": "lib/smart-setup/core/questionnaire.ts",
  "from": "return businessType !== 'FOOD'",
  "to": "return true"
 },
 {
  "name": "confidence clamp removed",
  "file": "lib/smart-setup/core/score.ts",
  "from": "const rawScore = Math.max(0, rawSupport - rawPenalty)",
  "to": "const rawScore = rawSupport - rawPenalty"
 }
]

const results = []
for (const mutant of MUTANTS) {
  const file = path.join(root, mutant.file)
  const original = readFileSync(file, 'utf8')
  const count = original.split(mutant.from).length - 1
  if (count !== 1) { results.push({ name: mutant.name, outcome: `INVALID (pattern x${count})` }); continue }
  try {
    writeFileSync(file, original.replace(mutant.from, () => mutant.to))
    const run = spawnSync(process.execPath, ['--test', 'scripts/wave1/test-smart-setup.mjs'], { cwd: root, encoding: 'utf8', timeout: 300000 })
    const fail = Number(/# fail (\d+)/.exec(run.stdout ?? '')?.[1] ?? -1)
    results.push({ name: mutant.name, outcome: fail > 0 ? `KILLED (fail ${fail})` : fail === 0 ? 'SURVIVED' : 'ERROR' })
  } finally {
    writeFileSync(file, original)
  }
}
for (const result of results) console.log(`${result.name.padEnd(52)} ${result.outcome}`)
const killed = results.filter((result) => result.outcome.startsWith('KILLED')).length
console.log(`\nmutants killed ${killed}/${results.length}`)
process.exit(killed === results.length ? 0 : 1)
