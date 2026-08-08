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

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 na raiz de C:\Users\arauj\grafica-flash."
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
$backupRoot = Join-Path $Root ".orcaly-backups\strict-payments-v2-$stamp"

Step "Criando backup"
foreach ($relative in $targets) {
    $source = Join-Path $Root $relative
    $destination = Join-Path $backupRoot $relative
    $dir = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}
Write-Host "Backup: $backupRoot"

Step "Cancelando Pix Profissional pendente com as credenciais Production"

$cancelScript = @'
const paymentId = process.argv[2];
const planPaymentId = process.argv[3];

function cleanToken(value) {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail =
      body && typeof body === "object"
        ? body.message || body.error || JSON.stringify(body)
        : String(body || "");

    throw new Error(
      `HTTP ${response.status} em ${url}: ${detail}`,
    );
  }

  return body;
}

async function main() {
  const mpToken = cleanToken(
    process.env.MP_SUBSCRIPTION_ACCESS_TOKEN,
  );
  const supabaseUrl = String(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  ).trim().replace(/\/$/, "");
  const serviceRole = cleanToken(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!mpToken) {
    throw new Error(
      "MP_SUBSCRIPTION_ACCESS_TOKEN ausente em Production.",
    );
  }

  if (!supabaseUrl || !serviceRole) {
    throw new Error(
      "Supabase Production não está configurado para este comando.",
    );
  }

  const mpHeaders = {
    Authorization: `Bearer ${mpToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const paymentUrl =
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`;

  const payment = await requestJson(paymentUrl, {
    headers: mpHeaders,
  });

  const status = String(payment?.status || "").toLowerCase();

  console.log(`Status remoto do Pix antigo: ${status}`);

  let finalStatus = status;

  if (["pending", "in_process", "authorized"].includes(status)) {
    const cancelled = await requestJson(paymentUrl, {
      method: "PUT",
      headers: mpHeaders,
      body: JSON.stringify({ status: "cancelled" }),
    });

    finalStatus = String(
      cancelled?.status || "cancelled",
    ).toLowerCase();

    console.log(
      `[OK] Pix antigo cancelado no Mercado Pago: ${finalStatus}`,
    );
  } else if (
    ["cancelled", "canceled", "expired"].includes(status)
  ) {
    console.log("[OK] Pix antigo já estava cancelado/expirado.");
  } else if (status === "approved") {
    throw new Error(
      "O Pix Profissional antigo já foi aprovado. O script não alterou esse pagamento.",
    );
  } else {
    console.log(
      `[AVISO] Status remoto inesperado: ${status || "(vazio)"}`,
    );
  }

  const now = new Date().toISOString();

  const supabaseHeaders = {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    Prefer: "return=representation",
    "Content-Type": "application/json",
  };

  const rows = await requestJson(
    `${supabaseUrl}/rest/v1/plan_payments?id=eq.${encodeURIComponent(planPaymentId)}`,
    {
      method: "PATCH",
      headers: supabaseHeaders,
      body: JSON.stringify({
        status: ["cancelled", "canceled", "expired"].includes(finalStatus)
          ? "canceled"
          : finalStatus || "canceled",
        cancelled_at: now,
        updated_at: now,
      }),
    },
  );

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error(
      "O plan_payment antigo não foi atualizado de forma inequívoca.",
    );
  }

  console.log(
    "[OK] plan_payment Profissional antigo neutralizado no Supabase.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
'@

$tempCancelJs = Join-Path $env:TEMP "orcaly-cancel-stale-subscription-$([guid]::NewGuid().ToString('N')).cjs"

try {
    [System.IO.File]::WriteAllText(
        $tempCancelJs,
        $cancelScript,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Run $Vercel @(
        "env", "run",
        "-e", "production",
        "--",
        $Node,
        $tempCancelJs,
        $StaleMercadoPagoPaymentId,
        $StalePlanPaymentId
    )
}
finally {
    Remove-Item -LiteralPath $tempCancelJs -Force -ErrorAction SilentlyContinue
}

Step "Aplicando correção estrutural de plano e split"

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

// A) Plano ativo: cobrança pendente nunca mais troca o plano.
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
  const file = "lib/subscription-mercado-pago-transparent.ts";

  replaceOnce(
    file,
`  const internalStatus = "pendente";
  const now = new Date().toISOString();`,
`  const internalStatus =
    text(company.assinatura_status) || "pendente";
  const now = new Date().toISOString();`,
    "checkout recorrente preserva status atual",
  );

  replaceOnce(
    file,
`  const companyUpdate: JsonRecord = {
    plano: planKey,
    assinatura_plano: planKey,
    assinatura_status: internalStatus,`,
`  const companyUpdate: JsonRecord = {
    assinatura_status: internalStatus,`,
    "checkout recorrente não troca plano antes de pagar",
  );
}

// B) Split estrito no retorno imediato.
{
  const file = "lib/payments/checkout-service.ts";

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
          text(charge.name).toLowerCase() === "third_payment" &&
          text(accounts.to).toLowerCase() === "marketplace_owner" &&
          text(accounts.from).toLowerCase() === "collector"
        );
      })
      .reduce((sum, charge) => {
        const amounts = asRecord(charge.amounts);

        return (
          sum +
          Math.max(0, Number(amounts.original || 0))
        );
      }, 0),
  );
  const platformFeeAmount = money(
    Math.max(
      applicationFeeFromFees,
      applicationFeeFromCharges,
    ),
  );`,
    "validar taxa também por charges_details",
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
    "comparar taxa efetiva com comissão esperada",
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
    "não liquidar estoque sem split confirmado",
  );

  replaceOnce(
    file,
`        provider_status:
          remoteStatus || null,
        status: mappedStatus,`,
`        provider_status:
          remoteStatus || null,
        status: effectiveStatus,`,
    "marketplace_payment usa status efetivo",
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
    "registrar split ausente",
  );

  replaceOnce(
    file,
`        paid_at: paidAt,`,
`        paid_at: effectivePaidAt,`,
    "marketplace_payment só recebe paid_at com split",
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
    "pedido exige split confirmado",
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
    "cupom e comissão só confirmam com split",
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
    "retorno do checkout respeita split",
  );
}

// C) Split estrito no webhook.
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
    "webhook valida taxa por fee e charge",
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
          status: mappedStatus,`,
`          provider_status: String(mpPayment.status || '') || null,
          status: effectiveStatus,`,
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
    "webhook grava divergência financeira",
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
    "webhook pedido exige split",
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
    "webhook só confirma comissão com split",
  );
}

console.log("\nSTRICT_PAYMENT_PATCH_V2_OK=1");
'@

$tempPatchJs = Join-Path $env:TEMP "orcaly-strict-payments-v2-$([guid]::NewGuid().ToString('N')).cjs"

try {
    [System.IO.File]::WriteAllText(
        $tempPatchJs,
        $patcher,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Run $Node @($tempPatchJs)
}
finally {
    Remove-Item -LiteralPath $tempPatchJs -Force -ErrorAction SilentlyContinue
}

Step "Validando isolamento e contratos"
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

Step "Build"
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
Write-Host "Tudo concluído." -ForegroundColor Green
Write-Host "O plano ativo só muda após aprovação e pedidos sem split confirmado não são liberados." -ForegroundColor Green
Write-Host "Depois do push, o novo Preview precisa ser promovido para Production." -ForegroundColor Cyan
