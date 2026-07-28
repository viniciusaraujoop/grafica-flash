param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\mercado-pago-oauth-fase1-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Save-Text([string]$Path, [string]$Text) {
  $Target = Full $Path

  if (Test-Path -LiteralPath $Target) {
    $Copy = Join-Path $Backup ($Path -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $Copy -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
  [IO.File]::WriteAllText(
    $Target,
    $Text.TrimStart("`r", "`n").TrimEnd("`r", "`n") + "`n",
    $Utf8
  )

  Write-Host "[OK] $Path" -ForegroundColor Green
}

function Read-Text([string]$Path) {
  $Target = Full $Path
  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }

  [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
}

function Add-EnvExample([string[]]$Names) {
  $Path = Full ".env.example"
  $Text = if (Test-Path -LiteralPath $Path) {
    [IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
  } else {
    ""
  }

  $Changed = $false

  foreach ($Name in $Names) {
    if ($Text -notmatch "(?m)^\s*$([regex]::Escape($Name))\s*=") {
      if ($Text -and -not $Text.EndsWith("`n")) {
        $Text += "`n"
      }

      $Text += "$Name=`n"
      $Changed = $true
    }
  }

  if ($Changed) {
    Save-Text ".env.example" $Text
  } else {
    Write-Host "[SEM ALTERACAO] .env.example" -ForegroundColor Yellow
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - MERCADO PAGO TRANSPARENTE - FASE 1" -ForegroundColor Cyan
Write-Host "OAuth seguro, tokens criptografados e painel" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$MercadoPagoLib = @'
import "server-only";
import crypto from "node:crypto";
import {
  decryptPaymentCredential,
  encryptPaymentCredential,
} from "@/lib/payments/credential-encryption";

export type MercadoPagoPreferenceItem = {
  id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

type JsonRecord = Record<string, unknown>;

function requiredEnv(name: string) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`Variavel ${name} nao configurada.`);
  }

  return value;
}

function paymentEncryptionSecret() {
  return requiredEnv("PAYMENT_CREDENTIALS_ENCRYPTION_KEY");
}

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function hmac(value: string) {
  return base64Url(
    crypto
      .createHmac("sha256", paymentEncryptionSecret())
      .update(value)
      .digest(),
  );
}

function safeEqual(left: string, right: string) {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(left),
      Buffer.from(right),
    );
  } catch {
    return false;
  }
}

async function mercadoPagoRequest(
  path: string,
  options: {
    accessToken: string;
    method?: string;
    body?: JsonRecord;
    idempotencyKey?: string;
  },
) {
  const response = await fetch(
    `https://api.mercadopago.com${path}`,
    {
      method: options.method || "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
        ...(options.idempotencyKey
          ? { "X-Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body: options.body
        ? JSON.stringify(options.body)
        : undefined,
    },
  );

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    const causes = Array.isArray(payload.cause)
      ? payload.cause
          .map((item) =>
            item && typeof item === "object"
              ? String(
                  (item as JsonRecord).description ||
                    (item as JsonRecord).message ||
                    "",
                )
              : "",
          )
          .filter(Boolean)
          .join(" | ")
      : "";

    throw Object.assign(
      new Error(
        causes ||
          String(
            payload.message ||
              payload.error_description ||
              payload.error ||
              "Erro ao comunicar com Mercado Pago.",
          ),
      ),
      {
        status: response.status,
        providerPayload: payload,
      },
    );
  }

  return payload;
}

const OFFICIAL_APP_URL = "https://orcaly.com.br";
const MARKETPLACE_CALLBACK_PATH =
  "/api/marketplace/payments/mercado-pago/callback";

export function getOrcalyAppUrl() {
  const configured = String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.ORCALY_APP_URL ||
      OFFICIAL_APP_URL,
  ).trim();

  try {
    const url = new URL(configured);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);

    if (
      process.env.NODE_ENV === "production" &&
      (url.protocol !== "https:" || local)
    ) {
      return OFFICIAL_APP_URL;
    }

    return url.origin.replace(/\/$/, "");
  } catch {
    return OFFICIAL_APP_URL;
  }
}

export function mercadoPagoRedirectUri() {
  const configured = String(
    process.env.MERCADO_PAGO_REDIRECT_URI || "",
  ).trim();

  if (configured) {
    try {
      const url = new URL(configured);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);

      if (
        process.env.NODE_ENV !== "production" ||
        (url.protocol === "https:" && !local)
      ) {
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      // Usa o endereco oficial abaixo.
    }
  }

  return `${getOrcalyAppUrl()}${MARKETPLACE_CALLBACK_PATH}`;
}

export function generateMercadoPagoOauthFlow() {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const signature = hmac(`state:${nonce}`);
  const state = `${nonce}.${signature}`;
  const codeVerifier = hmac(`pkce:${nonce}`);
  const codeChallenge = base64Url(
    crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest(),
  );

  return {
    state,
    codeVerifier,
    codeChallenge,
  };
}

