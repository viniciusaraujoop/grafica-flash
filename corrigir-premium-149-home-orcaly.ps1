$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$page = Join-Path $project "app\page.tsx"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path -LiteralPath $page)) {
  Write-Host "Arquivo app\page.tsx nao encontrado." -ForegroundColor Red
  exit 1
}

$backup = $page + ".backup-premium-149-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $page -Destination $backup -Force

$content = Get-Content -LiteralPath $page -Raw -Encoding UTF8
$content = $content.Replace("R$ 199,90", "R$ 149,90")

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($page, $content, $utf8NoBom)

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host "Valor do Premium corrigido para R$ 149,90 na home." -ForegroundColor Green
Write-Host "Backup criado em: $backup" -ForegroundColor DarkYellow
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
