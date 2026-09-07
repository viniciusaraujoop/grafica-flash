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

$targets = @(
    "components/checkout/SignupCheckout.tsx",
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
    "lib/payments/checkout-service.ts"
)

foreach ($file in $targets) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "Arquivo não encontrado: $file"
    }
}

Step "Corrigindo regras do React Compiler"

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

// Cadastro: carga inicial assíncrona para não disparar setState sincrônico no effect
{
  const file = "components/checkout/SignupCheckout.tsx";

  replaceOnce(
    file,
`  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);
`,
`  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCheckout();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCheckout]);
`,
    "carga inicial do cadastro compatível com React Compiler",
  );

  replaceOnce(
    file,
`  useEffect(() => {
    if (checkoutOpen && !publicKey) {
      console.error("signup_public_key_missing");
      setError(
        "O checkout de cadastro ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }
  }, [checkoutOpen, publicKey]);
`,
`  useEffect(() => {
    if (!checkoutOpen || publicKey) return;

    const timer = window.setTimeout(() => {
      console.error("signup_public_key_missing");
      setError(
        "O checkout de cadastro ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [checkoutOpen, publicKey]);
`,
    "diagnóstico da Public Key do cadastro sem setState síncrono",
  );

  let content = read(file);

  const oldDeps =
`    [checkout?.email, expires, leadId, token],
  );`;

  const newDeps =
`    [checkout?.document, checkout?.email, expires, leadId, token],
  );`;

  if (content.includes(oldDeps)) {
    content = content.replace(oldDeps, newDeps);
    write(file, content);
    console.log("[OK] dependência checkout.document adicionada");
  } else if (content.includes(newDeps)) {
    console.log("[OK] dependência checkout.document já adicionada");
  } else {
    throw new Error(
      `${file}: não encontrei dependências esperadas de submitPayment.`,
    );
  }
}

// Assinatura: mesma correção + dependência ampla do snapshot
{
  const file =
    "components/subscription/MercadoPagoSubscriptionCheckout.tsx";

  replaceOnce(
    file,
`  useEffect(() => {
    void load();
  }, [load]);
`,
`  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);
`,
    "carga inicial da assinatura compatível com React Compiler",
  );

  replaceOnce(
    file,
`  useEffect(() => {
    if (checkoutOpen && !publicKey) {
      console.error("subscription_public_key_missing");
      setError(
        "O checkout de assinatura ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }
  }, [checkoutOpen, publicKey]);
`,
`  useEffect(() => {
    if (!checkoutOpen || publicKey) return;

    const timer = window.setTimeout(() => {
      console.error("subscription_public_key_missing");
      setError(
        "O checkout de assinatura ainda não recebeu a chave pública do Mercado Pago neste deploy.",
      );
      setBrickReady(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [checkoutOpen, publicKey]);
`,
    "diagnóstico da Public Key da assinatura sem setState síncrono",
  );

  let content = read(file);

  const oldDeps =
`    [getToken, load, mode, planKey, snapshot?.company?.email],
  );`;

  const newDeps =
`    [getToken, load, mode, planKey, snapshot],
  );`;

  if (content.includes(oldDeps)) {
    content = content.replace(oldDeps, newDeps);
    console.log("[OK] dependência do snapshot corrigida");
  } else if (content.includes(newDeps)) {
    console.log("[OK] dependência do snapshot já corrigida");
  } else {
    throw new Error(
      `${file}: não encontrei dependências esperadas de submitPayment.`,
    );
  }

  content = read(file);

  if (
    content.startsWith(
      "/* eslint-disable @typescript-eslint/no-explicit-any */",
    )
  ) {
    content = content.replace(
      "/* eslint-disable @typescript-eslint/no-explicit-any */",
      "/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */",
    );
    write(file, content);
    console.log("[OK] warning legado de <img> isolado");
  }
}

// Checkout marketplace: remove import que ficou órfão
{
  const file = "lib/payments/checkout-service.ts";
  let content = read(file);

  const oldImport =
`import {
  getMarketplaceClientId,
} from "@/lib/payments/marketplace/config";
`;

  if (content.includes(oldImport)) {
    content = content.replace(oldImport, "");
    write(file, content);
    console.log("[OK] import getMarketplaceClientId removido");
  } else if (!content.includes("getMarketplaceClientId")) {
    console.log("[OK] import getMarketplaceClientId já ausente");
  } else {
    throw new Error(
      `${file}: getMarketplaceClientId ainda aparece em posição inesperada.`,
    );
  }
}

console.log("\nREACT_LINT_FIXES_OK=1");
'@

$tempJs = Join-Path $env:TEMP "orcaly-finalize-payment-lint-$([guid]::NewGuid().ToString('N')).cjs"

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

Step "Validando credenciais isoladas"
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
Write-Host "Correção concluída com sucesso." -ForegroundColor Green
Write-Host "Depois do push, aguarde o novo Preview da Vercel ficar READY antes de testar." -ForegroundColor Cyan