export function verifyMercadoPagoOauthStateAndGetVerifier(
  state: string,
) {
  const [nonce, signature, extra] = String(state || "").split(".");

  if (!nonce || !signature || extra) {
    throw new Error("State OAuth invalido.");
  }

  const expected = hmac(`state:${nonce}`);

  if (!safeEqual(signature, expected)) {
    throw new Error("Assinatura do state OAuth invalida.");
  }

  return hmac(`pkce:${nonce}`);
}

export function buildMercadoPagoAuthUrl(
  state: string,
  codeChallenge?: string,
) {
  const clientId = requiredEnv("MERCADO_PAGO_CLIENT_ID");
  const authBase =
    process.env.MERCADO_PAGO_AUTH_URL ||
    "https://auth.mercadopago.com.br/authorization";

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: mercadoPagoRedirectUri(),
    state,
  });

  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${authBase}?${params.toString()}`;
}

export async function exchangeMercadoPagoCode(
  code: string,
  codeVerifier?: string,
) {
  const response = await fetch(
    "https://api.mercadopago.com/oauth/token",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_secret: requiredEnv("MERCADO_PAGO_CLIENT_SECRET"),
        client_id: requiredEnv("MERCADO_PAGO_CLIENT_ID"),
        grant_type: "authorization_code",
        code,
        redirect_uri: mercadoPagoRedirectUri(),
        ...(codeVerifier
          ? { code_verifier: codeVerifier }
          : {}),
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    throw new Error(
      String(
        payload.message ||
          payload.error_description ||
          payload.error ||
          "Erro ao conectar Mercado Pago.",
      ),
    );
  }

  return payload;
}

export async function refreshMercadoPagoAccessToken(
  refreshToken: string,
) {
  const response = await fetch(
    "https://api.mercadopago.com/oauth/token",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_secret: requiredEnv("MERCADO_PAGO_CLIENT_SECRET"),
        client_id: requiredEnv("MERCADO_PAGO_CLIENT_ID"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    throw new Error(
      String(
        payload.message ||
          payload.error_description ||
          payload.error ||
          "Erro ao renovar Mercado Pago.",
      ),
    );
  }

  return payload;
}

export function protectMercadoPagoToken(value: unknown) {
  return encryptPaymentCredential(String(value || ""));
}

export function unprotectMercadoPagoToken(value: unknown) {
  const token = String(value || "").trim();

  if (!token) {
    throw new Error("Token Mercado Pago ausente.");
  }

  // Compatibilidade temporaria com tokens antigos em texto puro.
  if (!token.startsWith("v1:")) {
    return token;
  }

  return decryptPaymentCredential(token);
}

export async function createMercadoPagoPreference(
  accessToken: string,
  payload: JsonRecord,
) {
  return mercadoPagoRequest("/checkout/preferences", {
    accessToken,
    method: "POST",
    body: payload,
  });
}

export async function createMercadoPagoPayment(
  accessToken: string,
  payload: JsonRecord,
  idempotencyKey: string,
) {
  return mercadoPagoRequest("/v1/payments", {
    accessToken,
    method: "POST",
    body: payload,
    idempotencyKey,
  });
}

export async function getMercadoPagoPayment(
  accessToken: string,
  paymentId: string,
) {
  return mercadoPagoRequest(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    { accessToken },
  );
}

export async function createMercadoPagoSubscription(
  accessToken: string,
  payload: JsonRecord,
) {
  return mercadoPagoRequest("/preapproval", {
    accessToken,
    method: "POST",
    body: payload,
  });
}

export async function updateMercadoPagoSubscription(
  accessToken: string,
  subscriptionId: string,
  payload: JsonRecord,
) {
  return mercadoPagoRequest(
    `/preapproval/${encodeURIComponent(subscriptionId)}`,
    {
      accessToken,
      method: "PUT",
      body: payload,
    },
  );
}

export async function cancelMercadoPagoSubscription(
  accessToken: string,
  subscriptionId: string,
) {
  return updateMercadoPagoSubscription(
    accessToken,
    subscriptionId,
    { status: "canceled" },
  );
}

export function generateOauthState() {
  return generateMercadoPagoOauthFlow().state;
}

export function hashOauthState(state: string) {
  return crypto
    .createHash("sha256")
    .update(state)
    .digest("hex");
}

export function verifyMercadoPagoWebhookSignature(options: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string | undefined;
}) {
  const {
    xSignature,
    xRequestId,
    dataId,
    secret,
  } = options;

  if (!secret) return true;
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;

  if (!ts || !v1) return false;

  const manifest =
    `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(v1),
    );
  } catch {
    return false;
  }
}

