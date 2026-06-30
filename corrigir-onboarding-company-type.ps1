$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\onboarding\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-company-type-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Corrige inferencia do TypeScript:
# const company = data?.company || {}
# vira:
# const company: Partial<OnboardingPayload['company']> = data?.company ?? {}
$content = $content.Replace(
  "const company = data?.company || {}",
  "const company: Partial<OnboardingPayload['company']> = data?.company ?? {}"
)

# Caso o arquivo tenha espacos diferentes.
$content = $content.Replace(
  "const company = data?.company ?? {}",
  "const company: Partial<OnboardingPayload['company']> = data?.company ?? {}"
)

if ($content -eq $original) {
  Write-Host "Nao encontrei o trecho exato. Aplicando correcao por regex..." -ForegroundColor Yellow

  $pattern = 'const\s+company\s*=\s*data\?\.company\s*(\|\||\?\?)\s*\{\}'
  $replacement = "const company: Partial<OnboardingPayload['company']> = data?.company ?? {}"
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement)
}

if ($content -eq $original) {
  Write-Host "Nenhuma alteracao feita. Envie mais linhas do arquivo se continuar." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Tipagem de company corrigida em app\painel\onboarding\page.tsx" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
