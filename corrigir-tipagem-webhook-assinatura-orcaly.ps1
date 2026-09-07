param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "app\api\mercado-pago\webhook\route.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\tipar-webhook-assinatura-$Stamp\route.ts"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Execute na branch feature/asaas-sandbox."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: app/api/mercado-pago/webhook/route.ts"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - TIPAGEM DO WEBHOOK DE ASSINATURA" -ForegroundColor Cyan
Write-Host "Respostas Mercado Pago normalizadas com seguranca" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$PatcherPath = Join-Path $Root ".orcaly-tipar-webhook-$Stamp.cjs"
$PatcherCode = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String("CmNvbnN0IGZzID0gcmVxdWlyZSgibm9kZTpmcyIpOwoKY29uc3QgZmlsZSA9ICJhcHAvYXBpL21lcmNhZG8tcGFnby93ZWJob29rL3JvdXRlLnRzIjsKbGV0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZSwgInV0ZjgiKS5yZXBsYWNlKC9cclxuL2csICJcbiIpOwoKZnVuY3Rpb24gcmVwbGFjZUV4YWN0KG9sZFRleHQsIG5ld1RleHQsIGxhYmVsKSB7CiAgaWYgKGNvbnRlbnQuaW5jbHVkZXMobmV3VGV4dCkpIHsKICAgIGNvbnNvbGUubG9nKGBbSkEgQVBMSUNBRE9dICR7bGFiZWx9YCk7CiAgICByZXR1cm47CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMob2xkVGV4dCkpIHsKICAgIHRocm93IG5ldyBFcnJvcihgVHJlY2hvIG5hbyBlbmNvbnRyYWRvOiAke2xhYmVsfWApOwogIH0KCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZShvbGRUZXh0LCBuZXdUZXh0KTsKICBjb25zb2xlLmxvZyhgW09LXSAke2xhYmVsfWApOwp9CgpyZXBsYWNlRXhhY3QoCmAgfSBmcm9tICJAL2xpYi9zdWJzY3JpcHRpb24tc2VydmljZSI7CgpmdW5jdGlvbiBleHRyYWN0UmVzb3VyY2VJZGAsCmAgfSBmcm9tICJAL2xpYi9zdWJzY3JpcHRpb24tc2VydmljZSI7Cgp0eXBlIEpzb25SZWNvcmQgPSBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjsKCmZ1bmN0aW9uIHRleHQodmFsdWU6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICIiKS50cmltKCk7Cn0KCmZ1bmN0aW9uIHJlY29yZCh2YWx1ZTogdW5rbm93bik6IEpzb25SZWNvcmQgewogIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAib2JqZWN0IiB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkgewogICAgcmV0dXJuIHt9OwogIH0KCiAgcmV0dXJuIHZhbHVlIGFzIEpzb25SZWNvcmQ7Cn0KCmZ1bmN0aW9uIGV4dHJhY3RSZXNvdXJjZUlkYCwKInRpcG9zIHNlZ3Vyb3MgZG8gd2ViaG9vayIKKTsKCnJlcGxhY2VFeGFjdCgKYCAgY29uc3Qgc3Vic2NyaXB0aW9uID0gYXdhaXQgbWVyY2Fkb1BhZ29QbGF0Zm9ybVJlcXVlc3QoXGAvcHJlYXBwcm92YWwvXCR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlc291cmNlSWQpfVxgKTsKICBjb25zdCBmb3VuZCA9IGF3YWl0IGZpbmRDb21wYW55Rm9yUHJvdmlkZXJSZWZlcmVuY2UoCiAgICBhZG1pbiwKICAgIHN1YnNjcmlwdGlvbi5leHRlcm5hbF9yZWZlcmVuY2UsCiAgICBzdWJzY3JpcHRpb24uaWQgfHwgcmVzb3VyY2VJZCwKICApOwpgLApgICBjb25zdCBzdWJzY3JpcHRpb24gPSAoYXdhaXQgbWVyY2Fkb1BhZ29QbGF0Zm9ybVJlcXVlc3QoCiAgICBcYC9wcmVhcHByb3ZhbC9cJHtlbmNvZGVVUklDb21wb25lbnQocmVzb3VyY2VJZCl9XGAsCiAgKSkgYXMgSnNvblJlY29yZDsKICBjb25zdCBzdWJzY3JpcHRpb25JZCA9IHRleHQoc3Vic2NyaXB0aW9uLmlkKSB8fCByZXNvdXJjZUlkOwogIGNvbnN0IGZvdW5kID0gYXdhaXQgZmluZENvbXBhbnlGb3JQcm92aWRlclJlZmVyZW5jZSgKICAgIGFkbWluLAogICAgc3Vic2NyaXB0aW9uLmV4dGVybmFsX3JlZmVyZW5jZSwKICAgIHN1YnNjcmlwdGlvbklkLAogICk7CmAsCiJub3JtYWxpemEgbyBpZGVudGlmaWNhZG9yIGRhIGFzc2luYXR1cmEiCik7CgpyZXBsYWNlRXhhY3QoCmAgICAgICBtZXJjYWRvX3BhZ29fc3Vic2NyaXB0aW9uX2lkOiBzdWJzY3JpcHRpb24uaWQgfHwgcmVzb3VyY2VJZCwKYCwKYCAgICAgIG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25faWQ6IHN1YnNjcmlwdGlvbklkLApgLAoic2FsdmEgbyBpZGVudGlmaWNhZG9yIG5vcm1hbGl6YWRvIgopOwoKcmVwbGFjZUV4YWN0KApgICAgIHByb3ZpZGVyUmVmZXJlbmNlOiBcYFwke3N1YnNjcmlwdGlvbi5pZCB8fCByZXNvdXJjZUlkfTpcJHtyZW1vdGVTdGF0dXN9XGAsCmAsCmAgICAgcHJvdmlkZXJSZWZlcmVuY2U6IFxgXCR7c3Vic2NyaXB0aW9uSWR9Olwke3JlbW90ZVN0YXR1c31cYCwKYCwKImV2ZW50byB1c2EgaWRlbnRpZmljYWRvciBub3JtYWxpemFkbyIKKTsKCnJlcGxhY2VFeGFjdCgKYCAgY29uc3QgYXV0aG9yaXplZFBheW1lbnQgPSBhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdCgKICAgIFxgL2F1dGhvcml6ZWRfcGF5bWVudHMvXCR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlc291cmNlSWQpfVxgLAogICk7CiAgY29uc3QgcHJlYXBwcm92YWxJZCA9IGF1dGhvcml6ZWRQYXltZW50LnByZWFwcHJvdmFsX2lkIHx8IG51bGw7CiAgY29uc3Qgc3Vic2NyaXB0aW9uID0gcHJlYXBwcm92YWxJZAogICAgPyBhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdChcYC9wcmVhcHByb3ZhbC9cJHtlbmNvZGVVUklDb21wb25lbnQocHJlYXBwcm92YWxJZCl9XGApCiAgICA6IG51bGw7CiAgY29uc3QgcmVmZXJlbmNlID0gYXV0aG9yaXplZFBheW1lbnQuZXh0ZXJuYWxfcmVmZXJlbmNlIHx8IHN1YnNjcmlwdGlvbj8uZXh0ZXJuYWxfcmVmZXJlbmNlOwpgLApgICBjb25zdCBhdXRob3JpemVkUGF5bWVudCA9IChhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdCgKICAgIFxgL2F1dGhvcml6ZWRfcGF5bWVudHMvXCR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlc291cmNlSWQpfVxgLAogICkpIGFzIEpzb25SZWNvcmQ7CiAgY29uc3QgcHJlYXBwcm92YWxJZCA9CiAgICB0ZXh0KGF1dGhvcml6ZWRQYXltZW50LnByZWFwcHJvdmFsX2lkKSB8fCBudWxsOwogIGNvbnN0IHN1YnNjcmlwdGlvbiA9IHByZWFwcHJvdmFsSWQKICAgID8gKChhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdCgKICAgICAgICBcYC9wcmVhcHByb3ZhbC9cJHtlbmNvZGVVUklDb21wb25lbnQocHJlYXBwcm92YWxJZCl9XGAsCiAgICAgICkpIGFzIEpzb25SZWNvcmQpCiAgICA6IG51bGw7CiAgY29uc3QgcGF5bWVudCA9IHJlY29yZChhdXRob3JpemVkUGF5bWVudC5wYXltZW50KTsKICBjb25zdCByZWZlcmVuY2UgPQogICAgYXV0aG9yaXplZFBheW1lbnQuZXh0ZXJuYWxfcmVmZXJlbmNlIHx8CiAgICBzdWJzY3JpcHRpb24/LmV4dGVybmFsX3JlZmVyZW5jZTsKYCwKIm5vcm1hbGl6YSBvIHBhZ2FtZW50byByZWNvcnJlbnRlIgopOwoKcmVwbGFjZUV4YWN0KApgICBjb25zdCBwYXltZW50U3RhdHVzID0gU3RyaW5nKAogICAgYXV0aG9yaXplZFBheW1lbnQ/LnBheW1lbnQ/LnN0YXR1cyB8fCBhdXRob3JpemVkUGF5bWVudD8uc3RhdHVzIHx8ICJwZW5kaW5nIiwKICApLnRvTG93ZXJDYXNlKCk7CmAsCmAgIGNvbnN0IHBheW1lbnRTdGF0dXMgPSB0ZXh0KAogICAgcGF5bWVudC5zdGF0dXMgfHwKICAgICAgYXV0aG9yaXplZFBheW1lbnQuc3RhdHVzIHx8CiAgICAgICJwZW5kaW5nIiwKICApLnRvTG93ZXJDYXNlKCk7CmAsCiJzdGF0dXMgcmVjb3JyZW50ZSB1c2EgcmVnaXN0cm8gc2VndXJvIgopOwoKcmVwbGFjZUV4YWN0KApgICAgICAgcHJvdmlkZXJSZWZlcmVuY2U6IFN0cmluZyhhdXRob3JpemVkUGF5bWVudD8ucGF5bWVudD8uaWQgfHwgcmVzb3VyY2VJZCksCiAgICAgIHByZWFwcHJvdmFsSWQsCiAgICAgIG5leHRQYXltZW50RGF0ZTogc3Vic2NyaXB0aW9uPy5uZXh0X3BheW1lbnRfZGF0ZSB8fCBudWxsLAogICAgICBwYXltZW50VHlwZTogImNhcmRfcmVjdXJyaW5nIiwKICAgICAgYW1vdW50OiBOdW1iZXIoYXV0aG9yaXplZFBheW1lbnQ/LnBheW1lbnQ/LnRyYW5zYWN0aW9uX2Ftb3VudCB8fCAwKSB8fCBudWxsLApgLApgICAgICAgcHJvdmlkZXJSZWZlcmVuY2U6CiAgICAgICAgdGV4dChwYXltZW50LmlkKSB8fCByZXNvdXJjZUlkLAogICAgICBwcmVhcHByb3ZhbElkLAogICAgICBuZXh0UGF5bWVudERhdGU6CiAgICAgICAgdGV4dChzdWJzY3JpcHRpb24/Lm5leHRfcGF5bWVudF9kYXRlKSB8fCBudWxsLAogICAgICBwYXltZW50VHlwZTogImNhcmRfcmVjdXJyaW5nIiwKICAgICAgYW1vdW50OgogICAgICAgIE51bWJlcihwYXltZW50LnRyYW5zYWN0aW9uX2Ftb3VudCB8fCAwKSB8fCBudWxsLApgLAoiYXByb3ZhY2FvIHJlY29ycmVudGUgdXNhIHZhbG9yZXMgbm9ybWFsaXphZG9zIgopOwoKcmVwbGFjZUV4YWN0KApgICAgICAgcHJvdmlkZXJSZWZlcmVuY2U6IFN0cmluZyhhdXRob3JpemVkUGF5bWVudD8ucGF5bWVudD8uaWQgfHwgcmVzb3VyY2VJZCksCmAsCmAgICAgICBwcm92aWRlclJlZmVyZW5jZToKICAgICAgICB0ZXh0KHBheW1lbnQuaWQpIHx8IHJlc291cmNlSWQsCmAsCiJldmVudG8gcmVjb3JyZW50ZSB1c2EgaWRlbnRpZmljYWRvciBzZWd1cm8iCik7CgpyZXBsYWNlRXhhY3QoCmAgIGNvbnN0IHBheW1lbnQgPSBhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdChcYC92MS9wYXltZW50cy9cJHtlbmNvZGVVUklDb21wb25lbnQocmVzb3VyY2VJZCl9XGApOwpgLApgICBjb25zdCBwYXltZW50ID0gKGF3YWl0IG1lcmNhZG9QYWdvUGxhdGZvcm1SZXF1ZXN0KAogICAgXGAvdjEvcGF5bWVudHMvXCR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlc291cmNlSWQpfVxgLAogICkpIGFzIEpzb25SZWNvcmQ7CmAsCiJub3JtYWxpemEgYSByZXNwb3N0YSBkbyBwYWdhbWVudG8gUGl4IgopOwoKZnMud3JpdGVGaWxlU3luYyhmaWxlLCBjb250ZW50LCAidXRmOCIpOwo=")
)
[IO.File]::WriteAllText($PatcherPath, $PatcherCode, $Utf8)

