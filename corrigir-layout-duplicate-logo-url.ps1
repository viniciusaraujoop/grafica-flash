$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\layout.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-duplicate-logo-url-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$script = @'
const fs = require('fs')

const file = process.argv[2]
let content = fs.readFileSync(file, 'utf8')
const original = content

// 1) Remove imports duplicados exatos, caso algum patch tenha rodado mais de uma vez.
const lines = content.split(/\r?\n/)
const seenImports = new Set()
const dedupedImports = []

for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed.startsWith('import ')) {
    if (seenImports.has(trimmed)) continue
    seenImports.add(trimmed)
  }

  dedupedImports.push(line)
}

content = dedupedImports.join('\n')

// 2) Remove propriedades duplicadas dentro de type EmpresaAssinatura.
//    O erro veio daqui: logo_url entrou de novo. Já que o TypeScript é literal,
//    removemos duplicatas mantendo a primeira ocorrência.
const typeRegex = /type\s+EmpresaAssinatura\s*=\s*\{([\s\S]*?)\n\}/

content = content.replace(typeRegex, (fullMatch, body) => {
  const bodyLines = String(body).split(/\r?\n/)
  const seenKeys = new Set()
  const cleaned = []

  for (const line of bodyLines) {
    const match = line.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/)

    if (match) {
      const key = match[1]

      if (seenKeys.has(key)) {
        console.log(`Removendo propriedade duplicada em EmpresaAssinatura: ${key}`)
        continue
      }

      seenKeys.add(key)
    }

    cleaned.push(line)
  }

  return `type EmpresaAssinatura = {${cleaned.join('\n')}\n}`
})

if (content === original) {
  console.log('Nenhuma alteração necessária. O arquivo talvez já esteja corrigido.')
} else {
  fs.writeFileSync(file, content, 'utf8')
  console.log('layout.tsx corrigido: imports e propriedades duplicadas removidas.')
}

// 3) Verificação simples para garantir que não sobrou duplicata no type.
const after = fs.readFileSync(file, 'utf8')
const typeMatch = after.match(typeRegex)

if (typeMatch) {
  const seen = new Set()
  const duplicates = []

  for (const line of typeMatch[1].split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/)
    if (!match) continue

    if (seen.has(match[1])) duplicates.push(match[1])
    seen.add(match[1])
  }

  if (duplicates.length) {
    console.error(`Ainda existem propriedades duplicadas: ${duplicates.join(', ')}`)
    process.exit(1)
  }
}
'@

$tmp = Join-Path $project "scripts\corrigir-layout-duplicate-logo-url.cjs"
New-Item -ItemType Directory -Force -Path (Split-Path $tmp -Parent) | Out-Null
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tmp, $script, $utf8NoBom)

node $tmp $file

if ($LASTEXITCODE -ne 0) {
  Write-Host "Falha ao corrigir layout.tsx." -ForegroundColor Red
  exit $LASTEXITCODE
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Correção aplicada. Agora rode: npm run build" -ForegroundColor Yellow
