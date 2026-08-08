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
      `Credencial Asaas ${environment} nÃ£o configurada.`,
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