import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { signupMercadoPagoRequest } from "@/lib/payments/signup/mercado-pago";

type JsonRecord = Record<string, unknown>;
type SignupPlanKey = "essencial" | "profissional" | "premium";

const DAY_MS = 86_400_000;

export const SIGNUP_PLANS: Record<
  SignupPlanKey,
  {
    key: SignupPlanKey;
    name: string;
    price: number;
    description: string;
  }
> = {
  essencial: {
    key: "essencial",
    name: "Básico",
    price: 49.9,
    description: "Site, catálogo e pedidos.",
  },
  profissional: {
    key: "profissional",
    name: "Intermediário",
    price: 99.9,
    description: "Mais recursos para organizar e vender.",
  },
  premium: {
    key: "premium",
    name: "Premium",
    price: 149.9,
    description: "Recursos avançados para operações em crescimento.",
  },
};

function text(value: unknown) {
  return String(value || "").trim();
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function digits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function planKey(value: unknown): SignupPlanKey {
  const normalized = text(value).toLowerCase();

  if (normalized === "premium") return "premium";

  if (
    normalized === "profissional" ||
    normalized === "intermediario" ||
    normalized === "intermediário"
  ) {
    return "profissional";
  }

  return "essencial";
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Configuração segura do Supabase ausente.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function appUrl() {
  const candidates = [
    process.env.ORCALY_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "https://orcaly.com.br",
  ];

  for (const candidate of candidates) {
    const value = text(candidate).replace(/\/$/, "");

    if (!value) continue;

    try {
      const url = new URL(value);
      const localHost = [
        "localhost",
        "127.0.0.1",
        "::1",
      ].includes(url.hostname);

      if (url.protocol === "https:" && !localHost) {
        return url.origin;
      }
    } catch {
      // Ignora valores malformados e tenta a proxima URL publica.
    }
  }

  return "https://orcaly.com.br";
}

function signingKey() {
  const value = text(process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY);

  if (!value) {
    throw new Error("Chave de segurança do checkout ausente.");
  }

  return value;
}

function signaturePayload(leadId: string, expires: number) {
  return `${leadId}:${expires}`;
}

export function createSignupCheckoutToken(
  leadId: string,
  expires = Date.now() + 4 * 60 * 60 * 1000,
) {
  const token = createHmac("sha256", signingKey())
    .update(signaturePayload(leadId, expires))
    .digest("base64url");

  return { token, expires };
}

export function verifySignupCheckoutToken(
  leadId: string,
  expires: unknown,
  token: unknown,
) {
  const expiration = Number(expires || 0);
  const supplied = text(token);

  if (
    !leadId ||
    !supplied ||
    !Number.isFinite(expiration) ||
    expiration <= Date.now()
  ) {
    return false;
  }

  const expected = createHmac("sha256", signingKey())
    .update(signaturePayload(leadId, expiration))
    .digest();

  let received: Buffer;

  try {
    received = Buffer.from(supplied, "base64url");
  } catch {
    return false;
  }

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}

async function getLead(leadId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("signup_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw Object.assign(new Error("Cadastro não encontrado."), {
      status: 404,
    });
  }

  return { admin, lead: data as JsonRecord };
}

function checkoutSummary(lead: JsonRecord) {
  const raw = record(lead.raw_data);
  const selected = SIGNUP_PLANS[planKey(lead.plano)];
  const paymentMethod = text(raw.signup_payment_method);
  const paymentStatus = text(lead.payment_status || raw.signup_payment_status);
  const pix = record(raw.signup_pix);
  const subscription = record(raw.signup_subscription);

  return {
    leadId: text(lead.id),
    responsibleName: text(lead.nome_responsavel),
    companyName: text(lead.empresa_nome),
    email: text(lead.email),
    phone: text(lead.whatsapp),
    document: digits(
      raw.signup_document ||
        raw.cpf_cnpj ||
        raw.documento,
    ),
    plan: selected,
    status: text(lead.status),
    paymentMethod: paymentMethod || null,
    paymentStatus: paymentStatus || null,
    readyToCreateAccount:
      text(lead.status) === "trial_ready" ||
      text(lead.status) === "pago" ||
      text(lead.status) === "convertido",
    converted: text(lead.status) === "convertido",
    pix: {
      paymentId: text(pix.payment_id) || null,
      qrCode: text(pix.qr_code) || null,
      qrCodeBase64: text(pix.qr_code_base64) || null,
      ticketUrl: text(pix.ticket_url) || null,
      expirationDate: text(pix.expiration_date) || null,
    },
    subscription: {
      id: text(subscription.id) || null,
      status: text(subscription.status) || null,
      nextPaymentDate: text(subscription.next_payment_date) || null,
    },
  };
}

