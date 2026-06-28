$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\setup\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-company-type-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$old = "const data = company || {}"
$new = "const data: Partial<Company> = company ?? {}"

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
} elseif ($content.Contains($new)) {
  Write-Host "Arquivo ja estava corrigido." -ForegroundColor Yellow
} else {
  Write-Host "Nao encontrei a linha esperada. Tentando correcao por regex..." -ForegroundColor Yellow
  $content = [System.Text.RegularExpressions.Regex]::Replace(
    $content,
    "const\s+data\s*=\s*company\s*\|\|\s*\{\}",
    $new
  )
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Tipo do company no checklist corrigido." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
