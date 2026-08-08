param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Root = "C:\Users\arauj\grafica-flash"
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

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$Path = Join-Path $Root "app/api/marketplace/payments/webhook/asaas/route.ts"

if (-not (Test-Path -LiteralPath $Path)) {
    throw "Webhook Asaas não encontrado em $Path"
}

$content = [System.IO.File]::ReadAllText($Path)

$old = @'
  const url = new URL(request.url);
  const environment =
    getAsaasEnvironment(
      url.searchParams.get("environment"),
    );
  const config =
    getAsaasConfig(environment);

  if (!config.webhookToken) {
    return NextResponse.json(
      {
        error:
          `Webhook Asaas ${environment} não configurado.`,
      },
      { status: 503 },
    );
  }
'@

$new = @'
  const url = new URL(request.url);
  const explicitEnvironment =
    url.searchParams.get("environment");
  const environment =
    explicitEnvironment
      ? getAsaasEnvironment(
          explicitEnvironment,
        )
      : process.env.VERCEL_ENV === "preview"
        ? "sandbox"
        : "production";
  const config =
    getAsaasConfig(environment);

  if (!config.webhookToken) {
    console.warn(
      "[ASAAS_WEBHOOK_CONFIG_MISSING]",
      JSON.stringify({
        environment,
        vercelEnv:
          process.env.VERCEL_ENV || null,
        hasExplicitEnvironment:
          Boolean(explicitEnvironment),
        hasSandboxWebhookToken:
          Boolean(
            process.env
              .ASAAS_SANDBOX_WEBHOOK_TOKEN,
          ),
        hasProductionWebhookToken:
          Boolean(
            process.env
              .ASAAS_MARKETPLACE_WEBHOOK_TOKEN,
          ),
      }),
    );

    return NextResponse.json(
      {
        error:
          `Webhook Asaas ${environment} não configurado.`,
      },
      { status: 503 },
    );
  }
'@

if (-not $content.Contains($old)) {
    throw "Trecho esperado não encontrado. O arquivo pode ter mudado."
}

$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText(
    $Path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Step "Validando"
Run $Npx @(
    "eslint",
    "app/api/marketplace/payments/webhook/asaas/route.ts"
)
Run $Npm @("run", "build")
Run $Git @("diff", "--check")

Step "Diff"
& $Git diff --stat
& $Git diff -- "app/api/marketplace/payments/webhook/asaas/route.ts"

Step "Commit"
Run $Git @(
    "add",
    "--",
    "app/api/marketplace/payments/webhook/asaas/route.ts"
)

& $Git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova." -ForegroundColor Yellow
} else {
    Run $Git @(
        "commit",
        "-m",
        "Corrige ambiente do webhook Asaas no preview"
    )
}

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ASAAS_WEBHOOK_ENV_FIX_OK=1" -ForegroundColor Green
