param(
    [switch]$Push
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\arauj\grafica-flash"
$Branch = "fix/unify-payment-flows-phase-1"
$Checkout = "lib/payments/checkout-service.ts"
$PlanConfig = "lib/plans/plan-config.ts"

Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($Candidate in @("$Name.cmd", "$Name.exe", $Name)) {
        $Command = Get-Command $Candidate -ErrorAction SilentlyContinue
        if ($Command) { return $Command.Source }
    }
    throw "Command not found: $Name"
}

function Run([string]$FilePath, [string[]]$Arguments) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

Step "Validating branch and current fee change"

$CurrentBranch = (& $Git branch --show-current).Trim()
if ($CurrentBranch -ne $Branch) {
    throw "Wrong branch. Expected '$Branch', current '$CurrentBranch'."
}

Run $Git @("fetch", "origin", $Branch)

$CheckoutText = [System.IO.File]::ReadAllText((Join-Path $Root $Checkout))
$PlanText = [System.IO.File]::ReadAllText((Join-Path $Root $PlanConfig))

if ($CheckoutText -match 'platformFeeEnabled\s*=\s*false') {
    throw "Marketplace fee is still disabled."
}

if ($CheckoutText -notmatch 'const\s+feePercent\s*=\s*plan\.marketplaceFeePercent\s*;') {
    throw "Checkout is not using plan.marketplaceFeePercent."
}

if ($CheckoutText -notmatch 'total\s*\*\s*\(\s*feePercent\s*/\s*100\s*\)') {
    throw "Commission calculation does not use total * (feePercent / 100)."
}

if ($CheckoutText -notmatch 'paymentPayload\.application_fee\s*=\s*calculation\.commissionAmount\s*;') {
    throw "Mercado Pago application_fee assignment is missing."
}

$Rates = @(
    @("Essencial", 'essencial:\s*\{[^}]*marketplaceFeePercent:\s*3\.5\b'),
    @("Profissional", 'profissional:\s*\{[^}]*marketplaceFeePercent:\s*3\b'),
    @("Premium", 'premium:\s*\{[^}]*marketplaceFeePercent:\s*2\b')
)

foreach ($Rate in $Rates) {
    if ($PlanText -notmatch $Rate[1]) {
        throw "Unexpected marketplace fee for $($Rate[0])."
    }
    Write-Host "[OK] $($Rate[0])" -ForegroundColor Green
}

Write-Host "[OK] feePercent = plan.marketplaceFeePercent" -ForegroundColor Green
Write-Host "[OK] commission = total * (feePercent / 100)" -ForegroundColor Green
Write-Host "[OK] Mercado Pago application_fee is populated" -ForegroundColor Green

Step "Checking working tree scope"

$TrackedChanges = @(& $Git diff --name-only)
$Unexpected = @(
    $TrackedChanges |
    Where-Object { $_ -and $_ -ne $Checkout }
)

if ($Unexpected.Count -gt 0) {
    Write-Host "Unexpected tracked changes:" -ForegroundColor Red
    $Unexpected | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    throw "Refusing to mix unrelated changes with marketplace fee reactivation."
}

if ($TrackedChanges -notcontains $Checkout) {
    Write-Host "Checkout file has no unstaged diff. It may already be committed." -ForegroundColor Yellow
}

Step "Targeted ESLint"
Run $Npx @("eslint", $Checkout, $PlanConfig)

Step "Payment verification"
Run $Npm @("run", "verify:payments")
Run $Npm @("run", "verify:payment-credentials")

Step "Production build"
Run $Npm @("run", "build")

Step "Diff validation"
Run $Git @("diff", "--check", "--", $Checkout)

$AheadBefore = @(& $Git log "origin/$Branch..HEAD" --format="%H`t%s")
Write-Host ""
Write-Host "Commits already ahead of origin BEFORE fee commit: $($AheadBefore.Count)" -ForegroundColor Yellow

if ($AheadBefore.Count -gt 0) {
    foreach ($Entry in $AheadBefore) {
        Write-Host "  $Entry" -ForegroundColor Yellow
    }
}

Step "Creating isolated marketplace fee commit if needed"

$HasCheckoutDiff = @(& $Git diff --name-only -- $Checkout).Count -gt 0

if ($HasCheckoutDiff) {
    Run $Git @("add", "--", $Checkout)
    Run $Git @("diff", "--cached", "--check", "--", $Checkout)

    Run $Git @(
        "commit",
        "-m",
        "Reativa taxas do marketplace Mercado Pago",
        "--",
        $Checkout
    )

    Write-Host "ORCALY_MP_FEE_COMMIT_CREATED=1" -ForegroundColor Green
}
else {
    Write-Host "ORCALY_MP_FEE_COMMIT_ALREADY_PRESENT=1" -ForegroundColor Yellow
}

Step "Reviewing commits that would be pushed"

$AheadAfter = @(& $Git log "origin/$Branch..HEAD" --format="%H`t%s")

if ($AheadAfter.Count -eq 0) {
    Write-Host "Nothing to push."
}
else {
    foreach ($Entry in $AheadAfter) {
        Write-Host "  $Entry" -ForegroundColor Cyan
    }
}

# Never auto-push when commits existed ahead of origin before this operation.
# That prevents publishing an unrelated local commit by accident.
if ($AheadBefore.Count -gt 0) {
    Write-Host ""
    Write-Host "PUSH_BLOCKED_PREEXISTING_AHEAD_COMMITS=1" -ForegroundColor Yellow
    Write-Host "The fee commit is safe, but there was already local history not present on origin." -ForegroundColor Yellow
    Write-Host "No push was performed." -ForegroundColor Yellow
}
elseif ($Push) {
    Step "Pushing marketplace fee commit"
    Run $Git @("push", "origin", $Branch)
    Write-Host "ORCALY_MP_FEE_PUSH_OK=1" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "PUSH_NOT_REQUESTED=1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ORCALY_MP_MARKETPLACE_FEES_VALIDATED=1" -ForegroundColor Green
Write-Host "ESSENCIAL_FEE_PERCENT=3.5" -ForegroundColor Green
Write-Host "PROFISSIONAL_FEE_PERCENT=3.0" -ForegroundColor Green
Write-Host "PREMIUM_FEE_PERCENT=2.0" -ForegroundColor Green
Write-Host "APPLICATION_FEE_ACTIVE=1" -ForegroundColor Green
Write-Host "HARDENING_STASH_PRESERVED=1" -ForegroundColor Green
