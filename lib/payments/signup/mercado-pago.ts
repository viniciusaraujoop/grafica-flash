import "server-only";

type JsonRecord = Record<string, unknown>;

const text = (value: unknown) => String(value || "").trim();

export function getSignupAccessToken() {
  const token = text(process.env.MP_SIGNUP_ACCESS_TOKEN)
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    throw Object.assign(
      new Error("MP_SIGNUP_ACCESS_TOKEN não está configurado para o checkout de cadastro."),
      { status: 500 },
    );
  }

  return token;
}

export function getSignupWebhookSecret() {
  return text(process.env.MP_SIGNUP_WEBHOOK_SECRET);
}

function friendlyMercadoPagoMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("invalid user identification number") ||
    normalized.includes("invalid identification number")
  ) {
    return "CPF/CNPJ inválido. Confira os números informados.";
  }

  return message;
}

export async function signupMercadoPagoRequest(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${getSignupAccessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;

  if (!response.ok) {
    const providerMessage = String(
      payload.message ||
        payload.error_description ||
        payload.error ||
        `Mercado Pago retornou HTTP ${response.status}.`,
    );
    const message = friendlyMercadoPagoMessage(providerMessage);

    throw Object.assign(new Error(message), {
      status: response.status,
      providerPayload: payload,
      paymentFlow: "signup",
    });
  }

  return payload;
}