export function mapMercadoPagoStatus(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "approved") return "paid";
  if (normalized === "rejected") return "failed";
  if (
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "canceled";
  }
  if (normalized === "refunded") return "refunded";
  if (normalized === "charged_back") return "charged_back";

  return "pending";
}
'@

$ConnectRoute = @'
import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
} from "@/lib/company-access";
import {
  buildMercadoPagoAuthUrl,
  generateMercadoPagoOauthFlow,
  hashOauthState,
} from "@/lib/mercado-pago";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requester = await getRequester(request, supabaseAdmin);

    if (!requester) {
      return NextResponse.json(
        { error: "Nao autorizado." },
        { status: 401 },
      );
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    );

    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 },
      );
    }

    if (!access.canConfig && !access.canFinance) {
      return NextResponse.json(
        {
          error:
            "Sem permissao para configurar pagamentos.",
        },
        { status: 403 },
      );
    }

    const oauth = generateMercadoPagoOauthFlow();
    const stateHash = hashOauthState(oauth.state);
    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString();

    const { error } = await supabaseAdmin
      .from("marketplace_oauth_states")
      .insert({
        company_id: access.company.id,
        user_id: requester.id,
        provider: "mercado_pago",
        state_hash: stateHash,
        expires_at: expiresAt,
      });

    if (error) throw error;

    return NextResponse.json({
      url: buildMercadoPagoAuthUrl(
        oauth.state,
        oauth.codeChallenge,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao iniciar conexao Mercado Pago.",
      },
      { status: 500 },
    );
  }
}
'@

$CallbackRoute = @'
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/company-access";
import {
  exchangeMercadoPagoCode,
  hashOauthState,
  protectMercadoPagoToken,
  verifyMercadoPagoOauthStateAndGetVerifier,
} from "@/lib/mercado-pago";

export const runtime = "nodejs";

function panelUrl(
  request: NextRequest,
  params: Record<string, string>,
) {
  const url = new URL("/painel/pagamentos", request.url);

  url.searchParams.set("tab", "mercado-pago");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error") || "";

  if (errorParam) {
    return NextResponse.redirect(
      panelUrl(request, {
        mp: "error",
        message: errorParam,
      }),
    );
  }

  try {
    if (!code || !state) {
      throw new Error(
        "Callback Mercado Pago sem code ou state.",
      );
    }

    const codeVerifier =
      verifyMercadoPagoOauthStateAndGetVerifier(state);
    const stateHash = hashOauthState(state);

    const { data: oauthState, error: stateError } =
      await supabaseAdmin
        .from("marketplace_oauth_states")
        .select("*")
        .eq("state_hash", stateHash)
        .eq("provider", "mercado_pago")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

    if (stateError) throw stateError;

    if (!oauthState?.company_id) {
      throw new Error(
        "State OAuth invalido, expirado ou ja utilizado.",
      );
    }

    const tokenPayload = await exchangeMercadoPagoCode(
      code,
      codeVerifier,
    );

    const accessToken = String(
      tokenPayload.access_token || "",
    ).trim();
    const refreshToken = String(
      tokenPayload.refresh_token || "",
    ).trim();

    if (!accessToken) {
      throw new Error(
        "O Mercado Pago nao retornou o access token.",
      );
    }

    const expiresIn = Number(
      tokenPayload.expires_in || 0,
    );

    const tokenExpiresAt =
      expiresIn > 0
        ? new Date(
            Date.now() + expiresIn * 1000,
          ).toISOString()
        : null;

    await supabaseAdmin
      .from("marketplace_payment_settings")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", oauthState.company_id)
      .neq("provider", "mercado_pago");

    const { error: upsertError } = await supabaseAdmin
      .from("marketplace_payment_settings")
      .upsert(
        {
          company_id: oauthState.company_id,
          provider: "mercado_pago",
          provider_user_id: tokenPayload.user_id
            ? String(tokenPayload.user_id)
            : null,
          provider_account_id: tokenPayload.collector_id
            ? String(tokenPayload.collector_id)
            : tokenPayload.user_id
              ? String(tokenPayload.user_id)
              : null,
          access_token:
            protectMercadoPagoToken(accessToken),
          refresh_token: refreshToken
            ? protectMercadoPagoToken(refreshToken)
            : null,
          public_key:
            tokenPayload.public_key || null,
          token_expires_at: tokenExpiresAt,
          onboarding_status: "connected",
          is_active: true,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,provider" },
      );

    if (upsertError) throw upsertError;

    await supabaseAdmin
      .from("marketplace_oauth_states")
      .update({
        consumed_at: new Date().toISOString(),
      })
      .eq("id", oauthState.id);

    return NextResponse.redirect(
      panelUrl(request, { mp: "connected" }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro no callback Mercado Pago.";

    if (state) {
      const stateHash = hashOauthState(state);

      const { data: oauthState } = await supabaseAdmin
        .from("marketplace_oauth_states")
        .select("company_id")
        .eq("state_hash", stateHash)
        .maybeSingle();

      if (oauthState?.company_id) {
        await supabaseAdmin
          .from("marketplace_payment_settings")
          .upsert(
            {
              company_id: oauthState.company_id,
              provider: "mercado_pago",
              onboarding_status: "error",
              is_active: false,
              last_error: message.slice(0, 500),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "company_id,provider" },
          );
      }
    }

    return NextResponse.redirect(
      panelUrl(request, {
        mp: "error",
        message,
      }),
    );
  }
}
'@

$DisconnectRoute = @'
import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
} from "@/lib/company-access";

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requester = await getRequester(
      request,
      supabaseAdmin,
    );

    if (!requester) {
      return NextResponse.json(
        { error: "Nao autorizado." },
        { status: 401 },
      );
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    );

    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 },
      );
    }

    if (!access.canConfig && !access.canFinance) {
      return NextResponse.json(
        {
          error:
            "Sem permissao para desconectar pagamentos.",
        },
        { status: 403 },
      );
    }

    const { error } = await supabaseAdmin
      .from("marketplace_payment_settings")
      .update({
        is_active: false,
        onboarding_status: "disconnected",
        access_token: null,
        refresh_token: null,
        public_key: null,
        token_expires_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", access.company.id)
      .eq("provider", "mercado_pago");

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao desconectar Mercado Pago.",
      },
      { status: 500 },
    );
  }
}
'@

