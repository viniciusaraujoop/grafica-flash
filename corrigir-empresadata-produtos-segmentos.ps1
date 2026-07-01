$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\produtos\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-empresadata-produtos-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Corrige variável inexistente inserida no patch anterior.
# Dentro dessa tela a empresa atual se chama "empresa", não "empresaData".
$content = $content.Replace("business_type: (empresaData as any).business_type || 'services',", "business_type: (empresa as any)?.business_type || 'services',")
$content = $content.Replace("business_type: empresaData?.business_type || 'services',", "business_type: (empresa as any)?.business_type || 'services',")
$content = $content.Replace("business_type: empresaData.business_type || 'services',", "business_type: (empresa as any)?.business_type || 'services',")

if ($content -eq $original) {
  Write-Host "Trecho com empresaData nao foi encontrado. Vou verificar se ja esta corrigido..." -ForegroundColor Yellow

  if ($content -match "business_type:\s*\(empresa as any\)\?\.business_type") {
    Write-Host "Arquivo ja parece corrigido." -ForegroundColor Green
  } else {
    Write-Host "Nao encontrei o trecho esperado. Confira manualmente a linha do erro." -ForegroundColor Red
    exit 1
  }
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Corrigido: empresaData -> empresa em app\painel\produtos\page.tsx" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
