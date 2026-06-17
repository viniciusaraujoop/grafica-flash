$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# No plano Hobby da Vercel, cron precisa rodar no máximo 1 vez por dia.
# Troca o scanner admin de horário para diário às 09:00 UTC.
$vercelJson = @'
{
  "crons": [
    {
      "path": "/api/admin/scan",
      "schedule": "0 9 * * *"
    }
  ]
}
'@

[System.IO.File]::WriteAllText((Join-Path $project "vercel.json"), $vercelJson, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "vercel.json corrigido: cron agora roda 1 vez por dia." -ForegroundColor Green
Write-Host "Agora rode:" -ForegroundColor Yellow
Write-Host "npm run build" -ForegroundColor Yellow
Write-Host "git add vercel.json" -ForegroundColor Yellow
Write-Host "git commit -m `"Corrige cron para plano Hobby da Vercel`"" -ForegroundColor Yellow
Write-Host "git push origin main" -ForegroundColor Yellow
