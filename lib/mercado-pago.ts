import "server-only";
// ORCALY_SECURITY_HARDENING_V1
import crypto from "node:crypto";
import {
  decryptPaymentCredential,
  encryptPaymentCredential,
} from "@/lib/payments/credential-encryption";
import {
  getMarketplaceClientId,
  getMarketplaceClientSecret,
  getMarketplaceRedirectUriOverride,
} from "@/lib/payments/marketplace/config";

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
    getMarketplaceRedirectUriOverride(),
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
  const clientId = getMarketplaceClientId();
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
        client_secret: getMarketplaceClientSecret(),
        client_id: getMarketplaceClientId(),
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
        client_secret: getMarketplaceClientSecret(),
        client_id: getMarketplaceClientId(),
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
  toleranceSeconds?: number;
}) {
  const {
    xSignature,
    xRequestId,
    dataId,
    secret,
    toleranceSeconds = 600,
  } = options;

  if (!secret || !xSignature || !xRequestId || !dataId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const ts = String(parts.ts || "");
  const v1 = String(parts.v1 || "");

  if (!/^\d{10,13}$/.test(ts) || !/^[a-f0-9]{64}$/i.test(v1)) {
    return false;
  }

  const timestamp = Number(ts);
  const timestampMs = ts.length >= 13 ? timestamp : timestamp * 1000;

  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > toleranceSeconds * 1000
  ) {
    return false;
  }

  const manifest =
    `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(v1, "hex"),
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
