param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "C:\Users\arauj\grafica-flash"

$SourceBranch = "fix/unify-payment-flows-phase-1"
$CleanBranch = "agent/reactivate-marketplace-fees-clean"
$FeeCommit = "a10633c"
$CheckoutFile = "lib/payments/checkout-service.ts"
$PlanFile = "lib/plans/plan-config.ts"

Write-Host ""
Write-Host "==> 1. Validando repositorio" -ForegroundColor Cyan

$currentBranch = (git branch --show-current).Trim()

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao consultar a branch atual."
}

if ($currentBranch -ne $SourceBranch) {
    throw "Branch atual incorreta. Esperado: $SourceBranch"
}

$trackedChanges = @(git status --porcelain | Where-Object { $_ -and -not $_.StartsWith("??") })

if ($trackedChanges.Count -gt 0) {
    Write-Host "Existem alteracoes rastreadas no working tree:" -ForegroundColor Red
    $trackedChanges | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    throw "Working tree rastreado precisa estar limpo."
}

git fetch origin $SourceBranch

if ($LASTEXITCODE -ne 0) {
    throw "Falha no git fetch."
}

Write-Host ""
Write-Host "==> 2. Validando commit da taxa" -ForegroundColor Cyan

git cat-file -e "$FeeCommit^{commit}"

if ($LASTEXITCODE -ne 0) {
    throw "Commit local da taxa nao encontrado: $FeeCommit"
}

$feeFiles = @(git diff-tree --no-commit-id --name-only -r $FeeCommit)

Write-Host "Arquivos alterados pelo commit da taxa:"
$feeFiles | ForEach-Object { Write-Host "  $_" }

if ($feeFiles.Count -ne 1) {
    throw "O commit da taxa altera mais de um arquivo."
}

if ($feeFiles[0] -ne $CheckoutFile) {
    throw "O commit da taxa altera um arquivo inesperado."
}

Write-Host ""
Write-Host "==> 3. Criando backup do historico local" -ForegroundColor Cyan

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupBranch = "backup/before-marketplace-fee-publish-$stamp"
$originalHead = (git rev-parse HEAD).Trim()

git branch $backupBranch $originalHead

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar branch de backup."
}

Write-Host "Backup criado:"
Write-Host "  $backupBranch"

Write-Host ""
Write-Host "==> 4. Criando branch limpa a partir do GitHub" -ForegroundColor Cyan

git switch -C $CleanBranch "origin/$SourceBranch"

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao criar branch limpa."
}

Write-Host ""
Write-Host "==> 5. Aplicando somente o commit da taxa" -ForegroundColor Cyan

git cherry-pick $FeeCommit

if ($LASTEXITCODE -ne 0) {
    git cherry-pick --abort | Out-Null
    throw "Cherry-pick da taxa falhou."
}

$publishFiles = @(git diff --name-only "origin/$SourceBranch..HEAD")

Write-Host "Arquivos que serao publicados:"
$publishFiles | ForEach-Object { Write-Host "  $_" }

if ($publishFiles.Count -ne 1) {
    throw "A publicacao contem mais de um arquivo."
}

if ($publishFiles[0] -ne $CheckoutFile) {
    throw "A publicacao contem arquivo inesperado."
}

Write-Host ""
Write-Host "==> 6. Validando logica das taxas" -ForegroundColor Cyan

$checkoutText = Get-Content -LiteralPath $CheckoutFile -Raw
$planText = Get-Content -LiteralPath $PlanFile -Raw

if ($checkoutText -match 'platformFeeEnabled\s*=\s*false') {
    throw "A taxa continua desativada."
}

if ($checkoutText -notmatch 'const\s+feePercent\s*=\s*plan\.marketplaceFeePercent\s*;') {
    throw "feePercent nao usa marketplaceFeePercent do plano."
}

if ($checkoutText -notmatch 'total\s*\*\s*\(\s*feePercent\s*/\s*100\s*\)') {
    throw "Calculo da comissao nao usa total vezes feePercent."
}

if ($checkoutText -notmatch 'paymentPayload\.application_fee\s*=\s*calculation\.commissionAmount\s*;') {
    throw "application_fee do Mercado Pago nao foi encontrada."
}

