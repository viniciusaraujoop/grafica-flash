$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "components\public-site\PublicSiteRenderer.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-testimonials-texto-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Corrige o resíduo que sobrou no bloco de depoimentos.
# Depois da normalização, testimonial tem apenas { name, text }, então item.texto não existe.
$content = $content.Replace("{item.text || item.texto || 'Atendimento excelente e organizado.'}", "{item.text}")
$content = $content.Replace('{item.text || item.texto || "Atendimento excelente e organizado."}', '{item.text}')
$content = $content.Replace("{item.name || item.nome || 'Cliente'}", "{item.name}")
$content = $content.Replace('{item.name || item.nome || "Cliente"}', '{item.name}')

if ($content -eq $original) {
  Write-Host "Trecho exato nao encontrado. Tentando regex mais ampla..." -ForegroundColor Yellow

  $content = [regex]::Replace(
    $content,
    "\{item\.text\s*\|\|\s*item\.texto\s*\|\|\s*['""]Atendimento excelente e organizado\.['""]\}",
    "{item.text}"
  )

  $content = [regex]::Replace(
    $content,
    "\{item\.name\s*\|\|\s*item\.nome\s*\|\|\s*['""]Cliente['""]\}",
    "{item.name}"
  )
}

if ($content -match "item\.texto") {
  Write-Host "Ainda existe item.texto no arquivo. Vou mostrar as linhas para conferir:" -ForegroundColor Red
  Select-String -Path $file -Pattern "item\.texto" -Context 2,2
  exit 1
}

if ($content -match "item\.nome") {
  Write-Host "Ainda existe item.nome no arquivo. Vou mostrar as linhas para conferir:" -ForegroundColor Red
  Select-String -Path $file -Pattern "item\.nome" -Context 2,2
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Corrigido: depoimentos agora usam item.text e item.name." -ForegroundColor Green

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
