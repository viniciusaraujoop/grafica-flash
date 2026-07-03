$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$nodeScript = @'
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

  // Corrige somente valor literal de grupo, não palavras soltas.
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
console.log(`Arquivos com "presenca" antes da correção: ${remainingBefore.length ? remainingBefore.join(', ') : 'nenhum'}`)
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
  console.error('Ainda existe valor inválido "presenca" nestes arquivos:')
  for (const file of remaining) console.error(`- ${file}`)
  process.exit(1)
}

const panelModules = path.join(project, 'lib', 'panel-modules.ts')
if (fs.existsSync(panelModules)) {
  const content = fs.readFileSync(panelModules, 'utf8')
  if (!content.includes("'presenca_digital'") && !content.includes('"presenca_digital"')) {
    console.error('lib/panel-modules.ts não contém presenca_digital. Verifique o tipo ModuleGroup.')
    process.exit(1)
  }
}

console.log('Correção finalizada: nenhum literal "presenca" restante em lib/app/components.')
'@

$tmp = Join-Path $project "scripts\corrigir-presenca-forcado-scan.cjs"
New-Item -ItemType Directory -Force -Path (Split-Path $tmp -Parent) | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $nodeScript, $utf8NoBom)

node $tmp

if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha ao corrigir presenca. Veja os arquivos listados acima." -ForegroundColor Red
  exit $LASTEXITCODE
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
