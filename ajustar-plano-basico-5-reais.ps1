$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$arquivos = @(
  "app\page.tsx",
  "app\assinatura\page.tsx",
  "app\cadastro\page.tsx",
  "app\api\company\subscription\route.ts",
  "app\api\checkout\plano\route.ts",
  "app\api\checkout\lead\route.ts"
)

foreach ($rel in $arquivos) {
  $path = Join-Path $project $rel

  if (Test-Path -LiteralPath $path) {
    $backup = $path + ".backup-basico-5-reais-" + (Get-Date -Format "yyyyMMddHHmmss")
    Copy-Item -LiteralPath $path -Destination $backup -Force

    $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8

    # Textos visuais
    $content = $content.Replace("R$ 49,90", "R$ 5,00")
    $content = $content.Replace("R$49,90", "R$5,00")
    $content = $content.Replace("49,90/mês", "5,00/mês")
    $content = $content.Replace("49,90 /mês", "5,00 /mês")
    $content = $content.Replace("49,90", "5,00")

    # Valores JS/TS usados no checkout/assinatura automática.
    # Mantém o ajuste focado no bloco do plano basico/Essencial.
    $content = $content -replace "(?s)(basico\s*:\s*\{.*?valor\s*:\s*)49\.9(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(basico\s*:\s*\{.*?valor\s*:\s*)49\.90(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(essencial\s*:\s*\{.*?valor\s*:\s*)49\.9(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(essencial\s*:\s*\{.*?valor\s*:\s*)49\.90(\s*,)", '${1}5${2}'

    # Casos comuns em arrays de planos.
    $content = $content -replace "(?s)(nome\s*:\s*['""]Essencial['""].*?valor\s*:\s*)49\.9(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(nome\s*:\s*['""]Essencial['""].*?valor\s*:\s*)49\.90(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(nome\s*:\s*['""]B[aá]sico['""].*?valor\s*:\s*)49\.9(\s*,)", '${1}5${2}'
    $content = $content -replace "(?s)(nome\s*:\s*['""]B[aá]sico['""].*?valor\s*:\s*)49\.90(\s*,)", '${1}5${2}'

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

    Write-Host "Atualizado: $rel" -ForegroundColor Green
    Write-Host "Backup: $backup" -ForegroundColor DarkYellow
  }
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Plano basico/Essencial ajustado para R$ 5,00." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
