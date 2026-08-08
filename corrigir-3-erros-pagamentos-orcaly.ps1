param(
    [switch]$Push
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
    $cmd = Get-Command "$Name.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este arquivo na raiz de C:\Users\arauj\grafica-flash."
}

$Git = Resolve-Cmd "git"
$Node = Resolve-Cmd "node"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$branch = (& $Git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or -not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Branch"
Write-Host $branch

$targets = @(
    "lib/plans/plan-config.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/marketplace/payments/sales/route.ts",
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx"
)

foreach ($file in $targets) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo não encontrado: $file"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $Root ".orcaly-backups\payment-fixes-$stamp"

Step "Criando backup"

foreach ($relative in $targets) {
    $source = Join-Path $Root $relative
    $destination = Join-Path $backupRoot $relative
    $dir = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

Write-Host "Backup: $backupRoot"

Step "Aplicando correções"

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

  const pieces = content.split(oldText);

  if (pieces.length !== 2) {
    throw new Error(
      `${file}: esperado exatamente 1 trecho para "${label}", encontrado ${pieces.length - 1}.`,
    );
  }

  content = pieces[0] + newText + pieces[1];
  write(file, content);
  console.log(`[OK] ${label}`);
}

function replaceRegexOnce(file, regex, replacement, label) {
  let content = read(file);

  const matches = [...content.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g"))];

  if (matches.length !== 1) {
    throw new Error(
      `${file}: esperado exatamente 1 match para "${label}", encontrado ${matches.length}.`,
    );
  }

  content = content.replace(regex, replacement);
  write(file, content);
  console.log(`[OK] ${label}`);
}

// 1. Taxas oficiais definidas pelo Orçaly
{
  const file = "lib/plans/plan-config.ts";
  let content = read(file);

  content = content
    .replace(
      'essencial: { label: "Essencial", monthlyPrice: 49.9, marketplaceFeePercent: 3 },',
      'essencial: { label: "Essencial", monthlyPrice: 49.9, marketplaceFeePercent: 3.5 },',
    )
    .replace(
      'profissional: { label: "Profissional", monthlyPrice: 99.9, marketplaceFeePercent: 2 },',
      'profissional: { label: "Profissional", monthlyPrice: 99.9, marketplaceFeePercent: 3 },',
    )
    .replace(
      'premium: { label: "Premium", monthlyPrice: 149.9, marketplaceFeePercent: 1 },',
      'premium: { label: "Premium", monthlyPrice: 149.9, marketplaceFeePercent: 2 },',
    );

  if (
    !content.includes('marketplaceFeePercent: 3.5') ||
    !content.includes('marketplaceFeePercent: 3 },') ||
    !content.includes('marketplaceFeePercent: 2 },')
  ) {
    throw new Error("Não foi possível validar as taxas 3,5% / 3% / 2%.");
  }

  write(file, content);
  console.log("[OK] taxas marketplace: Básico 3,5%, Profissional 3%, Premium 2%");
}

// 2. Conciliação do retorno imediato do Mercado Pago no checkout marketplace
{
  const file = "lib/payments/checkout-service.ts";

  replaceOnce(
    file,
`  const lastFour = text(
    card.last_four_digits,
  );

  await settleMarketplaceStock(`,
`  const lastFour = text(
    card.last_four_digits,
  );
  const feeDetails = array(payment.fee_details)
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
  );
  const providerFeeAmount = money(
    feeDetails
      .filter(
        (fee) =>
          text(fee.type).toLowerCase() !==
          "application_fee",
      )
      .reduce(
        (sum, fee) =>
          sum + Math.max(0, Number(fee.amount || 0)),
        0,
      ),
  );
  const transactionDetails =
    asRecord(payment.transaction_details);
  const reportedNetAmount = money(
    transactionDetails.net_received_amount,
  );
  const grossAmount = money(
    payment.transaction_amount,
  );
  const sellerNetAmount =
    mappedStatus === "paid"
      ? reportedNetAmount > 0
        ? reportedNetAmount
        : money(
            grossAmount -
              providerFeeAmount -
              platformFeeAmount,
          )
      : null;
  const splitStatus =
    mappedStatus === "paid"
      ? platformFeeAmount > 0
        ? "applied"
        : "missing"
      : "pending";

  await settleMarketplaceStock(`,
    "calcular taxas reais do provedor",
  );

  replaceOnce(
    file,
`        status: mappedStatus,
        raw_payload: payment,`,
`        status: mappedStatus,
        gross_amount:
          grossAmount || null,
        amount:
          grossAmount || null,
        provider_fee_amount:
          providerFeeAmount,
        provider_net_amount:
          sellerNetAmount,
        platform_fee_amount:
          platformFeeAmount,
        seller_net_amount:
          sellerNetAmount,
        split_status:
          splitStatus,
        raw_payload: payment,`,
    "persistir conciliação financeira real",
  );
}

// 3. Webhook marketplace: colunas reais + separar taxa MP da application_fee
{
  const file =
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts";

  replaceRegexOnce(
    file,
    /    const feeDetails = Array\.isArray\(mpPayment\.fee_details\)[\s\S]*?    const \{ error: stockError \} = await supabaseAdmin\.rpc\(/,
`    const feeDetails = Array.isArray(mpPayment.fee_details)
      ? mpPayment.fee_details
      : []
    const applicationFeeAmount = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() === 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )
    const providerFeeAmount = feeDetails.reduce(
      (total: number, fee: any) =>
        String(fee?.type || '').toLowerCase() !== 'application_fee'
          ? total + Math.max(0, Number(fee?.amount || 0))
          : total,
      0,
    )
    const expectedCommissionAmount = Math.max(
      0,
      Number(
        marketplacePayment.platform_fee_amount ||
          marketplacePayment.commission_amount ||
          0,
      ),
    )
    const reportedNetAmount = Number(
      mpPayment.transaction_details?.net_received_amount || 0,
    )
    const sellerNetAmount =
      reportedNetAmount > 0
        ? Number(reportedNetAmount.toFixed(2))
        : Math.max(
            0,
            Number(
              (
                grossAmount -
                providerFeeAmount -
                applicationFeeAmount
              ).toFixed(2),
            ),
          )
    const splitStatus =
      mappedStatus === 'paid'
        ? applicationFeeAmount + 0.005 >= expectedCommissionAmount &&
          applicationFeeAmount > 0
          ? 'applied'
          : 'missing'
        : 'pending'

    const { error: stockError } = await supabaseAdmin.rpc(`,
    "corrigir cálculo do webhook marketplace",
  );

  replaceOnce(
    file,
`          provider_fee_amount: Number(providerFeeAmount.toFixed(2)),
          net_amount: Number(netAmount.toFixed(2)),
          raw_payload: mpPayment,`,
`          provider_fee_amount: Number(providerFeeAmount.toFixed(2)),
          provider_net_amount: sellerNetAmount,
          platform_fee_amount: Number(applicationFeeAmount.toFixed(2)),
          seller_net_amount: sellerNetAmount,
          split_status: splitStatus,
          raw_payload: mpPayment,`,
    "usar colunas reais no webhook",
  );
}

// 4. Endpoint de vendas: net_amount não existe na produção
{
  const file =
    "app/api/marketplace/payments/sales/route.ts";

  replaceOnce(
    file,
`.select('id,order_id,provider,provider_preference_id,provider_payment_id,status,provider_status,checkout_url,sandbox_checkout_url,amount,subtotal,delivery_fee,discount_amount,commission_amount,commission_percentage,provider_fee_amount,net_amount,payer_name,payer_phone,paid_at,created_at')`,
`.select('id,order_id,provider,provider_preference_id,provider_payment_id,status,provider_status,checkout_url,sandbox_checkout_url,amount,gross_amount,subtotal,delivery_fee,discount_amount,commission_amount,commission_percentage,provider_fee_amount,provider_net_amount,platform_fee_percent,platform_fee_amount,seller_net_amount,split_status,payout_status,payer_name,payer_phone,paid_at,created_at')`,
    "corrigir consulta de vendas",
  );
}

// Helper compartilhado nos dois frontends de pagamento
const timeoutHelper = `
async function fetchWithPaymentTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30000,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (cause) {
    if (
      cause instanceof DOMException &&
      cause.name === "AbortError"
    ) {
      throw new Error(
        "O servidor de pagamentos demorou para responder. Tente novamente.",
      );
    }

    throw cause;
  } finally {
    window.clearTimeout(timer);
  }
}
`;

// 5. Cadastro: timeout e diagnóstico de Public Key / Brick
{
  const file =
    "components/checkout/SignupCheckout.tsx";

  let content = read(file);

  if (!content.includes("async function fetchWithPaymentTimeout(")) {
    const anchor =
`function paymentKind(
  selectedPaymentMethod: unknown,`;

    if (!content.includes(anchor)) {
      throw new Error(
        `${file}: não achei ponto para inserir timeout.`,
      );
    }

    content = content.replace(
      anchor,
      timeoutHelper + "\n" + anchor,
    );
  }

  content = content.replace(
    'const response = await fetch("/api/checkout/signup/pix", {',
    'const response = await fetchWithPaymentTimeout("/api/checkout/signup/pix", {',
  );
  content = content.replace(
    'const response = await fetch("/api/checkout/signup/card", {',
    'const response = await fetchWithPaymentTimeout("/api/checkout/signup/card", {',
  );

  if (!content.includes("signup_public_key_missing")) {
    const loadEffect =
`  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);
`;

    if (!content.includes(loadEffect)) {
      throw new Error(
        `${file}: não achei useEffect de loadCheckout.`,
      );
    }

    content = content.replace(
      loadEffect,
      loadEffect +
`
  useEffect(() => {
    if (checkoutOpen && !publicKey) {
      console.error("signup_public_key_missing");
      setError(
        "O checkout de cadastro ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }
  }, [checkoutOpen, publicKey]);
`,
    );
  }

  content = content.replace(
`    void renderBrick();

    return () => {`,
`    void renderBrick().catch((cause) => {
      console.error("signup_payment_brick_render_error", cause);

      if (!cancelled) {
        setBrickReady(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível iniciar o pagamento.",
        );
      }
    });

    return () => {`,
  );

  write(file, content);

  if (
    !content.includes(
      'fetchWithPaymentTimeout("/api/checkout/signup/pix"',
    ) ||
    !content.includes(
      'fetchWithPaymentTimeout("/api/checkout/signup/card"',
    )
  ) {
    throw new Error(
      `${file}: timeout dos pagamentos não foi aplicado.`,
    );
  }

  console.log("[OK] cadastro não fica mais em loading infinito");
}

// 6. Assinatura: timeout e diagnóstico de Public Key / Brick
{
  const file =
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx";

  let content = read(file);

  if (!content.includes("async function fetchWithPaymentTimeout(")) {
    const anchor =
`function money(value: number) {`;

    if (!content.includes(anchor)) {
      throw new Error(
        `${file}: não achei ponto para inserir timeout.`,
      );
    }

    content = content.replace(
      anchor,
      timeoutHelper + "\n" + anchor,
    );
  }

  content = content.replace(
`const response = await fetch(
            "/api/assinatura/mercado-pago",`,
`const response = await fetchWithPaymentTimeout(
            "/api/assinatura/mercado-pago",`,
  );

  content = content.replace(
`const response = await fetch("/api/assinatura/checkout", {`,
`const response = await fetchWithPaymentTimeout("/api/assinatura/checkout", {`,
  );

  if (!content.includes("subscription_public_key_missing")) {
    const loadEffect =
`  useEffect(() => {
    void load();
  }, [load]);
`;

    if (!content.includes(loadEffect)) {
      throw new Error(
        `${file}: não achei useEffect de load.`,
      );
    }

    content = content.replace(
      loadEffect,
      loadEffect +
`
  useEffect(() => {
    if (checkoutOpen && !publicKey) {
      console.error("subscription_public_key_missing");
      setError(
        "O checkout de assinatura ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }
  }, [checkoutOpen, publicKey]);
`,
    );
  }

  content = content.replace(
`    void renderBrick();

    return () => {`,
`    void renderBrick().catch((cause) => {
      console.error("subscription_payment_brick_render_error", cause);

      if (!cancelled) {
        setBrickReady(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível iniciar o pagamento.",
        );
      }
    });

    return () => {`,
  );

  write(file, content);

  if (
    !content.includes(
      'fetchWithPaymentTimeout(\n            "/api/assinatura/mercado-pago"',
    ) ||
    !content.includes(
      'fetchWithPaymentTimeout("/api/assinatura/checkout"',
    )
  ) {
    throw new Error(
      `${file}: timeout dos pagamentos não foi aplicado.`,
    );
  }

  console.log("[OK] assinatura não fica mais em loading infinito");
}

console.log("\nPATCH_PAYMENT_BUGS_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-fix-payment-bugs-$([guid]::NewGuid().ToString('N')).cjs"

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

Step "Conferindo percentuais"
Select-String `
    -Path ".\lib\plans\plan-config.ts" `
    -Pattern "marketplaceFeePercent"

Step "Verificando fronteiras de credenciais"
$package = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($package.scripts.'verify:payment-credentials') {
    Run $Npm @("run", "verify:payment-credentials")
}
else {
    Write-Host "[AVISO] verify:payment-credentials não existe neste checkout local." -ForegroundColor Yellow
}

Step "Verificando contratos de pagamento"
if ($package.scripts.'verify:payments') {
    Run $Npm @("run", "verify:payments")
}
else {
    Write-Host "[AVISO] verify:payments não existe neste checkout local." -ForegroundColor Yellow
}

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/plans/plan-config.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/marketplace/payments/sales/route.ts",
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx"
)

Step "Build completo"
Run $Npm @("run", "build")

Step "Verificando diff"
Run $Git @("diff", "--check")
& $Git diff --stat
& $Git status --short

Step "Criando commit"

Run $Git @(
    "add", "--",
    "lib/plans/plan-config.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/marketplace/payments/sales/route.ts",
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx"
)

Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet
$nothingToCommit = ($LASTEXITCODE -eq 0)

if ($nothingToCommit) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Run $Git @(
        "commit",
        "-m",
        "Corrige taxas e conciliacao dos pagamentos"
    )

    $hash = (& $Git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Enviando branch ao GitHub"
    Run $Git @("push", "-u", "origin", $branch)
}

Write-Host ""
Write-Host "Correções aplicadas e validadas." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "As credenciais novas da Vercel só entram em vigor em um NOVO deployment."
Write-Host "Depois do push, teste primeiro o Preview novo."
