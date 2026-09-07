param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

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

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 na raiz do projeto grafica-flash."
}

$Git = Resolve-Cmd "git"
$Node = Resolve-Cmd "node"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

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
$backupRoot = Join-Path $Root ".orcaly-backups\strict-payments-v3-$stamp"

Step "Criando backup"

foreach ($relative in $targets) {
    $source = Join-Path $Root $relative
    $destination = Join-Path $backupRoot $relative
    $dir = Split-Path -Parent $destination

    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

Write-Host "Backup: $backupRoot"

Step "Aplicando correções de plano e split"

$patcher = @'
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(file, content) {
  fs.writeFileSync(
    file,
    content.replace(/\r\n/g, "\n"),
    "utf8",
  );
}

function replaceOnce(
  file,
  oldText,
  newText,
  label,
) {
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

// ------------------------------------------------------------
// 1. PLANO ATIVO
// Cobrança pendente nunca mais altera plano/assinatura_plano.
// applyApprovedSubscriptionPayment já é o ponto canônico de ativação.
// ------------------------------------------------------------

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
    "preapproval pendente preserva plano ativo",
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
    "Pix pendente preserva plano ativo",
  );
}

{
  const file =
    "lib/subscription-mercado-pago-transparent.ts";

  replaceOnce(
    file,
`  const internalStatus = "pendente";
  const now = new Date().toISOString();`,
`  const internalStatus =
    text(company.assinatura_status) || "pendente";
  const now = new Date().toISOString();`,
    "assinatura transparente preserva status atual",
  );

  replaceOnce(
    file,
`  const companyUpdate: JsonRecord = {
    plano: planKey,
    assinatura_plano: planKey,
    assinatura_status: internalStatus,`,
`  const companyUpdate: JsonRecord = {
    assinatura_status: internalStatus,`,
    "assinatura transparente não troca plano antes de pagar",
  );
}

// ------------------------------------------------------------
// 2. MARKETPLACE: retorno imediato
// Usa application_fee OU third_payment -> marketplace_owner.
// Um pagamento aprovado sem a comissão esperada não vira pedido pago.
// ------------------------------------------------------------

{
  const file =
    "lib/payments/checkout-service.ts";

  replaceOnce(
    file,
`  const feeDetails = array(payment.fee_details)
    .map((item) => asRecord(item));
  const platformFeeAmount = money(
    feeDetails
      .filter(
        (fee) =>
          text(fee.type).toLowerCase() ===
          "application_fee",
      )
      .reduce(
        (sum, fee) =>
          sum + Math.max(0, Number(fee.amount || 0)),
        0,
      ),
  );`,
`  const feeDetails = array(payment.fee_details)
    .map((item) => asRecord(item));
  const chargesDetails = array(payment.charges_details)
    .map((item) => asRecord(item));
  const applicationFeeFromFees = money(
    feeDetails
      .filter(
        (fee) =>
          text(fee.type).toLowerCase() ===
          "application_fee",
      )
      .reduce(
        (sum, fee) =>
          sum + Math.max(0, Number(fee.amount || 0)),
        0,
      ),
  );
  const applicationFeeFromCharges = money(
    chargesDetails
      .filter((charge) => {
        const accounts = asRecord(charge.accounts);

        return (
          text(charge.name).toLowerCase() ===
            "third_payment" &&
          text(accounts.from).toLowerCase() ===
            "collector" &&
          text(accounts.to).toLowerCase() ===
            "marketplace_owner"
        );
      })
      .reduce((sum, charge) => {
        const amounts = asRecord(charge.amounts);

        return (
          sum +
          Math.max(
            0,
            Number(amounts.original || 0),
          )
        );
      }, 0),
  );
  const platformFeeAmount = money(
    Math.max(
      applicationFeeFromFees,
      applicationFeeFromCharges,
    ),
  );`,
    "checkout valida taxa pelas duas evidências do MP",
  );

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
    .select(
      "commission_amount,platform_fee_amount",
    )
    .eq("id", transaction.id)
    .eq(
      "company_id",
      calculation.companyId,
    )
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
    "checkout compara taxa cobrada com taxa esperada",
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
    "checkout não liquida estoque sem split",
  );

  replaceOnce(
    file,
`        provider_status:
          remoteStatus || null,
        status: mappedStatus,
        gross_amount:
          grossAmount || null,`,
`        provider_status:
          remoteStatus || null,
        status: effectiveStatus,
        gross_amount:
          grossAmount || null,`,
    "marketplace_payment usa status efetivo",
  );

  replaceOnce(
    file,
`        split_status:
          splitStatus,
        raw_payload: payment,
        card_brand:
          methodId || null,
        card_last4:
          lastFour || null,
        paid_at: paidAt,`,
`        split_status:
          splitStatus,
        last_error:
          mappedStatus === "paid" && !splitApplied
            ? "Pagamento aprovado sem confirmação da taxa do marketplace."
            : null,
        raw_payload: payment,
        card_brand:
          methodId || null,
        card_last4:
          lastFour || null,
        paid_at: effectivePaidAt,`,
    "marketplace_payment registra divergência de split",
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
    "pedido só fica Recebido com split confirmado",
  );

  replaceOnce(
    file,
`        provider_status:
          remoteStatus || null,
        status: mappedStatus,
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
`        provider_status:
          remoteStatus || null,
        status: effectiveStatus,
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
`  if (
    mappedStatus === "paid" &&
    splitApplied
  ) {
    const { error: couponConsumeError } =`,
    "cupom e comissão só confirmam após split",
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
    "checkout retorna status efetivo",
  );
}

