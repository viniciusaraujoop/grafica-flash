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

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Repositório grafica-flash não encontrado."
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$branch = (& $Git branch --show-current).Trim()
if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Branch atual"
Write-Host $branch

$files = @{
    "lib/payments/asaas.ts" = @'
import "server-only";
import crypto from "node:crypto";

export type AsaasEnvironment = "sandbox" | "production";

type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return String(value || "").trim();
}

export function getAsaasEnvironment(
  value: unknown,
): AsaasEnvironment {
  return text(value).toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
}

export function getAsaasConfig(
  environment: AsaasEnvironment,
) {
  if (environment === "sandbox") {
    return {
      environment,
      apiUrl:
        text(process.env.ASAAS_SANDBOX_API_URL) ||
        "https://api-sandbox.asaas.com/v3",
      accessToken:
        text(process.env.ASAAS_SANDBOX_ACCESS_TOKEN),
      webhookToken:
        text(process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN),
      walletId:
        text(process.env.ASAAS_SANDBOX_WALLET_ID),
    };
  }

  return {
    environment,
    apiUrl:
      text(process.env.ASAAS_MARKETPLACE_API_URL) ||
      "https://api.asaas.com/v3",
    accessToken:
      text(process.env.ASAAS_MARKETPLACE_ACCESS_TOKEN),
    webhookToken:
      text(process.env.ASAAS_MARKETPLACE_WEBHOOK_TOKEN),
    walletId:
      text(process.env.ASAAS_MARKETPLACE_WALLET_ID),
  };
}

export function secureTokenEquals(
  received: string | null,
  expected: string,
) {
  if (!received || !expected) return false;

  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

async function asaasRequest(
  environment: AsaasEnvironment,
  path: string,
  options?: {
    method?: string;
    body?: JsonRecord;
  },
) {
  const config = getAsaasConfig(environment);

  if (!config.accessToken) {
    throw new Error(
      `Credencial Asaas ${environment} não configurada.`,
    );
  }

  const response = await fetch(
    `${config.apiUrl}${path}`,
    {
      method: options?.method || "GET",
      cache: "no-store",
      headers: {
        access_token: config.accessToken,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Orcaly/1.0",
      },
      body: options?.body
        ? JSON.stringify(options.body)
        : undefined,
    },
  );

  const payload =
    (await response
      .json()
      .catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    const errors = Array.isArray(payload.errors)
      ? payload.errors
      : [];

    const message =
      errors
        .map((item) => {
          if (
            !item ||
            typeof item !== "object"
          ) {
            return "";
          }

          const record = item as JsonRecord;

          return text(
            record.description ||
              record.code,
          );
        })
        .filter(Boolean)
        .join(" | ") ||
      text(payload.message) ||
      `Erro Asaas HTTP ${response.status}.`;

    throw Object.assign(
      new Error(message),
      {
        status: response.status,
        providerPayload: payload,
      },
    );
  }

  return payload;
}

export function getAsaasWallet(
  environment: AsaasEnvironment,
) {
  return asaasRequest(
    environment,
    "/wallets/",
  );
}

export function createAsaasCustomer(
  environment: AsaasEnvironment,
  payload: JsonRecord,
) {
  return asaasRequest(
    environment,
    "/customers",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function createAsaasPayment(
  environment: AsaasEnvironment,
  payload: JsonRecord,
) {
  return asaasRequest(
    environment,
    "/payments",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getAsaasPixQrCode(
  environment: AsaasEnvironment,
  paymentId: string,
) {
  return asaasRequest(
    environment,
    `/payments/${encodeURIComponent(
      paymentId,
    )}/pixQrCode`,
  );
}
'@

    "app/api/marketplace/payments/webhook/asaas/route.ts" = @'
import {
  getAsaasConfig,
  getAsaasEnvironment,
  secureTokenEquals,
} from "@/lib/payments/asaas";
import { NextRequest, NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return String(value || "").trim();
}

function record(value: unknown): JsonRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as JsonRecord;
}

export async function POST(
  request: NextRequest,
) {
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

  const receivedToken =
    request.headers.get(
      "asaas-access-token",
    );

  if (
    !secureTokenEquals(
      receivedToken,
      config.webhookToken,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Token de webhook Asaas inválido.",
      },
      { status: 401 },
    );
  }

  const body =
    (await request
      .json()
      .catch(() => ({}))) as JsonRecord;

  const eventId = text(body.id);
  const event = text(body.event);
  const payment = record(body.payment);

  console.info(
    "[ASAAS_WEBHOOK]",
    JSON.stringify({
      environment,
      eventId,
      event,
      paymentId: text(payment.id),
      status: text(payment.status),
      billingType:
        text(payment.billingType),
      value:
        Number(payment.value || 0),
      netValue:
        Number(payment.netValue || 0),
    }),
  );

  // Fase 1:
  // apenas autentica e observa os eventos.
  // Nenhum pedido ou pagamento interno é alterado aqui ainda.
  return NextResponse.json({
    ok: true,
    environment,
    eventId: eventId || null,
    event: event || null,
  });
}
'@
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $Root ".orcaly-backups\asaas-webhook-fase1-$stamp"

Step "Criando arquivos Asaas"

foreach ($relative in $files.Keys) {
    $path = Join-Path $Root $relative
    $dir = Split-Path -Parent $path

    New-Item `
        -ItemType Directory `
        -Path $dir `
        -Force | Out-Null

    if (Test-Path -LiteralPath $path) {
        $backup = Join-Path $backupRoot $relative
        $backupDir = Split-Path -Parent $backup

        New-Item `
            -ItemType Directory `
            -Path $backupDir `
            -Force | Out-Null

        Copy-Item `
            -LiteralPath $path `
            -Destination $backup `
            -Force
    }

    [System.IO.File]::WriteAllText(
        $path,
        $files[$relative],
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "[OK] $relative" -ForegroundColor Green
}

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/payments/asaas.ts",
    "app/api/marketplace/payments/webhook/asaas/route.ts"
)

Step "Build completo"
Run $Npm @("run", "build")

Step "Verificando diff"
Run $Git @("diff", "--check")
& $Git diff --stat
& $Git status --short

Step "Commit"
$targets = @(
    "lib/payments/asaas.ts",
    "app/api/marketplace/payments/webhook/asaas/route.ts"
)

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
        "Adiciona base Asaas e webhook sandbox"
    )

    $hash = (& $Git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ASAAS_WEBHOOK_FASE1_OK=1" -ForegroundColor Green
Write-Host "Aguarde apenas o Preview da Vercel aparecer como READY." -ForegroundColor Cyan
