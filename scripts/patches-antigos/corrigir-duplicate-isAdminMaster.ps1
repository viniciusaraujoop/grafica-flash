$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\company-access.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-duplicate-isAdminMaster-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = Get-Content -LiteralPath $file -Raw

# Remove duplicidade: permissionsByRole já retorna isAdminMaster.
$content = $content -replace "role: null, isAdminMaster, \.\.\.permissionsByRole", "role: null, ...permissionsByRole"
$content = $content -replace "isAdminMaster,\s*\r?\n\s*\.\.\.permissionsByRole", "...permissionsByRole"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Duplicidade isAdminMaster corrigida em lib/company-access.ts." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