export async function loadSignupCheckout(
  leadId: string,
  expires: unknown,
  token: unknown,
) {
  if (!verifySignupCheckoutToken(leadId, expires, token)) {
    throw Object.assign(
      new Error("Este link de pagamento expirou. Volte ao cadastro e continue novamente."),
      { status: 401 },
    );
  }

  const { lead } = await getLead(leadId);
  return checkoutSummary(lead);
}

function mergeRawData(lead: JsonRecord, patch: JsonRecord) {
  return {
    ...record(lead.raw_data),
    ...patch,
  };
}

function pixFields(payment: JsonRecord) {
  const point = record(payment.point_of_interaction);
  const transaction = record(point.transaction_data);

  return {
    payment_id: text(payment.id),
    status: text(payment.status),
    qr_code: text(transaction.qr_code),
    qr_code_base64: text(transaction.qr_code_base64),
    ticket_url: text(transaction.ticket_url),
    expiration_date: text(payment.date_of_expiration),
  };
}

export async function createSignupPix(input: {
  leadId: string;
  expires: unknown;
  checkoutToken: unknown;
  document: unknown;
}) {
  if (
    !verifySignupCheckoutToken(
      input.leadId,
      input.expires,
      input.checkoutToken,
    )
  ) {
    throw Object.assign(new Error("Checkout expirado."), {
      status: 401,
    });
  }

  const { admin, lead } = await getLead(input.leadId);

  if (["pago", "trial_ready", "convertido"].includes(text(lead.status))) {
    return checkoutSummary(lead);
  }

  const raw = record(lead.raw_data);
  const existingPix = record(raw.signup_pix);
  const existingPaymentId = text(existingPix.payment_id);

  if (existingPaymentId) {
    const remote = await signupMercadoPagoRequest(
      `/v1/payments/${encodeURIComponent(existingPaymentId)}`,
    );

    const nextPix = pixFields(remote);
    const approved = text(remote.status) === "approved";

    await admin
      .from("signup_leads")
      .update({
        status: approved ? "pago" : "checkout_criado",
        payment_status: text(remote.status) || "pending",
        mercado_pago_payment_id: existingPaymentId,
        paid_at: approved ? new Date().toISOString() : null,
        raw_data: mergeRawData(lead, {
          signup_payment_method: "pix",
          signup_payment_status: text(remote.status) || "pending",
          signup_bonus_days: 7,
          signup_pix: nextPix,
        }),
      })
      .eq("id", input.leadId);

    const refreshed = await getLead(input.leadId);
    return checkoutSummary(refreshed.lead);
  }

  const selected = SIGNUP_PLANS[planKey(lead.plano)];
  const cpfCnpj = digits(
    input.document ||
      raw.signup_document ||
      raw.cpf_cnpj ||
      raw.documento,
  );

  if (![11, 14].includes(cpfCnpj.length)) {
    throw Object.assign(new Error("Informe um CPF ou CNPJ válido."), {
      status: 400,
    });
  }

  const idempotency = randomUUID();
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const payment = await signupMercadoPagoRequest(
    "/v1/payments",
    {
      method: "POST",
      body: JSON.stringify({
        transaction_amount: selected.price,
        description: `Plano ${selected.name} - Orçaly`,
        payment_method_id: "pix",
        external_reference: `signup_pix:${input.leadId}`,
        notification_url: `${appUrl()}/api/mercado-pago/webhook-leads`,
        date_of_expiration: expiration,
        payer: {
          email: text(lead.email),
          first_name: text(lead.nome_responsavel),
          identification: {
            type: cpfCnpj.length === 14 ? "CNPJ" : "CPF",
            number: cpfCnpj,
          },
        },
        metadata: {
          lead_id: input.leadId,
          origin: "signup",
          plan: selected.key,
          bonus_days: 7,
        },
      }),
    },
    idempotency,
  );

  const nextPix = pixFields(payment);

  await admin
    .from("signup_leads")
    .update({
      status: "checkout_criado",
      payment_status: text(payment.status) || "pending",
      mercado_pago_payment_id: text(payment.id) || null,
      checkout_url: null,
      raw_data: mergeRawData(lead, {
        signup_payment_method: "pix",
        signup_payment_status: text(payment.status) || "pending",
        signup_bonus_days: 7,
        signup_pix: nextPix,
      }),
    })
    .eq("id", input.leadId);

  const refreshed = await getLead(input.leadId);
  return checkoutSummary(refreshed.lead);
}

