param(
    [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

function Read-Utf8([string]$RelativePath) {
    $path = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Arquivo não encontrado: $RelativePath"
    }

    return [System.IO.File]::ReadAllText($path)
}

function Write-Utf8([string]$RelativePath, [string]$Content) {
    $path = Join-Path $ProjectRoot $RelativePath
    $directory = Split-Path -Parent $path

    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $path,
        ($Content -replace "`r`n", "`n"),
        (New-Object System.Text.UTF8Encoding($false))
    )
}

function Backup-Files([string[]]$Files) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupRoot = Join-Path $ProjectRoot ".orcaly-backups\payment-credentials-phase2-$stamp"

    foreach ($relative in $Files) {
        $source = Join-Path $ProjectRoot $relative

        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            continue
        }

        $destination = Join-Path $backupRoot $relative
        $destinationDirectory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }

    return $backupRoot
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 na raiz do projeto grafica-flash."
}

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível identificar a branch atual."
}

if (-not $branch) {
    throw "O repositório está em detached HEAD."
}

Step "Branch atual"
Write-Host $branch

$filesToBackup = @(
    ".env.example",
    "package.json",
    "app/api/mercado-pago/webhook-leads/route.ts",
    "scripts/auditar-isolamento-pagamentos.cjs"
)

$backup = Backup-Files $filesToBackup
Write-Host "Backup: $backup"

Step "Removendo credenciais genéricas da .env.example"

$envExample = Read-Utf8 ".env.example"
$normalizedEnv = $envExample -replace "`r`n", "`n"

$legacyLines = @(
    "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN=",
    "MERCADO_PAGO_ACCESS_TOKEN=",
    "MERCADO_PAGO_PUBLIC_KEY=",
    "MERCADO_PAGO_CLIENT_ID=",
    "MERCADO_PAGO_CLIENT_SECRET=",
    "MERCADO_PAGO_REDIRECT_URI=https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback",
    "MERCADO_PAGO_WEBHOOK_SECRET=",
    "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY="
)

foreach ($line in $legacyLines) {
    $escaped = [Regex]::Escape($line)
    $normalizedEnv = [Regex]::Replace(
        $normalizedEnv,
        "(?m)^$escaped\r?\n?",
        ""
    )
}

$normalizedEnv = [Regex]::Replace($normalizedEnv, "\n{3,}", "`n`n")

Write-Utf8 ".env.example" $normalizedEnv
Write-Host "  [OK] .env.example contém apenas os conjuntos isolados" -ForegroundColor Green

Step "Fechando GET inseguro do webhook de cadastro"

$webhookPath = "app/api/mercado-pago/webhook-leads/route.ts"
$webhook = (Read-Utf8 $webhookPath) -replace "`r`n", "`n"

$oldGet = @'
export async function GET(request: NextRequest) {
  return NextResponse.json(
    await processPayment(getPaymentIdFromUrl(request)),
  );
}
'@

$newGet = @'
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "mercado-pago-signup-webhook",
    accepts: ["POST"],
  });
}
'@

if ($webhook.Contains($oldGet)) {
    $webhook = $webhook.Replace($oldGet, $newGet)
    Write-Utf8 $webhookPath $webhook
    Write-Host "  [OK] GET não processa mais pagamentos" -ForegroundColor Green
}
elseif ($webhook.Contains('route: "mercado-pago-signup-webhook"')) {
    Write-Host "  [OK] GET seguro já estava aplicado" -ForegroundColor Green
}
else {
    throw "Não encontrei o bloco GET esperado em $webhookPath."
}

Step "Fortalecendo auditoria de credenciais"

$audit = @'
const { loadEnvConfig } = require("@next/env");
const fs = require("node:fs");
const path = require("node:path");

loadEnvConfig(process.cwd(), true);

