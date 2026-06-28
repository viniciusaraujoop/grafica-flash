$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$targets = @()
$folders = @("app", "components", "lib")

foreach ($folder in $folders) {
  $path = Join-Path $project $folder
  if (Test-Path -LiteralPath $path) {
    $targets += Get-ChildItem -LiteralPath $path -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.md
  }
}

$extraFiles = @("README.md", "RELATORIO-LIMPEZA-ORCALY.md")

foreach ($extra in $extraFiles) {
  $extraPath = Join-Path $project $extra
  if (Test-Path -LiteralPath $extraPath) {
    $targets += Get-Item -LiteralPath $extraPath
  }
}

# Mapa de mojibake mais comum quando arquivo UTF-8 sem BOM foi lido como ANSI/Latin1.
# Isso corrige coisas como:
# orÃ§amentos -> orçamentos
# operaÃ§Ã£o -> operação
# NÃ£o -> Não
# usuÃ¡rio -> usuário
$map = [ordered]@{
  "ÃƒÂ¡" = "á"; "ÃƒÂ " = "à"; "ÃƒÂ£" = "ã"; "ÃƒÂ¢" = "â"; "ÃƒÂ¤" = "ä"
  "ÃƒÂ©" = "é"; "ÃƒÂ¨" = "è"; "ÃƒÂª" = "ê"; "ÃƒÂ«" = "ë"
  "ÃƒÂ­" = "í"; "ÃƒÂ¬" = "ì"; "ÃƒÂ®" = "î"; "ÃƒÂ¯" = "ï"
  "ÃƒÂ³" = "ó"; "ÃƒÂ²" = "ò"; "ÃƒÂµ" = "õ"; "ÃƒÂ´" = "ô"; "ÃƒÂ¶" = "ö"
  "ÃƒÂº" = "ú"; "ÃƒÂ¹" = "ù"; "ÃƒÂ»" = "û"; "ÃƒÂ¼" = "ü"
  "ÃƒÂ§" = "ç"; "ÃƒÂ±" = "ñ"

  "Ãƒï¿½" = "Á"; "Ãƒâ‚¬" = "À"; "ÃƒÆ’" = "Ã"; "Ãƒâ€š" = "Â"
  "Ãƒâ€°" = "É"; "ÃƒÅ " = "Ê"; "Ãƒï¿½" = "Í"
  "Ãƒâ€œ" = "Ó"; "Ãƒâ€¢" = "Õ"; "Ãƒâ€�" = "Ô"
  "ÃƒÅ¡" = "Ú"; "Ãƒâ€¡" = "Ç"

  "Ã¡" = "á"; "Ã " = "à"; "Ã£" = "ã"; "Ã¢" = "â"; "Ã¤" = "ä"
  "Ã©" = "é"; "Ã¨" = "è"; "Ãª" = "ê"; "Ã«" = "ë"
  "Ã­" = "í"; "Ã¬" = "ì"; "Ã®" = "î"; "Ã¯" = "ï"
  "Ã³" = "ó"; "Ã²" = "ò"; "Ãµ" = "õ"; "Ã´" = "ô"; "Ã¶" = "ö"
  "Ãº" = "ú"; "Ã¹" = "ù"; "Ã»" = "û"; "Ã¼" = "ü"
  "Ã§" = "ç"; "Ã±" = "ñ"

  "Ã" = "Á"; "Ã€" = "À"; "Ãƒ" = "Ã"; "Ã‚" = "Â"
  "Ã‰" = "É"; "ÃŠ" = "Ê"; "Ã" = "Í"
  "Ã“" = "Ó"; "Ã•" = "Õ"; "Ã”" = "Ô"
  "Ãš" = "Ú"; "Ã‡" = "Ç"

  "Âº" = "º"; "Âª" = "ª"; "Â°" = "°"
  "â€“" = "–"; "â€”" = "—"; "â€˜" = "‘"; "â€™" = "’"; "â€œ" = "“"; "â€" = "”"
  "â€¦" = "…"; "Â·" = "·"; "Â " = " "
}

$changed = 0
$scanned = 0

foreach ($file in $targets | Sort-Object FullName -Unique) {
  $scanned += 1

  # Leitura correta em UTF-8. Nada de Get-Content sem Encoding, porque foi esse duende que causou a desgraça.
  $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
  $original = $content

  foreach ($key in $map.Keys) {
    $content = $content.Replace($key, $map[$key])
  }

  if ($content -ne $original) {
    $backup = $file.FullName + ".backup-acentos-" + (Get-Date -Format "yyyyMMddHHmmss")
    Copy-Item -LiteralPath $file.FullName -Destination $backup -Force

    [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
    $changed += 1

    $relative = $file.FullName.Substring($project.Length).TrimStart("\", "/")
    Write-Host "Acentos corrigidos: $relative" -ForegroundColor Green
  }
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Arquivos verificados: $scanned" -ForegroundColor Cyan
Write-Host "Arquivos corrigidos: $changed" -ForegroundColor Green
Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
