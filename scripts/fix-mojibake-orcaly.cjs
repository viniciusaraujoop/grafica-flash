const fs = require('fs')
const path = require('path')

const project = process.cwd()
const folders = ['app', 'components', 'lib']
const extraFiles = ['README.md', 'RELATORIO-LIMPEZA-ORCALY.md']

const validExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.md'])

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.next' || item.name === '.git') continue

    const full = path.join(dir, item.name)

    if (item.isDirectory()) {
      walk(full, out)
    } else if (validExt.has(path.extname(item.name))) {
      out.push(full)
    }
  }

  return out
}

function mojibakeOnce(value) {
  return Buffer.from(value, 'utf8').toString('latin1')
}

function mojibakeTwice(value) {
  return Buffer.from(mojibakeOnce(value), 'utf8').toString('latin1')
}

const chars = [
  '\u00e1', '\u00e0', '\u00e3', '\u00e2', '\u00e4',
  '\u00e9', '\u00e8', '\u00ea', '\u00eb',
  '\u00ed', '\u00ec', '\u00ee', '\u00ef',
  '\u00f3', '\u00f2', '\u00f5', '\u00f4', '\u00f6',
  '\u00fa', '\u00f9', '\u00fb', '\u00fc',
  '\u00e7', '\u00f1',
  '\u00c1', '\u00c0', '\u00c3', '\u00c2', '\u00c4',
  '\u00c9', '\u00c8', '\u00ca', '\u00cb',
  '\u00cd', '\u00cc', '\u00ce', '\u00cf',
  '\u00d3', '\u00d2', '\u00d5', '\u00d4', '\u00d6',
  '\u00da', '\u00d9', '\u00db', '\u00dc',
  '\u00c7', '\u00d1',
  '\u00ba', '\u00aa', '\u00b0', '\u00b7'
]

const replacements = new Map()

for (const ch of chars) {
  replacements.set(mojibakeTwice(ch), ch)
  replacements.set(mojibakeOnce(ch), ch)
}

const manual = [
  ['\u00e2\u20ac\u201c', '\u2013'],
  ['\u00e2\u20ac\u201d', '\u2014'],
  ['\u00e2\u20ac\u02dc', '\u2018'],
  ['\u00e2\u20ac\u2122', '\u2019'],
  ['\u00e2\u20ac\u0153', '\u201c'],
  ['\u00e2\u20ac\ufffd', '\u201d'],
  ['\u00e2\u20ac\u00a6', '\u2026'],
  ['\u00c2\u00a0', ' '],
  ['\u00c2\u00ba', '\u00ba'],
  ['\u00c2\u00aa', '\u00aa'],
  ['\u00c2\u00b0', '\u00b0'],
  ['\u00c2\u00b7', '\u00b7'],
]

for (const [bad, good] of manual) {
  replacements.set(bad, good)
}

const orderedReplacements = [...replacements.entries()]
  .filter(([bad]) => bad)
  .sort((a, b) => b[0].length - a[0].length)

function fixText(input) {
  let output = input

  for (let pass = 0; pass < 3; pass += 1) {
    let next = output

    for (const [bad, good] of orderedReplacements) {
      next = next.split(bad).join(good)
    }

    if (next === output) break
    output = next
  }

  return output
}

const files = []
for (const folder of folders) {
  walk(path.join(project, folder), files)
}

for (const extra of extraFiles) {
  const full = path.join(project, extra)
  if (fs.existsSync(full)) files.push(full)
}

let changed = 0
let scanned = 0

for (const file of [...new Set(files)]) {
  scanned += 1

  const original = fs.readFileSync(file, 'utf8')
  const fixed = fixText(original)

  if (fixed !== original) {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14)

    const backup = `${file}.backup-acentos-node-${stamp}`
    fs.copyFileSync(file, backup)
    fs.writeFileSync(file, fixed, 'utf8')

    changed += 1
    console.log(`Acentos corrigidos: ${path.relative(project, file)}`)
  }
}

const nextDir = path.join(project, '.next')
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true })
}

console.log('')
console.log(`Arquivos verificados: ${scanned}`)
console.log(`Arquivos corrigidos: ${changed}`)
console.log('')
console.log('Agora rode: npm run build')
