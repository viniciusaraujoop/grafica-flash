$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\company-access.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-remove-all-duplicate-isAdminMaster-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = Get-Content -LiteralPath $file -Raw

# permissionsByRole ja retorna isAdminMaster.
# Entao removemos qualquer isAdminMaster escrito antes de ...permissionsByRole.
$content = $content -replace "isAdminMaster,\s*\.\.\.permissionsByRole", "...permissionsByRole"
$content = $content -replace "isAdminMaster,\s*\r?\n\s*\.\.\.permissionsByRole", "...permissionsByRole"

# Correcoes específicas para retornos em uma linha.
$content = $content -replace "return \{ company: null, role: null, isAdminMaster, \.\.\.permissionsByRole", "return { company: null, role: null, ...permissionsByRole"
$content = $content -replace "return \{ company, role, isAdminMaster, \.\.\.permissionsByRole", "return { company, role, ...permissionsByRole"
$content = $content -replace "return \{ company: adminCompany, role: 'super_admin', isAdminMaster, \.\.\.permissionsByRole", "return { company: adminCompany, role: 'super_admin', ...permissionsByRole"
$content = $content -replace "return \{\s*company: ownerCompany,\s*role: isAdminMaster \? 'super_admin' : 'dono',\s*isAdminMaster,\s*\.\.\.permissionsByRole\('dono', isAdminMaster\),\s*\}", "return {`n      company: ownerCompany,`n      role: isAdminMaster ? 'super_admin' : 'dono',`n      ...permissionsByRole('dono', isAdminMaster),`n    }"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Todas as duplicidades de isAdminMaster foram corrigidas." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
