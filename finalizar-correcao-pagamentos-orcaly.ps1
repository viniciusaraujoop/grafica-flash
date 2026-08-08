param(
    [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "O comando falhou: $Command $($Arguments -join ' ')"
    }
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 diretamente na raiz do projeto grafica-flash."
}

$Branch = (& git branch --show-current).Trim()

if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível identificar a branch atual."
}

if (-not $Branch.StartsWith("fix/unify-payment-flows-phase-1")) {
    throw "Branch atual: $Branch. Execute na branch fix/unify-payment-flows-phase-1."
}

Write-Host ""
Write-Host "==> Corrigindo o tipo de paymentRowId" -ForegroundColor Cyan

$RelativeFile = "lib/subscription-checkout-payment.ts"
$File = Join-Path $ProjectRoot $RelativeFile

if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
    throw "Arquivo não encontrado: $RelativeFile"
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Content = [System.IO.File]::ReadAllText($File)

$OldBlock = @'
function parseReference(value: unknown) {
  const parsed = parseSubscriptionReference(value);

  if (!parsed || parsed.kind !== "checkout" || !parsed.paymentRowId) {
    return null;
  }

  return parsed;
}
'@

$NewBlock = @'
function parseReference(value: unknown) {
  const parsed = parseSubscriptionReference(value);

  if (!parsed || parsed.kind !== "checkout" || !parsed.paymentRowId) {
    return null;
  }

  return {
    kind: parsed.kind,
    companyId: parsed.companyId,
    plan: parsed.plan,
    paymentRowId: parsed.paymentRowId,
  };
}
'@

$NormalizedContent = $Content -replace "`r`n", "`n"

if ($NormalizedContent.Contains($OldBlock)) {
    $NormalizedContent = $NormalizedContent.Replace($OldBlock, $NewBlock)
    [System.IO.File]::WriteAllText($File, $NormalizedContent, $Utf8NoBom)
    Write-Host "  [OK] paymentRowId agora é inferido como string"
}
elseif ($NormalizedContent.Contains("paymentRowId: parsed.paymentRowId,")) {
    Write-Host "  [OK] A correção já estava aplicada"
}
else {
    throw "O bloco parseReference esperado não foi encontrado em $RelativeFile."
}

Write-Host ""
Write-Host "==> Validando contratos de pagamento" -ForegroundColor Cyan
Invoke-Checked npm run verify:payments

Write-Host ""
Write-Host "==> Executando ESLint" -ForegroundColor Cyan
$LintFiles = @(
    "app/api/checkout/plano/route.ts",
    "app/api/mercado-pago/webhook/route.ts",
    "lib/payments/core/contracts.ts",
    "lib/subscription-service.ts",
    "lib/subscription-mercado-pago-transparent.ts",
    "lib/subscription-checkout-payment.ts"
)
Invoke-Checked npx eslint @LintFiles

Write-Host ""
Write-Host "==> Executando build de produção" -ForegroundColor Cyan
Invoke-Checked npm run build

Write-Host ""
Write-Host "==> Verificando o diff" -ForegroundColor Cyan
Invoke-Checked git diff --check

$CommitFiles = @(
    "package.json",
    "app/api/checkout/plano/route.ts",
    "app/api/mercado-pago/webhook/route.ts",
    "lib/payments/core/contracts.ts",
    "lib/subscription-service.ts",
    "lib/subscription-mercado-pago-transparent.ts",
    "lib/subscription-checkout-payment.ts",
    "scripts/verify-payment-flow-boundaries.mjs",
    "supabase/migrations/20260730212000_unify_payment_domain_phase_1.sql"
)

Write-Host ""
Write-Host "==> Criando commit" -ForegroundColor Cyan
Invoke-Checked git add -- @CommitFiles
Invoke-Checked git diff --cached --check

& git diff --cached --quiet
$HasNoStagedChanges = $LASTEXITCODE -eq 0

if ($HasNoStagedChanges) {
    Write-Host "Nenhuma alteração nova para criar commit." -ForegroundColor Yellow
}
else {
    Invoke-Checked git commit -m "Unifica contratos dos fluxos de pagamento - fase 1"
    $CommitHash = (& git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $CommitHash" -ForegroundColor Green
}

if ($Push) {
    Write-Host ""
    Write-Host "==> Enviando branch ao GitHub" -ForegroundColor Cyan
    Invoke-Checked git push -u origin $Branch
}

Write-Host ""
Write-Host "Fase 1 concluída com sucesso." -ForegroundColor Green
Write-Host "A migration do Supabase continua sem aplicação." -ForegroundColor Yellow
