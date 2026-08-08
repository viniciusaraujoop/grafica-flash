Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root ".orcaly-login-inicio-backup-$Timestamp"
$PatchFile = Join-Path $env:TEMP "orcaly-login-inicio-$Timestamp.js"

$TouchedFiles = @(
  "app\login\page.tsx",
  "app\painel\page.tsx"
)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orçaly."
}

$Branch = (& git branch --show-current | Out-String).Trim()

if ($Branch -ne $ExpectedBranch) {
  throw "Branch atual: $Branch. Use $ExpectedBranch."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

foreach ($RelativePath in $TouchedFiles) {
  $Source = Join-Path $Root $RelativePath

  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Arquivo não encontrado: $RelativePath"
  }

  $Destination = Join-Path $BackupDir $RelativePath
  New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Restore-OrcalyLoginBackup {
  Write-Host ""
  Write-Host "Restaurando os arquivos anteriores..." -ForegroundColor Yellow

  foreach ($RelativePath in $TouchedFiles) {
    $Source = Join-Path $BackupDir $RelativePath
    $Destination = Join-Path $Root $RelativePath

    if (Test-Path -LiteralPath $Source) {
      Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
  }
}

try {
  $EncodedPatch = @'
CmNvbnN0IGZzID0gcmVxdWlyZSgiZnMiKTsKCmNvbnN0IGxvZ2luUGF0aCA9ICJhcHAvbG9naW4vcGFnZS50c3giOwpjb25zdCBwYWluZWxQYXRoID0gImFwcC9wYWluZWwvcGFnZS50c3giOwoKZnVuY3Rpb24gcmVhZChwYXRoKSB7CiAgcmV0dXJuIGZzCiAgICAucmVhZEZpbGVTeW5jKHBhdGgsICJ1dGY4IikKICAgIC5yZXBsYWNlKC9eXHVGRUZGLywgIiIpCiAgICAucmVwbGFjZSgvXHJcbi9nLCAiXG4iKQogICAgLnJlcGxhY2UoL1xyL2csICJcbiIpOwp9CgpmdW5jdGlvbiB3cml0ZShwYXRoLCBjb250ZW50KSB7CiAgZnMud3JpdGVGaWxlU3luYyhwYXRoLCBjb250ZW50LCAidXRmOCIpOwp9CgpmdW5jdGlvbiBwYXRjaExvZ2luKGNvbnRlbnQpIHsKICBpZiAoY29udGVudC5pbmNsdWRlcygiT1JDQUxZX0xPR0lOX0RFRkFVTFRfSU5JQ0lPX1YxIikpIHsKICAgIGNvbnNvbGUubG9nKCJbSkEgT0tdIGxvZ2luIGFicmUgL3BhaW5lbC9pbmljaW8iKTsKICAgIHJldHVybiBjb250ZW50OwogIH0KCiAgY29uc3Qgc3RhcnRNYXJrZXIgPSAiZnVuY3Rpb24gZ2V0U2FmZU5leHRQYXRoKCkgeyI7CiAgY29uc3QgZW5kTWFya2VyID0gIlxuZnVuY3Rpb24gTG9naW5TZWdtZW50UHJldmlldyI7CgogIGNvbnN0IHN0YXJ0ID0gY29udGVudC5pbmRleE9mKHN0YXJ0TWFya2VyKTsKICBjb25zdCBlbmQgPSBjb250ZW50LmluZGV4T2YoZW5kTWFya2VyLCBzdGFydCk7CgogIGlmIChzdGFydCA8IDAgfHwgZW5kIDwgMCkgewogICAgdGhyb3cgbmV3IEVycm9yKCJGdW7Dp8OjbyBnZXRTYWZlTmV4dFBhdGggbsOjbyBlbmNvbnRyYWRhLiIpOwogIH0KCiAgY29uc3Qgb3JpZ2luYWxGdW5jdGlvbiA9IGNvbnRlbnQuc2xpY2Uoc3RhcnQsIGVuZCk7CiAgY29uc3QgcGF0Y2hlZEZ1bmN0aW9uID0gb3JpZ2luYWxGdW5jdGlvbi5yZXBsYWNlQWxsKAogICAgIicvcGFpbmVsJyIsCiAgICAiJy9wYWluZWwvaW5pY2lvJyIsCiAgKTsKCiAgaWYgKHBhdGNoZWRGdW5jdGlvbiA9PT0gb3JpZ2luYWxGdW5jdGlvbikgewogICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAiTmVuaHVtIGRlc3Rpbm8gcGFkcsOjbyAvcGFpbmVsIGZvaSBlbmNvbnRyYWRvIG5vIGxvZ2luLiIsCiAgICApOwogIH0KCiAgaWYgKCFwYXRjaGVkRnVuY3Rpb24uaW5jbHVkZXMoInJldHVybiAnL3BhaW5lbC9pbmljaW8nIikpIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIk8gZGVzdGlubyAvcGFpbmVsL2luaWNpbyBuw6NvIGZvaSBhcGxpY2FkbyBhbyBsb2dpbi4iLAogICAgKTsKICB9CgogIHJldHVybiAoCiAgICBjb250ZW50LnNsaWNlKDAsIHN0YXJ0KSArCiAgICAiLy8gT1JDQUxZX0xPR0lOX0RFRkFVTFRfSU5JQ0lPX1YxXG4iICsKICAgIHBhdGNoZWRGdW5jdGlvbiArCiAgICBjb250ZW50LnNsaWNlKGVuZCkKICApOwp9CgpmdW5jdGlvbiBwYXRjaFBhaW5lbFJvb3QoY29udGVudCkgewogIGlmICgKICAgIGNvbnRlbnQuaW5jbHVkZXMoIk9SQ0FMWV9QQUlORUxfUk9PVF9JTklDSU9fVjEiKSAmJgogICAgY29udGVudC5pbmNsdWRlcygicmVkaXJlY3QoJy9wYWluZWwvaW5pY2lvJykiKQogICkgewogICAgY29uc29sZS5sb2coIltKQSBPS10gL3BhaW5lbCByZWRpcmVjaW9uYSBwYXJhIC9wYWluZWwvaW5pY2lvIik7CiAgICByZXR1cm4gY29udGVudDsKICB9CgogIGlmICghY29udGVudC5pbmNsdWRlcygicmVkaXJlY3QoJy9wYWluZWwvc2l0ZScpIikpIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIlJlZGlyZWNpb25hbWVudG8gYXR1YWwgZGUgL3BhaW5lbCBwYXJhIC9wYWluZWwvc2l0ZSBuw6NvIGVuY29udHJhZG8uIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIi8vIE9SQ0FMWV9NSU5IQV9WSVRSSU5FX0hPTUVfVjEiLAogICAgIi8vIE9SQ0FMWV9QQUlORUxfUk9PVF9JTklDSU9fVjEiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAicmVkaXJlY3QoJy9wYWluZWwvc2l0ZScpIiwKICAgICJyZWRpcmVjdCgnL3BhaW5lbC9pbmljaW8nKSIsCiAgKTsKCiAgcmV0dXJuIGNvbnRlbnQ7Cn0KCmNvbnN0IGxvZ2luID0gcGF0Y2hMb2dpbihyZWFkKGxvZ2luUGF0aCkpOwpjb25zdCBwYWluZWwgPSBwYXRjaFBhaW5lbFJvb3QocmVhZChwYWluZWxQYXRoKSk7Cgp3cml0ZShsb2dpblBhdGgsIGxvZ2luKTsKd3JpdGUocGFpbmVsUGF0aCwgcGFpbmVsKTsKCmNvbnNvbGUubG9nKCJbT0tdIGxvZ2luIHBhZHLDo28gLT4gL3BhaW5lbC9pbmljaW8iKTsKY29uc29sZS5sb2coIltPS10gL3BhaW5lbCAtPiAvcGFpbmVsL2luaWNpbyIpOwpjb25zb2xlLmxvZygiUEFUQ0hfTk9ERV9FWElUX0NPREU9MCIpOwo=
'@

  $PatchBytes = [Convert]::FromBase64String(($EncodedPatch -replace "\s", ""))
  [IO.File]::WriteAllBytes($PatchFile, $PatchBytes)

  Write-Host "==> Alterando destino inicial após login" -ForegroundColor Cyan

  node $PatchFile
  $PatchExitCode = $LASTEXITCODE

  Write-Host ""
  Write-Host "PATCH_NODE_EXIT_CODE=$PatchExitCode" -ForegroundColor Yellow

  if ($PatchExitCode -ne 0) {
    throw "A alteração do redirecionamento falhou."
  }

  $Checks = @(
    @("app\login\page.tsx", "ORCALY_LOGIN_DEFAULT_INICIO_V1"),
    @("app\login\page.tsx", "return '/painel/inicio'"),
    @("app\painel\page.tsx", "ORCALY_PAINEL_ROOT_INICIO_V1"),
    @("app\painel\page.tsx", "redirect('/painel/inicio')")
  )

  Write-Host ""
  Write-Host "==> Verificando redirecionamentos" -ForegroundColor Cyan

  foreach ($Check in $Checks) {
    $Found = Select-String `
      -LiteralPath (Join-Path $Root $Check[0]) `
      -Pattern $Check[1] `
      -SimpleMatch `
      -ErrorAction SilentlyContinue

    if (-not $Found) {
      throw "Verificação falhou: $($Check[0]) -> $($Check[1])"
    }

    Write-Host "[OK] $($Check[1])" -ForegroundColor Green
  }

  $OldPainelRedirect = Select-String `
    -LiteralPath (Join-Path $Root "app\painel\page.tsx") `
    -Pattern "redirect('/painel/site')" `
    -SimpleMatch `
    -ErrorAction SilentlyContinue

  if ($OldPainelRedirect) {
    throw "O redirecionamento antigo para /painel/site ainda existe."
  }

  Write-Host ""
  Write-Host "==> Verificando diff" -ForegroundColor Cyan

  git --no-pager diff --check -- @($TouchedFiles)

  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
  }

  Remove-Item `
    -LiteralPath (Join-Path $Root ".next") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==> Executando build completo" -ForegroundColor Cyan

  npm run build
  $BuildExitCode = $LASTEXITCODE

  Write-Host ""
  Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

  if ($BuildExitCode -ne 0) {
    throw "O build falhou."
  }

  Remove-Item -LiteralPath $BackupDir -Recurse -Force
  Remove-Item -LiteralPath $PatchFile -Force -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Green
  Write-Host "LOGIN DIRECIONADO PARA /PAINEL/INICIO" -ForegroundColor Green
  Write-Host "==================================================" -ForegroundColor Green
  Write-Host "Login normal: /painel/inicio"
  Write-Host "Acesso direto a /painel: /painel/inicio"
  Write-Host "Links com ?next=: continuam preservados"
  Write-Host ""
  Write-Host "Nenhum commit, push ou deploy foi criado."
}
catch {
  Restore-OrcalyLoginBackup
  Remove-Item -LiteralPath $PatchFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
  throw
}
