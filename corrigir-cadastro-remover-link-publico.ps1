$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\cadastro\page.tsx"

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
ICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9Im10LTUgcm91bmRlZC0zeGwgYm9yZGVyIGJvcmRlci1ibHVlLTEwMCBiZy1ncmFkaWVudC10by1iciBmcm9tLWJsdWUtNTAgdG8td2hpdGUgcC01Ij4KICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBpdGVtcy1zdGFydCBnYXAtNCI+CiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBoLTEyIHctMTIgc2hyaW5rLTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtMnhsIGJnLVsjMDUyNDVjXSB0ZXh0LXhsIHRleHQtd2hpdGUiPgogICAgICAgICAgICAgICAgICDinKgKICAgICAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgICAgIDxkaXY+CiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0idGV4dC14cyBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy1bMC4xOGVtXSB0ZXh0LVsjMDUyNDVjXSI+CiAgICAgICAgICAgICAgICAgICAgUXVhc2UgcHJvbnRvCiAgICAgICAgICAgICAgICAgIDwvcD4KCiAgICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9Im10LTIgdGV4dC0yeGwgZm9udC1ibGFjayB0ZXh0LVsjMDcxYjNhXSI+CiAgICAgICAgICAgICAgICAgICAgU3VhIGVzdHJ1dHVyYSBkaWdpdGFsIGVzdMOhIGEgdW0gcGFzc28gZGUgZW50cmFyIG5vIGFyLgogICAgICAgICAgICAgICAgICA8L2gzPgoKICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0yIHRleHQtc20gZm9udC1ib2xkIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTYwMCI+CiAgICAgICAgICAgICAgICAgICAgRGVwb2lzIGRvIHBhZ2FtZW50bywgc3VhIGVtcHJlc2EgZ2FuaGEgYWNlc3NvIGFvIHBhaW5lbCBwYXJhIG9yZ2FuaXphciBwcm9kdXRvcywKICAgICAgICAgICAgICAgICAgICBwZWRpZG9zLCBjbGllbnRlcyBlIHByb2Nlc3NvcyBlbSB1bSBzw7MgbHVnYXIuCiAgICAgICAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ibXQtNSBncmlkIGdhcC0zIHNtOmdyaWQtY29scy0zIj4KICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBiZy13aGl0ZSBwLTQgc2hhZG93LXNtIHNoYWRvdy1ibHVlLTk1MC81Ij4KICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjE0ZW1dIHRleHQtc2xhdGUtNDAwIj4KICAgICAgICAgICAgICAgICAgICBQbGFubwogICAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMSBmb250LWJsYWNrIHRleHQtWyMwNzFiM2FdIj4KICAgICAgICAgICAgICAgICAgICB7cGxhbm9Fc2NvbGhpZG8ubm9tZX0KICAgICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgICAgPC9kaXY+CgogICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJnLXdoaXRlIHAtNCBzaGFkb3ctc20gc2hhZG93LWJsdWUtOTUwLzUiPgogICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMTRlbV0gdGV4dC1zbGF0ZS00MDAiPgogICAgICAgICAgICAgICAgICAgIEVtcHJlc2EKICAgICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTEgdHJ1bmNhdGUgZm9udC1ibGFjayB0ZXh0LVsjMDcxYjNhXSI+CiAgICAgICAgICAgICAgICAgICAge25vbWVFbXByZXNhIHx8ICdTdWEgZW1wcmVzYSd9CiAgICAgICAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBiZy13aGl0ZSBwLTQgc2hhZG93LXNtIHNoYWRvdy1ibHVlLTk1MC81Ij4KICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjE0ZW1dIHRleHQtc2xhdGUtNDAwIj4KICAgICAgICAgICAgICAgICAgICBDaWRhZGUKICAgICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTEgdHJ1bmNhdGUgZm9udC1ibGFjayB0ZXh0LVsjMDcxYjNhXSI+CiAgICAgICAgICAgICAgICAgICAge2NpZGFkZSB8fCAnQSBkZWZpbmlyJ30KICAgICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDwvZGl2Pg==
"@

$replacementBytes = [System.Convert]::FromBase64String($replacementBase64.Trim())
$replacement = [System.Text.Encoding]::UTF8.GetString($replacementBytes)

$pattern = '(?s)\s*<div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5">\s*<p className="text-xs font-black uppercase tracking-\[0\.18em\] text-\[#05245c\]">\s*Link p(?:ú|u)blico\s*</p>\s*<p className="mt-2 break-all text-2xl font-black text-\[#071b3a\]">\s*\{slug \|\| ''sua-empresa''\}\s*</p>\s*<p className="mt-2 text-sm font-bold leading-6 text-slate-600">\s*.*?</p>\s*</div>'

$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, "`r`n$replacement", 1)

if ($newContent -eq $content) {
  Write-Host "Nao encontrei o bloco antigo automaticamente. Tentando remover por texto..." -ForegroundColor Yellow

  $pattern2 = '(?s)\s*<div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5">.*?Link p(?:ú|u)blico.*?</div>'
  $newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern2, "`r`n$replacement", 1)
}

if ($newContent -eq $content) {
  Write-Host "Nao consegui encontrar o bloco do Link publico. Abra app\cadastro\page.tsx e remova manualmente o bloco que comeca com Link publico." -ForegroundColor Red
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $newContent, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Bloco de link publico removido e substituido por resumo comercial." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
