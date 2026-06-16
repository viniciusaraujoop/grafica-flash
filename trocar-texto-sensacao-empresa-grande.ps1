$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\page.tsx"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

Set-Location $project

$content = Get-Content $file -Raw

$replacementBase64 = @"
PGgzIGNsYXNzTmFtZT0ibXQtNSB0ZXh0LTJ4bCBmb250LWJsYWNrIHRleHQtWyMwNzFiM2FdIj4KICAgICAgICAgICAgICBBdGVuZGltZW50byBjb20gbWFpcyBjb25maWFuw6dhCiAgICAgICAgICAgIDwvaDM+CiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMyBsZWFkaW5nLTcgdGV4dC1zbGF0ZS02MDAiPgogICAgICAgICAgICAgIE9yZ2FuaXphw6fDo28gdHJhbnNtaXRlIHByb2Zpc3Npb25hbGlzbW8gZGVzZGUgbyBwcmltZWlybyBjb250YXRvLiBPIGNsaWVudGUgZW50ZW5kZSBtZWxob3IsIGNvbmZpYSBtYWlzIGUgZGVjaWRlIGNvbSBtZW5vcyBhdHJpdG8uCiAgICAgICAgICAgIDwvcD4=
"@

$bytes = [System.Convert]::FromBase64String($replacementBase64.Trim())
$replacement = [System.Text.Encoding]::UTF8.GetString($bytes)

$pattern = '(?s)<h3 className="mt-5 text-2xl font-black text-\[\#071b3a\]">\s*(Sensação de empresa grande|Sensa&ccedil;&atilde;o de empresa grande|SensaÃ§Ã£o de empresa grande)\s*</h3>\s*<p className="mt-3 leading-7 text-slate-600">\s*.*?\s*</p>'

$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement, 1)

if ($newContent -eq $content) {
  Write-Host "Nao encontrei o texto antigo automaticamente. Tentando por substituicao simples..." -ForegroundColor Yellow

  $newContent = $content.Replace(
    "Sensação de empresa grande",
    "Atendimento com mais confiança"
  ).Replace(
    "Seu cliente percebe organização antes mesmo de comprar. Percepção vende, infelizmente até mais do que bom senso.",
    "Organização transmite profissionalismo desde o primeiro contato. O cliente entende melhor, confia mais e decide com menos atrito."
  )
}

if ($newContent -eq $content) {
  Write-Host "Nao consegui alterar automaticamente. Abra app\page.tsx e procure por Sensação de empresa grande." -ForegroundColor Red
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $newContent, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Texto da landing alterado com sucesso." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
