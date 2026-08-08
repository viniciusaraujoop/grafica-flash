param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

$CompanyId = "f5cd0793-f016-4e64-9b5f-3e650b1795ce"
$StalePlanPaymentId = "42d08338-6389-4e7d-9f4b-ab96b15e68dd"
$StaleMercadoPagoPaymentId = "172640300278"

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

function Get-DotEnvValue([string]$Path, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ""
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*$([Regex]::Escape($Name))=(.*)$") {
            $value = $Matches[1].Trim()

            if (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }

            return $value
        }
    }

    return ""
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 na raiz do projeto grafica-flash."
}

$Git = Resolve-Cmd "git"
$Node = Resolve-Cmd "node"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"
$Vercel = Resolve-Cmd "vercel"

$branch = (& $Git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or -not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Branch atual"
Write-Host $branch

$targets = @(
    "lib/subscription-service.ts",
    "lib/subscription-mercado-pago-transparent.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts"
)

foreach ($file in $targets) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo não encontrado: $file"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $Root ".orcaly-backups\strict-payments-$stamp"

Step "Criando backup local"
foreach ($relative in $targets) {
    $source = Join-Path $Root $relative
    $destination = Join-Path $backupRoot $relative
    $dir = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}
Write-Host "Backup: $backupRoot"

Step "Cancelando o Pix Profissional pendente de hoje"

$vercelEnvFile = Join-Path $Root ".vercel\.env.production.local"
$vercelEnvBackup = $null

if (Test-Path -LiteralPath $vercelEnvFile -PathType Leaf) {
    $vercelEnvBackup = "$vercelEnvFile.orcaly-backup-$stamp"
    Copy-Item -LiteralPath $vercelEnvFile -Destination $vercelEnvBackup -Force
}

try {
    # Não sobrescreve .env.local. O Vercel usa o arquivo interno da pasta .vercel.
    Run $Vercel @("pull", "--environment=production", "--yes")

    $subscriptionToken = Get-DotEnvValue $vercelEnvFile "MP_SUBSCRIPTION_ACCESS_TOKEN"
    $supabaseUrl = Get-DotEnvValue $vercelEnvFile "NEXT_PUBLIC_SUPABASE_URL"
    $serviceRole = Get-DotEnvValue $vercelEnvFile "SUPABASE_SERVICE_ROLE_KEY"

    if (-not $subscriptionToken) {
        throw "MP_SUBSCRIPTION_ACCESS_TOKEN não foi encontrado no ambiente production."
    }

    if (-not $supabaseUrl -or -not $serviceRole) {
        throw "Credenciais do Supabase não foram encontradas no ambiente production."
    }

    $mpHeaders = @{
        Authorization = "Bearer $subscriptionToken"
        Accept = "application/json"
        "Content-Type" = "application/json"
    }

    $paymentUrl = "https://api.mercadopago.com/v1/payments/$StaleMercadoPagoPaymentId"
    $remotePayment = Invoke-RestMethod `
        -Method Get `
        -Uri $paymentUrl `
        -Headers $mpHeaders

    $remoteStatus = [string]$remotePayment.status
    Write-Host "Status remoto atual: $remoteStatus"

    if ($remoteStatus -in @("pending", "in_process", "authorized")) {
        $cancelled = Invoke-RestMethod `
            -Method Put `
            -Uri $paymentUrl `
            -Headers $mpHeaders `
            -Body '{"status":"cancelled"}'

        Write-Host "  [OK] Pix antigo cancelado no Mercado Pago: $($cancelled.status)" -ForegroundColor Green
    }
    elseif ($remoteStatus -in @("cancelled", "canceled", "expired")) {
        Write-Host "  [OK] Pix antigo já estava cancelado/expirado." -ForegroundColor Green
    }
    elseif ($remoteStatus -eq "approved") {
        throw "O Pix Profissional antigo já foi aprovado. Não é seguro cancelá-lo automaticamente."
    }
    else {
        Write-Host "  [AVISO] Status remoto inesperado: $remoteStatus" -ForegroundColor Yellow
    }

    $nowIso = (Get-Date).ToUniversalTime().ToString("o")
    $supabaseHeaders = @{
        apikey = $serviceRole
        Authorization = "Bearer $serviceRole"
        Prefer = "return=representation"
        "Content-Type" = "application/json"
    }

    $patchBody = @{
        status = "canceled"
        cancelled_at = $nowIso
        updated_at = $nowIso
    } | ConvertTo-Json -Compress

    $null = Invoke-RestMethod `
        -Method Patch `
        -Uri "$($supabaseUrl.TrimEnd('/'))/rest/v1/plan_payments?id=eq.$StalePlanPaymentId" `
        -Headers $supabaseHeaders `
        -Body $patchBody

    Write-Host "  [OK] plan_payment Profissional antigo neutralizado no Supabase" -ForegroundColor Green
}
finally {
    # Evita deixar uma cópia nova das variáveis de produção por causa deste script.
    if ($vercelEnvBackup -and (Test-Path -LiteralPath $vercelEnvBackup)) {
        Copy-Item -LiteralPath $vercelEnvBackup -Destination $vercelEnvFile -Force
        Remove-Item -LiteralPath $vercelEnvBackup -Force
    }
    elseif (Test-Path -LiteralPath $vercelEnvFile) {
        Remove-Item -LiteralPath $vercelEnvFile -Force
    }

    $subscriptionToken = $null
    $serviceRole = $null
    [GC]::Collect()
}

Step "Corrigindo plano ativo e validação estrita do split"

$patcher = @'
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(file, content) {
  fs.writeFileSync(file, content.replace(/\r\n/g, "\n"), "utf8");
}

function replaceOnce(file, oldText, newText, label) {
  let content = read(file);

  if (content.includes(newText)) {
    console.log(`[OK] ${label} já aplicado`);
    return;
  }

  const count = content.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `${file}: esperado 1 trecho para "${label}", encontrado ${count}.`,
    );
  }

  content = content.replace(oldText, newText);
  write(file, content);
  console.log(`[OK] ${label}`);
}

// 1) Nunca trocar o plano ativo ao apenas criar uma cobrança.
{
  const file = "lib/subscription-service.ts";

  replaceOnce(
    file,
`  const internalStatus = "pendente";
  const { data: updatedCompany, error: companyError } = await admin
    .from("companies")
    .update({
      plano: planKey,
      assinatura_plano: planKey,
      assinatura_status: internalStatus,`,
`  const internalStatus =
    company.assinatura_status || "pendente";
  const { data: updatedCompany, error: companyError } = await admin
    .from("companies")
    .update({
      assinatura_status: internalStatus,`,
    "assinatura recorrente pendente não troca plano ativo",
  );

  replaceOnce(
    file,
`  await admin
    .from("companies")
    .update({
      plano: planKey,
      assinatura_plano: planKey,
      assinatura_forma_pagamento_preferida: "pix_avulso",`,
`  await admin
    .from("companies")
    .update({
      assinatura_forma_pagamento_preferida: "pix_avulso",`,
    "Pix pendente não troca plano ativo",
  );
}

// 2) Checkout transparente recorrente também não altera plano antes do pagamento.
{
  const file = "lib/subscription-mercado-pago-transparent.ts";

  replaceOnce(
    file,
`  const internalStatus = "pendente";
  const now = new Date().toISOString();`,
`  const internalStatus =
    text(company.assinatura_status) || "pendente";
  const now = new Date().toISOString();`,
    "preservar status ativo durante nova assinatura",
  );

  replaceOnce(
    file,
`  const companyUpdate: JsonRecord = {
    plano: planKey,
    assinatura_plano: planKey,
    assinatura_status: internalStatus,`,
`  const companyUpdate: JsonRecord = {
    assinatura_status: internalStatus,`,
    "checkout recorrente pendente não troca plano",
  );
}

// 3) Split estrito no retorno imediato do marketplace.
{
  const file = "lib/payments/checkout-service.ts";

  replaceOnce(
    file,
`  const grossAmount = money(
    payment.transaction_amount,
  );
  const sellerNetAmount =`,
`  const grossAmount = money(
    payment.transaction_amount,
  );
  const {
    data: splitExpectation,
    error: splitExpectationError,
  } = await calculation.supabase
    .from("marketplace_payments")
    .select("commission_amount,platform_fee_amount")
    .eq("id", transaction.id)
    .eq("company_id", calculation.companyId)
    .maybeSingle();

  if (splitExpectationError) {
    throw splitExpectationError;
  }

  const expectedPlatformFee = money(
    splitExpectation?.commission_amount ||
      splitExpectation?.platform_fee_amount ||
      0,
  );
  const splitApplied =
    mappedStatus !== "paid" ||
    expectedPlatformFee <= 0 ||
    (
      platformFeeAmount > 0 &&
      platformFeeAmount + 0.005 >=
        expectedPlatformFee
    );
  const effectiveStatus =
    mappedStatus === "paid" && !splitApplied
      ? "pending"
      : mappedStatus;
  const effectivePaidAt =
    effectiveStatus === "paid"
      ? paidAt
      : null;
  const sellerNetAmount =`,
    "carregar comissão esperada para validar split",
  );

  replaceOnce(
    file,
`  const splitStatus =
    mappedStatus === "paid"
      ? platformFeeAmount > 0
        ? "applied"
        : "missing"
      : "pending";

  await settleMarketplaceStock(
    calculation.supabase,
    calculation.companyId,
    transaction.id,
    mappedStatus,
    remoteStatus || mappedStatus,
  );`,
`  const splitStatus =
    mappedStatus === "paid"
      ? splitApplied
        ? "applied"
        : "missing"
      : "pending";

  await settleMarketplaceStock(
    calculation.supabase,
    calculation.companyId,
    transaction.id,
    effectiveStatus,
    splitApplied
      ? remoteStatus || effectiveStatus
      : "payment_paid_without_confirmed_application_fee",
  );`,
    "não liquidar pedido sem application_fee confirmada",
  );

  replaceOnce(
    file,
`        split_status:
          splitStatus,
        raw_payload: payment,`,
`        split_status:
          splitStatus,
        last_error:
          mappedStatus === "paid" && !splitApplied
            ? "Pagamento aprovado sem confirmação da taxa do marketplace."
            : null,
        raw_payload: payment,`,
    "registrar falha de split",
  );

  replaceOnce(
    file,
`        payment_status:
          mappedStatus,
        status:
          mappedStatus === "paid"
            ? "Recebido"
            : "pending_payment",
        paid_at: paidAt,`,
`        payment_status:
          effectiveStatus,
        status:
          effectiveStatus === "paid"
            ? "Recebido"
            : "pending_payment",
        paid_at: effectivePaidAt,`,
    "pedido só fica pago com split aplicado",
  );

  replaceOnce(
    file,
`        status: mappedStatus,
        paid_amount:
          mappedStatus === "paid"
            ? Number(
                payment.transaction_amount ||
                  0,
              )
            : 0,
        remaining_amount:
          mappedStatus === "paid"
            ? 0
            : Number(
                payment.transaction_amount ||
                  0,
              ),
        paid_at: paidAt,`,
`        status: effectiveStatus,
        paid_amount:
          effectiveStatus === "paid"
            ? Number(
                payment.transaction_amount ||
                  0,
              )
            : 0,
        remaining_amount:
          effectiveStatus === "paid"
            ? 0
            : Number(
                payment.transaction_amount ||
                  0,
              ),
        paid_at: effectivePaidAt,`,
    "order_payments exige split confirmado",
  );

  replaceOnce(
    file,
`  if (mappedStatus === "paid") {
    const { error: couponConsumeError } =`,
`  if (mappedStatus === "paid" && splitApplied) {
    const { error: couponConsumeError } =`,
    "comissão e cupom só confirmam com split aplicado",
  );

  replaceOnce(
    file,
`  return {
    mappedStatus,
    remoteStatus,
    paidAt,
  };`,
`  return {
    mappedStatus: effectiveStatus,
    remoteStatus,
    paidAt: effectivePaidAt,
  };`,
    "frontend recebe status pendente se split não foi confirmado",
  );
}

// 4) Mesma trava no webhook do marketplace.
{
  const file =
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts";

  replaceOnce(
    file,
`    const splitStatus =
      mappedStatus === 'paid'
        ? applicationFeeAmount + 0.005 >= expectedCommissionAmount &&
          applicationFeeAmount > 0
          ? 'applied'
          : 'missing'
        : 'pending'

    const { error: stockError } = await supabaseAdmin.rpc(`,
`    const splitApplied =
      mappedStatus !== 'paid' ||
      expectedCommissionAmount <= 0 ||
      (
        applicationFeeAmount > 0 &&
        applicationFeeAmount + 0.005 >= expectedCommissionAmount
      )
    const splitStatus =
      mappedStatus === 'paid'
        ? splitApplied
          ? 'applied'
          : 'missing'
        : 'pending'
    const effectiveStatus =
      mappedStatus === 'paid' && !splitApplied
        ? 'pending'
        : mappedStatus
    const effectivePaidAt =
      effectiveStatus === 'paid'
        ? paidAt
        : null

    const { error: stockError } = await supabaseAdmin.rpc(`,
    "webhook calcula status efetivo do split",
  );

  replaceOnce(
    file,
`        p_payment_status: mappedStatus,
        p_reason: String(mpPayment.status || mappedStatus),`,
`        p_payment_status: effectiveStatus,
        p_reason: splitApplied
          ? String(mpPayment.status || effectiveStatus)
          : 'payment_paid_without_confirmed_application_fee',`,
    "webhook não liquida estoque sem split",
  );

  replaceOnce(
    file,
`          split_status: splitStatus,
          raw_payload: mpPayment,
          paid_at: paidAt,`,
`          split_status: splitStatus,
          last_error:
            mappedStatus === 'paid' && !splitApplied
              ? 'Pagamento aprovado sem confirmação da taxa do marketplace.'
              : null,
          raw_payload: mpPayment,
          paid_at: paidAt,`,
    "webhook registra divergência do split",
  );

  replaceOnce(
    file,
`          payment_status: mappedStatus,
          status:
            mappedStatus === 'paid'
              ? 'Recebido'
              : 'pending_payment',
          paid_at: paidAt,`,
`          payment_status: effectiveStatus,
          status:
            effectiveStatus === 'paid'
              ? 'Recebido'
              : 'pending_payment',
          paid_at: effectivePaidAt,`,
    "webhook só libera pedido com split",
  );

  replaceOnce(
    file,
`          status: mappedStatus,
          paid_amount:
            mappedStatus === 'paid'
              ? Number(mpPayment.transaction_amount || 0)
              : 0,
          remaining_amount:
            mappedStatus === 'paid'
              ? 0
              : Number(mpPayment.transaction_amount || 0),`,
`          status: effectiveStatus,
          paid_amount:
            effectiveStatus === 'paid'
              ? Number(mpPayment.transaction_amount || 0)
              : 0,
          remaining_amount:
            effectiveStatus === 'paid'
              ? 0
              : Number(mpPayment.transaction_amount || 0),`,
    "webhook order_payments exige split",
  );

  replaceOnce(
    file,
`    if (mappedStatus === 'paid') {
      const { error: couponError } =`,
`    if (mappedStatus === 'paid' && splitApplied) {
      const { error: couponError } =`,
    "webhook só confirma comissão com application_fee",
  );
}

console.log("\nSTRICT_PAYMENT_PATCH_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-strict-payments-$([guid]::NewGuid().ToString('N')).cjs"

try {
    [System.IO.File]::WriteAllText(
        $tempJs,
        $patcher,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Run $Node @($tempJs)
}
finally {
    Remove-Item -LiteralPath $tempJs -Force -ErrorAction SilentlyContinue
}

Step "Validando regras de pagamento"
Run $Npm @("run", "verify:payment-credentials")
Run $Npm @("run", "verify:payments")

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/subscription-service.ts",
    "lib/subscription-mercado-pago-transparent.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts"
)

Step "Build completo"
Run $Npm @("run", "build")

Step "Verificando diff"
Run $Git @("diff", "--check")
& $Git diff --stat
& $Git status --short

Step "Criando commit"

Run $Git (@("add", "--") + $targets)
Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Run $Git @(
        "commit",
        "-m",
        "Corrige plano ativo e exige split confirmado"
    )

    $hash = (& $Git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Enviando branch ao GitHub"
    Run $Git @("push", "-u", "origin", $branch)
}

Write-Host ""
Write-Host "Correção concluída." -ForegroundColor Green
Write-Host "Plano ativo agora só muda após pagamento aprovado." -ForegroundColor Green
Write-Host "Marketplace agora não libera pedido pago sem confirmar application_fee." -ForegroundColor Green
Write-Host ""
Write-Host "Após o push, será necessário promover o novo Preview para produção." -ForegroundColor Cyan