const groups = {
  cadastro: [
    "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY",
    "MP_SIGNUP_ACCESS_TOKEN",
    "MP_SIGNUP_WEBHOOK_SECRET",
  ],
  assinatura: [
    "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY",
    "MP_SUBSCRIPTION_ACCESS_TOKEN",
    "MP_SUBSCRIPTION_WEBHOOK_SECRET",
  ],
  marketplace: [
    "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY",
    "MP_MARKETPLACE_CLIENT_ID",
    "MP_MARKETPLACE_CLIENT_SECRET",
    "MP_MARKETPLACE_REDIRECT_URI",
    "MP_MARKETPLACE_WEBHOOK_SECRET",
  ],
};

const legacyCredentialNames = [
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
];

const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];

  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }

  return result;
}

let structuralFailures = 0;

console.log("\n[FRONTEIRAS DE CREDENCIAIS]");

for (const root of sourceRoots) {
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, "utf8");

    for (const legacy of legacyCredentialNames) {
      if (content.includes(`process.env.${legacy}`) || content.includes(`process.env["${legacy}"]`) || content.includes(`process.env['${legacy}']`)) {
        console.error(`[FALHA] ${file} ainda usa ${legacy}`);
        structuralFailures += 1;
      }
    }
  }
}

const requiredOwnership = [
  {
    file: "lib/payments/signup/mercado-pago.ts",
    required: ["MP_SIGNUP_ACCESS_TOKEN", "MP_SIGNUP_WEBHOOK_SECRET"],
    forbidden: ["MP_SUBSCRIPTION_", "MP_MARKETPLACE_"],
  },
  {
    file: "lib/payments/subscription/mercado-pago.ts",
    required: ["MP_SUBSCRIPTION_ACCESS_TOKEN", "MP_SUBSCRIPTION_WEBHOOK_SECRET"],
    forbidden: ["MP_SIGNUP_", "MP_MARKETPLACE_"],
  },
  {
    file: "lib/payments/marketplace/config.ts",
    required: [
      "MP_MARKETPLACE_CLIENT_ID",
      "MP_MARKETPLACE_CLIENT_SECRET",
      "MP_MARKETPLACE_WEBHOOK_SECRET",
    ],
    forbidden: ["MP_SIGNUP_", "MP_SUBSCRIPTION_", "MP_MARKETPLACE_ACCESS_TOKEN"],
  },
];

for (const check of requiredOwnership) {
  const content = fs.readFileSync(check.file, "utf8");

  for (const required of check.required) {
    if (!content.includes(required)) {
      console.error(`[FALHA] ${check.file} não contém ${required}`);
      structuralFailures += 1;
    }
  }

  for (const forbidden of check.forbidden) {
    if (content.includes(forbidden)) {
      console.error(`[FALHA] ${check.file} mistura credencial ${forbidden}`);
      structuralFailures += 1;
    }
  }
}

const signupWebhook = fs.readFileSync(
  "app/api/mercado-pago/webhook-leads/route.ts",
  "utf8",
);

if (!signupWebhook.includes("getSignupWebhookSecret")) {
  console.error("[FALHA] webhook de cadastro não usa MP_SIGNUP_WEBHOOK_SECRET");
  structuralFailures += 1;
}

if (/export\s+async\s+function\s+GET\s*\([^)]*request/.test(signupWebhook)) {
  console.error("[FALHA] webhook de cadastro ainda possui GET capaz de receber request");
  structuralFailures += 1;
}

const subscriptionWebhook = fs.readFileSync(
  "app/api/mercado-pago/webhook/route.ts",
  "utf8",
);

if (!subscriptionWebhook.includes("getSubscriptionWebhookSecret")) {
  console.error("[FALHA] webhook de assinatura não usa MP_SUBSCRIPTION_WEBHOOK_SECRET");
  structuralFailures += 1;
}

const marketplaceWebhook = fs.readFileSync(
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "utf8",
);

if (!marketplaceWebhook.includes("getMarketplaceWebhookSecret")) {
  console.error("[FALHA] webhook do marketplace não usa MP_MARKETPLACE_WEBHOOK_SECRET");
  structuralFailures += 1;
}