if ($planText -notmatch 'essencial:\s*\{[^}]*marketplaceFeePercent:\s*3\.5\b') {
    throw "Taxa do Essencial nao esta em 3.5 por cento."
}

if ($planText -notmatch 'profissional:\s*\{[^}]*marketplaceFeePercent:\s*3\b') {
    throw "Taxa do Profissional nao esta em 3 por cento."
}

if ($planText -notmatch 'premium:\s*\{[^}]*marketplaceFeePercent:\s*2\b') {
    throw "Taxa do Premium nao esta em 2 por cento."
}

Write-Host "[OK] Essencial 3.5%" -ForegroundColor Green
Write-Host "[OK] Profissional 3.0%" -ForegroundColor Green
Write-Host "[OK] Premium 2.0%" -ForegroundColor Green
Write-Host "[OK] application_fee ativa" -ForegroundColor Green

Write-Host ""
Write-Host "==> 7. ESLint direcionado" -ForegroundColor Cyan

npx.cmd eslint $CheckoutFile $PlanFile

if ($LASTEXITCODE -ne 0) {
    throw "ESLint falhou."
}

Write-Host ""
Write-Host "==> 8. Verificando pagamentos" -ForegroundColor Cyan

npm.cmd run verify:payments

if ($LASTEXITCODE -ne 0) {
    throw "verify:payments falhou."
}

npm.cmd run verify:payment-credentials

if ($LASTEXITCODE -ne 0) {
    throw "verify:payment-credentials falhou."
}

Write-Host ""
Write-Host "==> 9. Build" -ForegroundColor Cyan

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "Build falhou."
}

Write-Host ""
Write-Host "==> 10. Validando diff" -ForegroundColor Cyan

git diff --check "origin/$SourceBranch..HEAD"

if ($LASTEXITCODE -ne 0) {
    throw "git diff --check falhou."
}

$finalFiles = @(git diff --name-only "origin/$SourceBranch..HEAD")

if ($finalFiles.Count -ne 1 -or $finalFiles[0] -ne $CheckoutFile) {
    throw "Escopo mudou antes do push."
}

Write-Host ""
git --no-pager diff --stat "origin/$SourceBranch..HEAD"

Write-Host ""
Write-Host "==> 11. Publicando commit limpo no GitHub" -ForegroundColor Cyan

git push origin "HEAD:$SourceBranch"

if ($LASTEXITCODE -ne 0) {
    throw "Push falhou."
}

Write-Host ""
Write-Host "==> 12. Alinhando branch local" -ForegroundColor Cyan

git switch $SourceBranch

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao voltar para a branch principal de trabalho."
}

git reset --hard "origin/$SourceBranch"

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao alinhar a branch local com o remoto."
}

$finalCommit = (git rev-parse HEAD).Trim()

Write-Host ""
Write-Host "==> 13. Deploy Preview na Vercel" -ForegroundColor Cyan

$deployOutput = @(npx.cmd vercel deploy --yes 2>&1)

$deployOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    throw "Deploy Preview da Vercel falhou."
}

$previewUrl = ""

foreach ($line in $deployOutput) {
    $match = [regex]::Match([string]$line, 'https://[A-Za-z0-9.-]+\.vercel\.app')

    if ($match.Success) {
        $previewUrl = $match.Value
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "PUBLICACAO CONCLUIDA" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "Commit:"
Write-Host "  $finalCommit"
Write-Host "Branch:"
Write-Host "  $SourceBranch"
Write-Host "Backup do historico anterior:"
Write-Host "  $backupBranch"
Write-Host "Taxas:"
Write-Host "  Essencial: 3.5%"
Write-Host "  Profissional: 3.0%"
Write-Host "  Premium: 2.0%"
Write-Host "  Mercado Pago application_fee: ativa"

if ($previewUrl) {
    Write-Host "Preview:"
    Write-Host "  $previewUrl" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "ORCALY_MP_FEE_PUBLISH_OK=1" -ForegroundColor Green
Write-Host "HARDENING_NOT_PUBLISHED=1" -ForegroundColor Green
Write-Host "PRODUCTION_NOT_REPLACED=1" -ForegroundColor Yellow
