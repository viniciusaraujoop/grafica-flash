$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\modulos\[module]\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-found-type-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$nodeScript = @'
const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

// O getModuleById pode estar sendo inferido de forma estreita demais pelo TypeScript.
// A página só precisa de metadados simples para renderizar o placeholder.
const safeType = `type SafePanelModule = {
  id?: string
  label?: string
  description?: string
  status?: string
  href?: string
  fallbackHref?: string
  relatedHref?: string
  futureActions?: string[]
}

`

if (!content.includes('type SafePanelModule =')) {
  const importBlockMatch = content.match(/(?:import[^\n]+\n)+/)
  if (importBlockMatch) {
    content = content.slice(0, importBlockMatch[0].length) + '\n' + safeType + content.slice(importBlockMatch[0].length)
  } else {
    content = safeType + content
  }
}

// Troca a inferência problemática por um tipo seguro e local.
content = content.replace(
  /const\s+found\s*=\s*getModuleById\(module\)/,
  "const found = getModuleById(module) as SafePanelModule | undefined"
)

// Evita passar found para getSafeModuleHref se o tipo exportado estiver instável.
// A rota relacionada pode usar relatedHref, href, fallbackHref ou painel.
content = content.replace(
  /const\s+relatedHref\s*=\s*found\?\.relatedHref\s*\|\|\s*\(found\s*\?\s*getSafeModuleHref\(found\)\s*:\s*'\/painel'\)/,
  "const relatedHref = found?.relatedHref || found?.href || found?.fallbackHref || '/painel'"
)

// Se o import getSafeModuleHref ficou sem uso, remove.
content = content.replace(
  /import\s*\{\s*getModuleById,\s*getSafeModuleHref\s*\}\s*from\s*['"]@\/lib\/panel-modules['"]/,
  "import { getModuleById } from '@/lib/panel-modules'"
)

content = content.replace(
  /import\s*\{\s*getModuleById,\s*getSafeModuleHref\s*\}\s*from\s*['"]@\/lib\/segment-modules['"]/,
  "import { getModuleById } from '@/lib/segment-modules'"
)

// Compatibilidade se o arquivo importar só getSafeModuleHref e getModuleById em várias linhas.
content = content.replace(/,\s*getSafeModuleHref/g, '')
content = content.replace(/getSafeModuleHref,\s*/g, '')

if (content === original) {
  console.log('Nenhuma alteração aplicada. O arquivo talvez já esteja diferente do esperado.')
} else {
  fs.writeFileSync(file, content, 'utf8')
  console.log('Placeholder de módulo corrigido: found agora tem tipo seguro local.')
}

// Validação simples.
const after = fs.readFileSync(file, 'utf8')
if (!after.includes('type SafePanelModule')) {
  console.error('SafePanelModule não foi inserido.')
  process.exit(1)
}

if (/const\s+found\s*=\s*getModuleById\(module\)(?!\s+as)/.test(after)) {
  console.error('found ainda está sem cast seguro.')
  process.exit(1)
}
'@

$tmp = Join-Path $project "scripts\corrigir-modulo-placeholder-found-type.cjs"
New-Item -ItemType Directory -Force -Path (Split-Path $tmp -Parent) | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $nodeScript, $utf8NoBom)

node $tmp $file

if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha ao corrigir placeholder de módulo." -ForegroundColor Red
  exit $LASTEXITCODE
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
