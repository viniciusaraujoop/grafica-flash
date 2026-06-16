$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$arquivos = @(
  "app\api\admin\dashboard\route.ts",
  "app\api\admin\scan\route.ts"
)

foreach ($rel in $arquivos) {
  $file = Join-Path $project $rel

  if (Test-Path $file) {
    $content = [System.IO.File]::ReadAllText($file)

    $content = $content.Replace("const supabase = admin.supabaseAdmin", "const supabase = admin.supabaseAdmin as any")
    $content = $content.Replace("let supabase = getSupabaseAdmin()", "let supabase = getSupabaseAdmin() as any")
    $content = $content.Replace("supabase = admin.supabaseAdmin", "supabase = admin.supabaseAdmin as any")

    [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
    Write-Host "Corrigido: $rel" -ForegroundColor Green
  } else {
    Write-Host "Nao encontrado: $rel" -ForegroundColor Yellow
  }
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Erro de tipagem do Supabase corrigido no admin." -ForegroundColor Cyan
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