$PaymentsPage = @'
import MarketplacePaymentsPanel from "@/components/painel/MarketplacePaymentsPanel";

export default function PagamentosPage() {
  return <MarketplacePaymentsPanel mode="overview" />;
}
'@

$DisabledAsaasRoute = @'
import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error:
        "A criacao de contas Asaas foi desativada. Conecte uma conta Mercado Pago no painel.",
      code: "ASAAS_ACCOUNT_DISABLED",
    },
    { status: 410 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
'@

Save-Text "lib/mercado-pago.ts" $MercadoPagoLib
Save-Text "app/api/marketplace/payments/mercado-pago/connect/route.ts" $ConnectRoute
Save-Text "app/api/marketplace/payments/mercado-pago/callback/route.ts" $CallbackRoute
Save-Text "app/api/marketplace/payments/mercado-pago/disconnect/route.ts" $DisconnectRoute
Save-Text "app/painel/pagamentos/page.tsx" $PaymentsPage
Save-Text "app/api/payments/asaas/account/route.ts" $DisabledAsaasRoute

$PanelPath = "components/painel/MarketplacePaymentsPanel.tsx"
$Panel = Read-Text $PanelPath

$EffectMarker = '  useEffect(() => { load() }, [])'
$MessageMarker = 'Mercado Pago conectado. O checkout online da empresa pode ser configurado.'

if ($Panel.Contains($MessageMarker)) {
  Write-Host "[SEM ALTERACAO] mensagens OAuth do painel" -ForegroundColor Yellow
} elseif ($Panel.Contains($EffectMarker)) {
  $ExtraEffect = @'

  useEffect(() => {
    const mp = searchParams.get("mp");
    const providerMessage = searchParams.get("message");

    if (mp === "connected") {
      setMessage(
        "Mercado Pago conectado. O checkout online da empresa pode ser configurado.",
      );
      setError("");
    }

    if (mp === "error") {
      setError(
        providerMessage ||
          "Nao foi possivel concluir a conexao com o Mercado Pago.",
      );
      setMessage("");
    }
  }, [searchParams]);
'@

  $Panel = $Panel.Replace(
    $EffectMarker,
    $EffectMarker + $ExtraEffect
  )

  Save-Text $PanelPath $Panel
} else {
  throw "Marcador de useEffect nao encontrado em $PanelPath"
}

Add-EnvExample @(
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL"
)

Write-Host ""
Write-Host "==> Verificando variaveis carregadas do .env.local" -ForegroundColor Cyan

$EnvCheck = @'
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), true);
const names = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
console.table(
  names.map((name) => ({
    variavel: name,
    configurada: Boolean(String(process.env[name] || "").trim()),
    tamanho: String(process.env[name] || "").trim().length,
  })),
);
'@

& node -e $EnvCheck

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "FASE 1 CONCLUIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "OAuth Mercado Pago: restaurado com PKCE"
Write-Host "Tokens OAuth: criptografados"
Write-Host "Painel Pagamentos: Mercado Pago restaurado"
Write-Host "Conta Asaas: desativada"
Write-Host "Backup: $Backup"
Write-Host ""
Write-Host "Proximas fases:"
Write-Host "2. Assinatura transparente com 7 dias gratuitos"
Write-Host "3. Pix e cartao transparentes no marketplace"
