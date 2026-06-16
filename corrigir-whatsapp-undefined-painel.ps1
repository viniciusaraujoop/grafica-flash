$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\page.tsx"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

Set-Location $project

$content = Get-Content $file -Raw

$content = $content.Replace(
  "function telefoneLimpo(valor: string | null)",
  "function telefoneLimpo(valor: string | null | undefined)"
)

$content = $content.Replace(
  "function linkWhatsapp(valor: string | null)",
  "function linkWhatsapp(valor: string | null | undefined)"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Erro de tipo do WhatsApp corrigido em app\painel\page.tsx" -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