export async function createSignupCardSubscription(input: {
  leadId: string;
  expires: unknown;
  checkoutToken: unknown;
  cardTokenId: unknown;
  payerEmail: unknown;
}) {
  if (
    !verifySignupCheckoutToken(
      input.leadId,
      input.expires,
      input.checkoutToken,
    )
  ) {
    throw Object.assign(new Error("Checkout expirado."), {
      status: 401,
    });
  }

  const { admin, lead } = await getLead(input.leadId);

  if (["trial_ready", "convertido"].includes(text(lead.status))) {
    return checkoutSummary(lead);
  }

  const leadRaw = record(lead.raw_data);
  const existingPix = record(leadRaw.signup_pix);
  const existingPixId = text(existingPix.payment_id);
  const existingPixStatus = text(
    existingPix.status || lead.payment_status,
  ).toLowerCase();

  if (
    existingPixId &&
    !["rejected", "canceled", "cancelled", "expired"].includes(
      existingPixStatus,
    )
  ) {
    throw Object.assign(
      new Error(
        "Já existe um Pix aguardando pagamento. Conclua ou aguarde a expiração.",
      ),
      { status: 409 },
    );
  }

  const selected = SIGNUP_PLANS[planKey(lead.plano)];
  const cardTokenId = text(input.cardTokenId);
  const payerEmail = text(input.payerEmail || lead.email).toLowerCase();

  if (!cardTokenId) {
    throw Object.assign(
      new Error("Não foi possível validar o cartão."),
      { status: 400 },
    );
  }

  if (!payerEmail.includes("@")) {
    throw Object.assign(new Error("Informe um e-mail válido."), {
      status: 400,
    });
  }

  const subscription = await signupMercadoPagoRequest("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `Plano ${selected.name} - Orçaly`,
      external_reference: `signup_subscription:${input.leadId}:${selected.key}`,
      payer_email: payerEmail,
      card_token_id: cardTokenId,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: selected.price,
        currency_id: "BRL",
        free_trial: {
          frequency: 7,
          frequency_type: "days",
        },
      },
      back_url: `${appUrl()}/checkout/cadastro`,
      status: "authorized",
    }),
  });

  const remoteStatus = text(subscription.status) || "authorized";

  if (!text(subscription.id)) {
    throw Object.assign(
      new Error("O Mercado Pago não confirmou a assinatura."),
      { status: 502 },
    );
  }

  const raw = mergeRawData(lead, {
    signup_payment_method: "card",
    signup_payment_status: remoteStatus,
    signup_trial_days: 7,
    signup_subscription: {
      id: text(subscription.id),
      status: remoteStatus,
      next_payment_date: text(subscription.next_payment_date),
      payer_email: payerEmail,
    },
  });

  await admin
    .from("signup_leads")
    .update({
      status: "trial_ready",
      payment_status: remoteStatus,
      checkout_url: null,
      raw_data: raw,
    })
    .eq("id", input.leadId);

  const refreshed = await getLead(input.leadId);
  return checkoutSummary(refreshed.lead);
}

export async function refreshSignupCheckoutStatus(input: {
  leadId: string;
  expires: unknown;
  checkoutToken: unknown;
}) {
  if (
    !verifySignupCheckoutToken(
      input.leadId,
      input.expires,
      input.checkoutToken,
    )
  ) {
    throw Object.assign(new Error("Checkout expirado."), {
      status: 401,
    });
  }

  const { admin, lead } = await getLead(input.leadId);

  if (["trial_ready", "pago", "convertido"].includes(text(lead.status))) {
    return checkoutSummary(lead);
  }

  const raw = record(lead.raw_data);
  const pix = record(raw.signup_pix);
  const paymentId = text(pix.payment_id || lead.mercado_pago_payment_id);

  if (!paymentId) {
    return checkoutSummary(lead);
  }

  const payment = await signupMercadoPagoRequest(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
  );
  const status = text(payment.status) || "pending";
  const approved = status === "approved";

  await admin
    .from("signup_leads")
    .update({
      status: approved ? "pago" : "checkout_criado",
      payment_status: status,
      mercado_pago_payment_id: paymentId,
      paid_at: approved ? new Date().toISOString() : null,
      raw_data: mergeRawData(lead, {
        signup_payment_method: "pix",
        signup_payment_status: status,
        signup_bonus_days: 7,
        signup_pix: pixFields(payment),
      }),
    })
    .eq("id", input.leadId);

  const refreshed = await getLead(input.leadId);
  return checkoutSummary(refreshed.lead);
}