try {
  & node $PatcherPath

  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel aplicar a correcao de tipagem."
  }
} finally {
  Remove-Item -LiteralPath $PatcherPath -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "==> Verificando a correcao" -ForegroundColor Cyan

$Checks = @(
  @{
    Pattern = "const subscriptionId = text(subscription.id) || resourceId;"
    Label = "identificador da assinatura normalizado"
  },
  @{
    Pattern = "const payment = record(authorizedPayment.payment);"
    Label = "pagamento recorrente tratado como registro seguro"
  },
  @{
    Pattern = ")) as JsonRecord;"
    Label = "respostas remotas tipadas"
  }
)

foreach ($Check in $Checks) {
  $Match = Select-String `
    -LiteralPath $Target `
    -Pattern $Check.Pattern `
    -SimpleMatch `
    -ErrorAction SilentlyContinue

  if (-not $Match) {
    throw "Verificacao falhou: $($Check.Label)"
  }

  Write-Host "[OK] $($Check.Label)" -ForegroundColor Green
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Limpando cache do Next" -ForegroundColor Cyan
  Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build encontrou o proximo erro de TypeScript. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "WEBHOOK DE ASSINATURA TIPADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "O fluxo continua usando somente MP_SUBSCRIPTION_*."
Write-Host "Cadastro e marketplace nao foram alterados."
Write-Host "Nenhum commit ou deploy foi criado."
Write-Host "Backup: $Backup"