console.log(
  structuralFailures
    ? `\nPAYMENT_CREDENTIAL_BOUNDARIES_EXIT=1 (${structuralFailures} falhas)`
    : "\nPAYMENT_CREDENTIAL_BOUNDARIES_EXIT=0",
);

if (process.argv.includes("--check-env")) {
  let missing = 0;

  console.log("\n[CREDENCIAIS DO AMBIENTE LOCAL]");

  for (const [group, names] of Object.entries(groups)) {
    console.log(`\n[${group.toUpperCase()}]`);

    for (const name of names) {
      const value = String(process.env[name] || "").trim();

      console.log(
        `${value ? "[OK]" : "[FALTA]"} ${name} ` +
          `(configurada=${Boolean(value)}, tamanho=${value.length})`,
      );

      if (!value) missing += 1;
    }
  }

  if (missing) {
    console.error(`\nPAYMENT_ENV_EXIT=1 (${missing} ausentes)`);
    process.exit(1);
  }

  console.log("\nPAYMENT_ENV_EXIT=0");
}

process.exit(structuralFailures ? 1 : 0);
'@

Write-Utf8 "scripts/auditar-isolamento-pagamentos.cjs" $audit
Write-Host "  [OK] auditoria agora bloqueia mistura entre os 3 fluxos" -ForegroundColor Green

Step "Adicionando comando de verificação ao package.json"

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
if (-not $package.scripts) {
    $package | Add-Member -MemberType NoteProperty -Name scripts -Value ([PSCustomObject]@{})
}

$package.scripts | Add-Member `
    -MemberType NoteProperty `
    -Name "verify:payment-credentials" `
    -Value "node scripts/auditar-isolamento-pagamentos.cjs" `
    -Force

$packageJson = $package | ConvertTo-Json -Depth 100
Write-Utf8 "package.json" ($packageJson + "`n")

Write-Host "  [OK] npm run verify:payment-credentials" -ForegroundColor Green

Step "Validando fronteiras"
Invoke-Checked npm run verify:payment-credentials

Step "Validando contratos de pagamento"
Invoke-Checked npm run verify:payments

Step "Executando ESLint"
Invoke-Checked npx eslint `
    app/api/mercado-pago/webhook-leads/route.ts `
    scripts/auditar-isolamento-pagamentos.cjs

Step "Executando build"
Invoke-Checked npm run build

Step "Verificando diff"
Invoke-Checked git diff --check

git diff --stat
git status --short

$commitFiles = @(
    ".env.example",
    "package.json",
    "app/api/mercado-pago/webhook-leads/route.ts",
    "scripts/auditar-isolamento-pagamentos.cjs"
)

Step "Criando commit"
Invoke-Checked git add -- @commitFiles
Invoke-Checked git diff --cached --check

& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Invoke-Checked git commit -m "Isola credenciais Mercado Pago por fluxo"
    $hash = (& git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Enviando branch ao GitHub"
    Invoke-Checked git push -u origin $branch
}

Write-Host ""
Write-Host "Separação de credenciais concluída." -ForegroundColor Green
Write-Host ""
Write-Host "Ainda NÃO remova as variáveis antigas da Vercel." -ForegroundColor Yellow
Write-Host "Primeiro faça o deploy deste commit; depois removeremos:" -ForegroundColor Yellow
Write-Host "  MERCADO_PAGO_PLATFORM_ACCESS_TOKEN"
Write-Host "  MERCADO_PAGO_ACCESS_TOKEN"
Write-Host "  MERCADO_PAGO_PUBLIC_KEY"
Write-Host "  MERCADO_PAGO_CLIENT_ID"
Write-Host "  MERCADO_PAGO_CLIENT_SECRET"
Write-Host "  MERCADO_PAGO_REDIRECT_URI"
Write-Host "  MERCADO_PAGO_WEBHOOK_SECRET"
Write-Host "  NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY"
