const fs = require('fs')
const path = require('path')

const project = process.cwd()
const roots = ['lib', 'app', 'components']
const exts = new Set(['.ts', '.tsx', '.js', '.jsx'])

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue

    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(full, files)
    } else if (exts.has(path.extname(entry.name))) {
      files.push(full)
    }
  }

  return files
}

const targets = roots.flatMap((root) => walk(path.join(project, root)))
let changedCount = 0
const remainingBefore = []

for (const file of targets) {
  const original = fs.readFileSync(file, 'utf8')
  let content = original

  if (content.includes("'presenca'") || content.includes('"presenca"') || content.includes('presenca:')) {
    remainingBefore.push(path.relative(project, file))
  }

  // Corrige somente valor literal de grupo, nÃ£o palavras soltas.
  content = content.replace(/(['"])presenca\1/g, '$1presenca_digital$1')

  // Corrige chave de objeto antiga, se existir.
  content = content.replace(/(^|\n)(\s*)presenca\s*:/g, '$1$2presenca_digital:')

  if (content !== original) {
    const backup = `${file}.backup-presenca-forcado-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
    fs.copyFileSync(file, backup)
    fs.writeFileSync(file, content, 'utf8')
    changedCount += 1
    console.log(`Corrigido: ${path.relative(project, file)}`)
  }
}

console.log('')
console.log(`Arquivos com "presenca" antes da correÃ§Ã£o: ${remainingBefore.length ? remainingBefore.join(', ') : 'nenhum'}`)
console.log(`Arquivos alterados: ${changedCount}`)

const remaining = []

for (const file of targets) {
  const content = fs.readFileSync(file, 'utf8')
  if (content.includes("'presenca'") || content.includes('"presenca"') || /(^|\n)\s*presenca\s*:/.test(content)) {
    remaining.push(path.relative(project, file))
  }
}

if (remaining.length) {
  console.error('')
  console.error('Ainda existe valor invÃ¡lido "presenca" nestes arquivos:')
  for (const file of remaining) console.error(`- ${file}`)
  process.exit(1)
}

const panelModules = path.join(project, 'lib', 'panel-modules.ts')
if (fs.existsSync(panelModules)) {
  const content = fs.readFileSync(panelModules, 'utf8')
  if (!content.includes("'presenca_digital'") && !content.includes('"presenca_digital"')) {
    console.error('lib/panel-modules.ts nÃ£o contÃ©m presenca_digital. Verifique o tipo ModuleGroup.')
    process.exit(1)
  }
}

console.log('CorreÃ§Ã£o finalizada: nenhum literal "presenca" restante em lib/app/components.')