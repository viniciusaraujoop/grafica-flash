$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$files = @(
  "app\page.tsx",
  "app\cadastro\page.tsx",
  "app\api\company\subscription\route.ts"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($relative in $files) {
  $target = Join-Path $project $relative

  if (!(Test-Path -LiteralPath $target)) {
    Write-Host "Arquivo nao encontrado: $relative" -ForegroundColor Red
    exit 1
  }

  $backup = $target + ".backup-precos-planos-" + (Get-Date -Format "yyyyMMddHHmmss")
  Copy-Item -LiteralPath $target -Destination $backup -Force
  Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

  $content = Get-Content -LiteralPath $target -Raw

  # Home e cadastro
  $content = $content.Replace("preco: 'R$ 5,00'", "preco: 'R$ 49,90'")
  $content = $content.Replace('preco: "R$ 5,00"', 'preco: "R$ 49,90"')
  $content = $content.Replace("preco: 'R$ 15,00'", "preco: 'R$ 149,90'")
  $content = $content.Replace('preco: "R$ 15,00"', 'preco: "R$ 149,90"')

  # API antiga de subscription
  $content = $content.Replace("valor: 5,", "valor: 49.9,")
  $content = $content.Replace("valor: 5.0,", "valor: 49.9,")
  $content = $content.Replace("valor: 15,", "valor: 149.9,")
  $content = $content.Replace("valor: 15.0,", "valor: 149.9,")

  [System.IO.File]::WriteAllText($target, $content, $utf8NoBom)

  Write-Host "Precos alinhados em: $relative" -ForegroundColor Green
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Precos oficiais aplicados:" -ForegroundColor Green
Write-Host "Basico/Essencial: R$ 49,90" -ForegroundColor Cyan
Write-Host "Intermediario/Profissional: R$ 99,90" -ForegroundColor Cyan
Write-Host "Premium: R$ 149,90" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
