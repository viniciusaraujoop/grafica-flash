$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\whatsapp-notifications.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-link-url-type-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# createNotification tipa link_url como string | undefined.
# null quebra o build, então usamos undefined.
$content = $content.Replace("link_url: input.linkUrl || null,", "link_url: input.linkUrl || undefined,")
$content = $content.Replace("link_url: null,", "link_url: undefined,")

if ($content -eq $original) {
  Write-Host "Nenhum trecho link_url com null foi encontrado. Talvez o arquivo já tenha sido corrigido." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Tipagem link_url corrigida em lib\whatsapp-notifications.ts" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
