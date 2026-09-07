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

if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Branch atual"
Write-Host $branch

$targets = @(
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts"
)

foreach ($file in $targets) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo não encontrado: $file"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $Root ".orcaly-backups\marketplace-webhook-v4-$stamp"

Step "Criando backup"

foreach ($relative in $targets) {
    $source = Join-Path $Root $relative
    $destination = Join-Path $backupRoot $relative
    $dir = Split-Path -Parent $destination

    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

Write-Host "Backup: $backupRoot"

Step "Corrigindo notification_url e assinatura do webhook"

$patcher = @'
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
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

{
  const file = "lib/payments/checkout-service.ts";

  replaceOnce(
    file,
`    notification_url:
      \`${appUrl}/api/marketplace/payments/webhook/mercado-pago\` +
      \`?company_id=\${encodeURIComponent(companyId)}\` +
      \`&marketplace_payment_id=\${encodeURIComponent(transactionId)}\`,`,
`    notification_url:
      \`${appUrl}/api/marketplace/payments/webhook/mercado-pago\` +
      \`?company_id=\${encodeURIComponent(companyId)}\` +
      \`&marketplace_payment_id=\${encodeURIComponent(transactionId)}\` +
      \`&source_news=webhooks\`,`,
    "notification_url usa somente Webhooks",
  );
}

{
  const file =
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts";

  replaceOnce(
    file,
`    const signatureOk = verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: paymentId,
      secret,
    })

    if (!signatureOk) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }`,
`    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    const signatureDataIdRaw = String(
      url.searchParams.get('data.id') ||
        url.searchParams.get('data_id') ||
        paymentId ||
        '',
    )
    const signatureDataId = /[a-z]/i.test(signatureDataIdRaw)
      ? signatureDataIdRaw.toLowerCase()
      : signatureDataIdRaw

    if (!xSignature || !xRequestId) {
      return NextResponse.json({
        ok: true,
        ignored: 'Notificacao legada sem assinatura.',
      })
    }

    const signatureOk = verifyMercadoPagoWebhookSignature({
      xSignature,
      xRequestId,
      dataId: signatureDataId,
      secret,
    })

    if (!signatureOk) {
      return NextResponse.json(
        { error: 'Assinatura invalida.' },
        { status: 401 },
      )
    }`,
    "webhook valida data.id oficial e ignora legado sem processar",
  );
}

console.log("\nMARKETPLACE_WEBHOOK_V4_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-marketplace-webhook-v4-$([guid]::NewGuid().ToString('N')).cjs"

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

Step "Validando pagamentos"
Run $Npm @("run", "verify:payment-credentials")
Run $Npm @("run", "verify:payments")

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts"
)

Step "Build"
Run $Npm @("run", "build")

Step "Verificando diff"
Run $Git @("diff", "--check")
& $Git diff --stat
& $Git status --short

Step "Commit"

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
        "Corrige notificacoes do marketplace Mercado Pago"
    )

    $hash = (& $Git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Push"
    Run $Git @("push", "-u", "origin", $branch)
}

Write-Host ""
Write-Host "Tudo validado e publicado." -ForegroundColor Green
Write-Host "Novos pagamentos usarão somente Webhooks assinados." -ForegroundColor Green
Write-Host "O próximo Preview deve ser promovido para Production." -ForegroundColor Cyan
