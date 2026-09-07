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

Step "Corrigindo as 2 dependências restantes do React Compiler"

$patcher = @'
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function write(file, content) {
  fs.writeFileSync(file, content.replace(/\r\n/g, "\n"), "utf8");
}

function patchDependency(file, variants, replacement, label) {
  let content = read(file);

  if (content.includes(replacement)) {
    console.log(`[OK] ${label} já está correto`);
    return;
  }

  let changed = false;

  for (const variant of variants) {
    if (content.includes(variant)) {
      content = content.replace(variant, replacement);
      changed = true;
      break;
    }
  }

  if (!changed) {
    throw new Error(
      `${file}: não encontrei a lista de dependências esperada para "${label}".`,
    );
  }

  write(file, content);

  const verified = read(file);

  if (!verified.includes(replacement)) {
    throw new Error(
      `${file}: a correção "${label}" não persistiu no arquivo.`,
    );
  }

  console.log(`[OK] ${label}`);
}

patchDependency(
  "components/checkout/SignupCheckout.tsx",
  [
    "    [checkout?.document, checkout?.email, expires, leadId, token],\n",
    "    [checkout?.email, expires, leadId, token],\n",
  ],
  "    [checkout, expires, leadId, token],\n",
  "SignupCheckout usa o objeto checkout inteiro",
);

patchDependency(
  "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
  [
    "    [getToken, load, mode, planKey, snapshot?.company?.email],\n",
  ],
  "    [getToken, load, mode, planKey, snapshot],\n",
  "SubscriptionCheckout usa o objeto snapshot inteiro",
);

console.log("\nREACT_MEMOIZATION_FIX_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-react-memo-fix-$([guid]::NewGuid().ToString('N')).cjs"

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

Step "Confirmando dependências corrigidas"

Select-String `
    -Path ".\components\checkout\SignupCheckout.tsx" `
    -Pattern "\[checkout, expires, leadId, token\]"

Select-String `
    -Path ".\components\subscription\MercadoPagoSubscriptionCheckout.tsx" `
    -Pattern "\[getToken, load, mode, planKey, snapshot\]"

Step "Validando fronteiras de credenciais"
Run $Npm @("run", "verify:payment-credentials")

Step "Validando contratos de pagamento"
Run $Npm @("run", "verify:payments")

Step "Rodando ESLint"
Run $Npx @(
    "eslint",
    "lib/plans/plan-config.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/marketplace/payments/sales/route.ts",
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx"
)

Step "Rodando build completo"
Run $Npm @("run", "build")

Step "Verificando diff"
Run $Git @("diff", "--check")
& $Git diff --stat
& $Git status --short

Step "Criando commit"

$commitFiles = @(
    "lib/plans/plan-config.ts",
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
    "app/api/marketplace/payments/sales/route.ts",
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx"
)

Run $Git (@("add", "--") + $commitFiles)
Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
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
Write-Host "Tudo validado com sucesso." -ForegroundColor Green
Write-Host "Agora o próximo passo é conferir o novo Preview da Vercel." -ForegroundColor Cyan
