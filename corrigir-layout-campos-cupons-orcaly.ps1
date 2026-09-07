Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$TargetRelative = "app\painel\cupons\page.tsx"
$Target = Join-Path $Root $TargetRelative
$Backup = "$Target.orcaly-cupons-layout-backup"
$PatchFile = Join-Path $env:TEMP ("orcaly-cupons-layout-" + [Guid]::NewGuid().ToString("N") + ".js")
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orçaly."
}

$Branch = (& git branch --show-current | Out-String).Trim()
if ($Branch -ne "feature/vitrine-marketplace") {
  throw "Branch atual: $Branch. Use feature/vitrine-marketplace."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo não encontrado: $TargetRelative"
}

$Current = Get-Content -LiteralPath $Target -Raw
if ($Current -notmatch "ORCALY_COUPON_CENTER_V2") {
  throw "A página de cupons não está na versão esperada."
}

Copy-Item -LiteralPath $Target -Destination $Backup -Force

try {
  Write-Host "==> Corrigindo campos de valor e desconto máximo" -ForegroundColor Cyan

  $PatchBase64 = @'
CmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTsKCmNvbnN0IHBhdGggPSAnYXBwL3BhaW5lbC9jdXBvbnMvcGFnZS50c3gnOwoKZnVuY3Rpb24gcmVhZEZpbGUoKSB7CiAgcmV0dXJuIGZzCiAgICAucmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4JykKICAgIC5yZXBsYWNlKC9eXHVGRUZGLywgJycpCiAgICAucmVwbGFjZSgvXHJcbi9nLCAnXG4nKQogICAgLnJlcGxhY2UoL1xyL2csICdcbicpOwp9CgpmdW5jdGlvbiByZXBsYWNlQWxsRXhhY3QoY29udGVudCwgZnJvbSwgdG8sIG1pbmltdW0sIGxhYmVsKSB7CiAgY29uc3QgY291bnQgPSBjb250ZW50LnNwbGl0KGZyb20pLmxlbmd0aCAtIDE7CgogIGlmIChjb3VudCA8IG1pbmltdW0pIHsKICAgIHRocm93IG5ldyBFcnJvcihgJHtsYWJlbH06IGVzcGVyYWRvIHBlbG8gbWVub3MgJHttaW5pbXVtfSwgZW5jb250cmFkbyAke2NvdW50fWApOwogIH0KCiAgY29uc29sZS5sb2coYFtPS10gJHtsYWJlbH06ICR7Y291bnR9YCk7CiAgcmV0dXJuIGNvbnRlbnQuc3BsaXQoZnJvbSkuam9pbih0byk7Cn0KCmxldCBjb250ZW50ID0gcmVhZEZpbGUoKTsKCmlmICghY29udGVudC5pbmNsdWRlcygnT1JDQUxZX0NPVVBPTl9DRU5URVJfVjInKSkgewogIHRocm93IG5ldyBFcnJvcignQSBww6FnaW5hIGRlIGN1cG9ucyBuw6NvIGVzdMOhIG5hIHZlcnPDo28gZXNwZXJhZGEuJyk7Cn0KCmlmICghY29udGVudC5pbmNsdWRlcygnT1JDQUxZX0NPVVBPTl9SRVNQT05TSVZFX0ZJRUxEU19WMycpKSB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICcvLyBPUkNBTFlfQ09VUE9OX0NFTlRFUl9WMicsCiAgICAnLy8gT1JDQUxZX0NPVVBPTl9DRU5URVJfVjJcbi8vIE9SQ0FMWV9DT1VQT05fUkVTUE9OU0lWRV9GSUVMRFNfVjMnLAogICk7Cn0KCmNvbnRlbnQgPSByZXBsYWNlQWxsRXhhY3QoCiAgY29udGVudCwKICAnY2xhc3NOYW1lPSJncmlkIGdhcC0zIHNtOmdyaWQtY29scy0yIicsCiAgJ2NsYXNzTmFtZT0iZ3JpZCBtaW4tdy0wIGdhcC0zIHNtOmdyaWQtY29scy0yIHhsOmdyaWQtY29scy0xIDJ4bDpncmlkLWNvbHMtMiInLAogIDMsCiAgJ2dyaWRzIHJlc3BvbnNpdm9zIGRvIGZvcm11bMOhcmlvJywKKTsKCmNvbnRlbnQgPSByZXBsYWNlQWxsRXhhY3QoCiAgY29udGVudCwKICAnY2xhc3NOYW1lPSJncmlkIGdhcC0yIicsCiAgJ2NsYXNzTmFtZT0iZ3JpZCBtaW4tdy0wIGdhcC0yIicsCiAgOCwKICAnbGFiZWxzIGNvbSBsYXJndXJhIHNlZ3VyYScsCik7Cgpjb25zdCBjbGFzc1JlcGxhY2VtZW50cyA9IFsKICBbCiAgICAnY2xhc3NOYW1lPSJyb3VuZGVkLXhsIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIGJnLXdoaXRlIHB4LTQgcHktMyBmb250LWJsYWNrIHVwcGVyY2FzZSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLVsjMDUyNDVjXSBkaXNhYmxlZDpiZy1zbGF0ZS0xMDAiJywKICAgICdjbGFzc05hbWU9InctZnVsbCBtaW4tdy0wIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctd2hpdGUgcHgtNCBweS0zIGZvbnQtYmxhY2sgdXBwZXJjYXNlIG91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItWyMwNTI0NWNdIGRpc2FibGVkOmJnLXNsYXRlLTEwMCInLAogIF0sCiAgWwogICAgJ2NsYXNzTmFtZT0icm91bmRlZC14bCBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBweC00IHB5LTMgZm9udC1ib2xkIG91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItWyMwNTI0NWNdIicsCiAgICAnY2xhc3NOYW1lPSJ3LWZ1bGwgbWluLXctMCByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHB4LTQgcHktMyBmb250LWJvbGQgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1bIzA1MjQ1Y10iJywKICBdLAogIFsKICAgICdjbGFzc05hbWU9InJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgcHgtNCBweS0zIGZvbnQtYm9sZCBvdXRsaW5lLW5vbmUiJywKICAgICdjbGFzc05hbWU9InctZnVsbCBtaW4tdy0wIHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgcHgtNCBweS0zIGZvbnQtYm9sZCBvdXRsaW5lLW5vbmUiJywKICBdLAogIFsKICAgICdjbGFzc05hbWU9InJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgcHgtNCBweS0zIGZvbnQtYm9sZCBvdXRsaW5lLW5vbmUgZGlzYWJsZWQ6Ymctc2xhdGUtMTAwIicsCiAgICAnY2xhc3NOYW1lPSJ3LWZ1bGwgbWluLXctMCByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHB4LTQgcHktMyBmb250LWJvbGQgb3V0bGluZS1ub25lIGRpc2FibGVkOmJnLXNsYXRlLTEwMCInLAogIF0sCiAgWwogICAgJ2NsYXNzTmFtZT0icm91bmRlZC14bCBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBweC0zIHB5LTMgZm9udC1ib2xkIG91dGxpbmUtbm9uZSInLAogICAgJ2NsYXNzTmFtZT0idy1mdWxsIG1pbi13LTAgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBweC0zIHB5LTMgZm9udC1ib2xkIG91dGxpbmUtbm9uZSInLAogIF0sCl07Cgpmb3IgKGNvbnN0IFtmcm9tLCB0b10gb2YgY2xhc3NSZXBsYWNlbWVudHMpIHsKICBpZiAoY29udGVudC5pbmNsdWRlcyhmcm9tKSkgewogICAgY29uc3QgY291bnQgPSBjb250ZW50LnNwbGl0KGZyb20pLmxlbmd0aCAtIDE7CiAgICBjb250ZW50ID0gY29udGVudC5zcGxpdChmcm9tKS5qb2luKHRvKTsKICAgIGNvbnNvbGUubG9nKGBbT0tdIGNhbXBvcyBjb20gbGFyZ3VyYSBzZWd1cmE6ICR7Y291bnR9YCk7CiAgfQp9Cgpjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICdjbGFzc05hbWU9InJvdW5kZWQtWzEuOHJlbV0gYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctd2hpdGUgcC01IHNoYWRvdy1zbSB4bDpzdGlja3kgeGw6dG9wLTUiJywKICAnY2xhc3NOYW1lPSJtaW4tdy0wIG92ZXJmbG93LWhpZGRlbiByb3VuZGVkLVsxLjhyZW1dIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIGJnLXdoaXRlIHAtNSBzaGFkb3ctc20geGw6c3RpY2t5IHhsOnRvcC01IicsCik7Cgpmcy53cml0ZUZpbGVTeW5jKHBhdGgsIGNvbnRlbnQsICd1dGY4Jyk7Cg==
'@

  $Bytes = [Convert]::FromBase64String(($PatchBase64 -replace "\s", ""))
  $PatchContent = [Text.Encoding]::UTF8.GetString($Bytes)
  [IO.File]::WriteAllText($PatchFile, $PatchContent, $Utf8)

  Push-Location $Root
  try {
    & node $PatchFile
    $PatchExitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  Write-Host "PATCH_NODE_EXIT_CODE=$PatchExitCode" -ForegroundColor Yellow

  if ($PatchExitCode -ne 0) {
    throw "O patch Node falhou."
  }

  $Checks = @(
    "ORCALY_COUPON_RESPONSIVE_FIELDS_V3",
    "xl:grid-cols-1 2xl:grid-cols-2",
    "w-full min-w-0",
    "min-w-0 overflow-hidden"
  )

  Write-Host ""
  Write-Host "==> Verificando marcadores" -ForegroundColor Cyan

  foreach ($Check in $Checks) {
    $Match = Select-String `
      -LiteralPath $Target `
      -Pattern $Check `
      -SimpleMatch `
      -ErrorAction SilentlyContinue

    if (-not $Match) {
      throw "Verificação falhou: $Check"
    }

    Write-Host "[OK] $Check" -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "==> Verificando diff" -ForegroundColor Cyan
  & git diff --check -- $TargetRelative

  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
  }

  if (Test-Path -LiteralPath (Join-Path $Root ".next")) {
    Remove-Item -LiteralPath (Join-Path $Root ".next") -Recurse -Force
  }

  Write-Host ""
  Write-Host "==> Executando build completo" -ForegroundColor Cyan
  & npm run build
  $BuildExitCode = $LASTEXITCODE

  Write-Host ""
  Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

  if ($BuildExitCode -ne 0) {
    throw "O build falhou."
  }

  Remove-Item -LiteralPath $Backup -Force

  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Magenta
  Write-Host "CAMPOS DE CUPONS CORRIGIDOS" -ForegroundColor Magenta
  Write-Host "==================================================" -ForegroundColor Magenta
  Write-Host "Pagina: /painel/cupons"
  Write-Host "Campos corrigidos: valor, desconto maximo, datas e pedido minimo"
  Write-Host "Layout: responsivo e sem elementos para fora do card"
  Write-Host ""
  Write-Host "Nenhum commit, push ou deploy foi criado."
}
catch {
  Write-Host ""
  Write-Host "Falha detectada. Restaurando a página anterior..." -ForegroundColor Red

  if (Test-Path -LiteralPath $Backup) {
    Copy-Item -LiteralPath $Backup -Destination $Target -Force
    Remove-Item -LiteralPath $Backup -Force
  }

  throw
}
finally {
  if (Test-Path -LiteralPath $PatchFile) {
    Remove-Item -LiteralPath $PatchFile -Force
  }
}