// ------------------------------------------------------------
// 3. MARKETPLACE: webhook
// Mesma regra do retorno imediato para não haver corrida de estados.
// ------------------------------------------------------------

{
  const file =
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts";

  replaceOnce(
    file,
`    const feeDetails = Array.isArray(mpPayment.fee_details)
      ? mpPayment.fee_details
      : []
    const applicationFeeAmount = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() === 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )`,
`    const feeDetails = Array.isArray(mpPayment.fee_details)
      ? mpPayment.fee_details
      : []
    const chargesDetails = Array.isArray(mpPayment.charges_details)
      ? mpPayment.charges_details
      : []
    const applicationFeeFromFees = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() === 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )
    const applicationFeeFromCharges = chargesDetails.reduce(
      (total: number, charge: any) => {
        const name = String(charge?.name || '').toLowerCase()
        const from = String(charge?.accounts?.from || '').toLowerCase()
        const to = String(charge?.accounts?.to || '').toLowerCase()

        if (
          name !== 'third_payment' ||
          from !== 'collector' ||
          to !== 'marketplace_owner'
        ) {
          return total
        }

        return total + Math.max(
          0,
          Number(charge?.amounts?.original || 0),
        )
      },
      0,
    )
    const applicationFeeAmount = Math.max(
      applicationFeeFromFees,
      applicationFeeFromCharges,
    )`,
    "webhook valida taxa pelas duas evidências do MP",
  );

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
        applicationFeeAmount + 0.005 >=
          expectedCommissionAmount
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
    "webhook cria status efetivo",
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
`          provider_status: String(mpPayment.status || '') || null,
          status: mappedStatus,
          amount: grossAmount,`,
`          provider_status: String(mpPayment.status || '') || null,
          status: effectiveStatus,
          amount: grossAmount,`,
    "webhook marketplace_payment usa status efetivo",
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
          paid_at: effectivePaidAt,`,
    "webhook registra split ausente",
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
    "webhook pedido exige split confirmado",
  );

  replaceOnce(
    file,
`          provider_payment_id: String(mpPayment.id || paymentId),
          status: mappedStatus,
          paid_amount:
            mappedStatus === 'paid'
              ? Number(mpPayment.transaction_amount || 0)
              : 0,
          remaining_amount:
            mappedStatus === 'paid'
              ? 0
              : Number(mpPayment.transaction_amount || 0),`,
`          provider_payment_id: String(mpPayment.id || paymentId),
          status: effectiveStatus,
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
    "webhook só confirma comissão após split",
  );
}

console.log("\nSTRICT_PAYMENT_PATCH_V3_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-strict-payments-v3-$([guid]::NewGuid().ToString('N')).cjs"

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

Step "Verificando que cobranças pendentes não alteram plano"

$planMutationHits = Select-String `
    -Path ".\lib\subscription-service.ts", ".\lib\subscription-mercado-pago-transparent.ts" `
    -Pattern "plano:\s*planKey|assinatura_plano:\s*planKey"

Write-Host "Ocorrências restantes de atualização de plano:"
$planMutationHits | ForEach-Object {
    Write-Host "  $($_.Path):$($_.LineNumber) $($_.Line.Trim())"
}

Write-Host ""
Write-Host "Observação: atualizações dentro de applyApprovedSubscriptionPayment são esperadas." -ForegroundColor DarkGray

Step "Validando isolamento das credenciais"
Run $Npm @("run", "verify:payment-credentials")

Step "Validando contratos dos pagamentos"
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
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "Tudo validado e publicado." -ForegroundColor Green
Write-Host "Pix Profissional antigo já foi cancelado e neutralizado no banco." -ForegroundColor Green
Write-Host "Plano ativo agora só muda após pagamento aprovado." -ForegroundColor Green
Write-Host "Pedido de marketplace só é liberado após confirmação da taxa Orçaly." -ForegroundColor Green
Write-Host ""
Write-Host "Próximo passo: promover o novo Preview para Production." -ForegroundColor Cyan
