$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

$extensoes = "*.tsx", "*.ts"
$arquivos = Get-ChildItem -Path "app" -Recurse -Include $extensoes -File

$totalAlterados = 0
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($arquivo in $arquivos) {
  $content = [System.IO.File]::ReadAllText($arquivo.FullName)
  $original = $content

  $content = $content.Replace(".eq('owner_id', usuario.id)", '.or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)')
  $content = $content.Replace('.eq("owner_id", usuario.id)', '.or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)')

  $content = $content.Replace(".eq('owner_id', user.id)", '.or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)')
  $content = $content.Replace('.eq("owner_id", user.id)', '.or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)')

  $content = $content.Replace(".eq('owner_id', usuario?.id)", '.or(`owner_id.eq.${usuario?.id},tester_id.eq.${usuario?.id}`)')
  $content = $content.Replace('.eq("owner_id", usuario?.id)', '.or(`owner_id.eq.${usuario?.id},tester_id.eq.${usuario?.id}`)')

  if ($content -ne $original) {
    [System.IO.File]::WriteAllText($arquivo.FullName, $content, $utf8NoBom)
    Write-Host "Atualizado: $($arquivo.FullName)" -ForegroundColor Green
    $totalAlterados++
  }
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Arquivos alterados: $totalAlterados" -ForegroundColor Cyan
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
