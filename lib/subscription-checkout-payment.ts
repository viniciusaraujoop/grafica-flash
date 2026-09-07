// ORCALY_AFFILIATE_INTEGRATION_V1
import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  buildSubscriptionReference,
  normalizePlanKey,
  parseSubscriptionReference,
} from "@/lib/payments/core/contracts";
import {
  createMercadoPagoPayment,
  getMercadoPagoPayment,
  mapMercadoPagoStatus,
} from "@/lib/mercado-pago";
import {
  applyApprovedSubscriptionPayment,
  getAppUrl,
  getPlatformAccessToken,
  getSupabaseAdmin,
  ORCALY_PLANS,
  resolveSubscriptionContext,
} from "@/lib/subscription-service";
import {
  reverseAffiliateCommissionForPayment,
} from "@/lib/affiliates/server";

type JsonRecord = Record<string, unknown>;

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

function paymentKind(
  paymentTypeId: unknown,
  paymentMethodId: unknown,
  selectedPaymentMethod?: unknown,
) {
  const type = text(paymentTypeId).toLowerCase();
  const method = text(paymentMethodId).toLowerCase();
  const selected = text(selectedPaymentMethod).toLowerCase();

  if (
    type === "credit_card" ||
    type === "debit_card" ||
    type === "prepaid_card" ||
    selected.includes("credit") ||
    selected.includes("debit") ||
    selected.includes("card")
  ) {
    return "card" as const;
  }

  if (
    method === "pix" ||
    type === "bank_transfer" ||
    selected.includes("pix") ||
    selected.includes("bank_transfer")
  ) {
    return "pix" as const;
  }

  return "other" as const;
}

function pixData(payment: JsonRecord) {
  const point = record(payment.point_of_interaction);
  const transaction = record(point.transaction_data);

  return {
    paymentId: text(payment.id),
    qrCode: text(transaction.qr_code),
    qrCodeBase64: text(transaction.qr_code_base64),
    ticketUrl: text(transaction.ticket_url),
    expirationDate: text(payment.date_of_expiration),
  };
}

function statusCode(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

async function getPaymentRow(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  paymentRowId: string,
) {
  const { data, error } = await admin
    .from("plan_payments")
    .select("*")
    .eq("id", paymentRowId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw Object.assign(new Error("Pagamento não encontrado."), {
      status: 404,
    });
  }

  return data as JsonRecord;
}

async function getCompany(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  companyId: string,
) {
  const { data, error } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw Object.assign(new Error("Empresa não encontrada."), {
      status: 404,
    });
  }

  return data as JsonRecord;
}

async function persistRemoteStatus(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  row: JsonRecord,
  company: JsonRecord,
  payment: JsonRecord,
) {
  const remoteStatus = text(payment.status) || "pending";
  const mappedStatus = mapMercadoPagoStatus(remoteStatus);
  const rowId = text(row.id);
  const companyId = text(company.id);
  const paymentId = text(payment.id);
  const kind = paymentKind(
    payment.payment_type_id,
    payment.payment_method_id,
  );
  const alreadyApproved = ["approved", "paid"].includes(
    text(row.status).toLowerCase(),
  );

  if (remoteStatus !== "approved") {
    if (
      alreadyApproved &&
      ["refunded", "charged_back", "cancelled", "canceled"].includes(
        remoteStatus,
      )
    ) {
      await reverseAffiliateCommissionForPayment(
        admin,
        paymentId,
        `Pagamento ${remoteStatus} no Mercado Pago.`,
      ).catch((affiliateError) => {
        console.error(
          "orcaly_affiliate_reversal_error",
          affiliateError instanceof Error
            ? affiliateError.message
            : affiliateError,
        );
      });
    }

    await admin
      .from("plan_payments")
      .update({
        status: mappedStatus,
        mercado_pago_payment_id: paymentId || null,
        payment_method: text(payment.payment_method_id) || null,
        raw_payment: payment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .eq("company_id", companyId);

    return {
      status: mappedStatus,
      providerStatus: remoteStatus,
      paymentId,
      kind,
      pix: kind === "pix" ? pixData(payment) : null,
    };
  }

  if (!alreadyApproved) {
    const currentStatus = text(row.status) || "creating";

    const { data: claimed, error: claimError } = await admin
      .from("plan_payments")
      .update({
        status: "applying",
        mercado_pago_payment_id: paymentId || null,
        payment_method: text(payment.payment_method_id) || null,
        raw_payment: payment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
      .eq("company_id", companyId)
      .eq("status", currentStatus)
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;

    if (claimed?.id) {
      try {
        await applyApprovedSubscriptionPayment(admin, company, {
          plan: row.plano,
          providerReference: paymentId,
          paymentType: kind === "card" ? "card" : "pix",
          amount: Number(payment.transaction_amount || row.valor || 0),
        });

        await admin
          .from("plan_payments")
          .update({
            status: "paid",
            mercado_pago_payment_id: paymentId || null,
            payment_method: text(payment.payment_method_id) || null,
            raw_payment: payment,
            paid_at:
              text(payment.date_approved) ||
              new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId)
          .eq("company_id", companyId);
      } catch (error) {
        await admin
          .from("plan_payments")
          .update({
            status: "failed",
            raw_payment: payment,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId)
          .eq("company_id", companyId);

        throw error;
      }
    }
  }

  return {
    status: "paid",
    providerStatus: remoteStatus,
    paymentId,
    kind,
    pix: kind === "pix" ? pixData(payment) : null,
  };
}

function parseReference(value: unknown) {
  const parsed = parseSubscriptionReference(value);

  if (!parsed || parsed.kind !== "checkout" || !parsed.paymentRowId) {
    return null;
  }

  return {
    kind: parsed.kind,
    companyId: parsed.companyId,
    plan: parsed.plan,
    paymentRowId: parsed.paymentRowId,
  };
}

export async function createSubscriptionCheckoutPayment(
  request: NextRequest,
) {
  const context = await resolveSubscriptionContext(request);

  if (!context.user) {
    throw Object.assign(new Error("Não autorizado."), {
      status: 401,
    });
  }

  if (!context.company?.id) {
    throw Object.assign(new Error("Empresa não encontrada."), {
      status: 404,
    });
  }

  if (!context.canManage) {
    throw Object.assign(
      new Error("Você não possui permissão para pagar a assinatura."),
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as JsonRecord;
  const formData = record(body.formData);
  const payer = record(formData.payer);
  const identification = record(payer.identification);
  const company = context.company as JsonRecord;
  const companyId = text(company.id);
  const planKey = normalizePlanKey(
    body.plan || company.assinatura_plano || company.plano,
  );
  const plan = ORCALY_PLANS[planKey];
  const paymentMethodId = text(formData.payment_method_id);
  const paymentTypeId = text(formData.payment_type_id);
  const kind = paymentKind(
    paymentTypeId,
    paymentMethodId,
    body.selectedPaymentMethod ||
      formData.selected_payment_method,
  );
  const payerEmail = text(
    payer.email || company.email || context.user.email,
  ).toLowerCase();

  if (!paymentMethodId) {
    throw Object.assign(
      new Error("Escolha uma forma de pagamento."),
      { status: 400 },
    );
  }

  if (!payerEmail || !payerEmail.includes("@")) {
    throw Object.assign(new Error("Informe um e-mail válido."), {
      status: 400,
    });
  }

  if (kind === "other") {
    throw Object.assign(
      new Error("Essa forma de pagamento não está disponível."),
      { status: 400 },
    );
  }

  const token = text(formData.token);

  if (kind === "card" && !token) {
    throw Object.assign(
      new Error("Não foi possível validar o cartão."),
      { status: 400 },
    );
  }

  const { data: paymentRow, error: paymentError } =
    await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "created",
        tipo: kind === "pix" ? "pix_avulso" : "card_avulso",
        payment_method: paymentMethodId,
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("id")
      .single();

  if (paymentError || !paymentRow?.id) {
    throw Object.assign(
      new Error(
        paymentError?.message ||
          "Não foi possível preparar o pagamento.",
      ),
      { status: 500 },
    );
  }

  const paymentRowId = text(paymentRow.id);
  const externalReference = buildSubscriptionReference({
    kind: "checkout",
    companyId,
    plan: planKey,
    paymentRowId,
  });
  const idempotencyKey =
    text(request.headers.get("idempotency-key")) || randomUUID();

  const { error: referenceError } = await context.admin
    .from("plan_payments")
    .update({
      provider: "mercado_pago",
      external_reference: externalReference,
      idempotency_key: idempotencyKey,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentRowId)
    .eq("company_id", companyId);

  if (referenceError) {
    throw referenceError;
  }

  const payload: JsonRecord = {
    transaction_amount: plan.price,
    description: `Plano ${plan.name} - Orçaly`,
    external_reference: externalReference,
    payment_method_id: paymentMethodId,
    notification_url:
      `${getAppUrl()}/api/assinatura/checkout/webhook`,
    metadata: {
      company_id: companyId,
      plan: planKey,
      plan_payment_id: paymentRowId,
      payment_kind: kind,
    },
    payer: {
      email: payerEmail,
      identification: {
        type:
          text(identification.type) ||
          (digits(identification.number).length === 14
            ? "CNPJ"
            : "CPF"),
        number: digits(identification.number),
      },
    },
  };

  if (kind === "pix") {
    payload.date_of_expiration = new Date(
      Date.now() + 30 * 60 * 1000,
    ).toISOString();
  } else {
    payload.token = token;
    payload.installments = Math.max(
      1,
      Number(formData.installments || 1),
    );

    if (text(formData.issuer_id)) {
      payload.issuer_id = text(formData.issuer_id);
    }
  }

  try {
    const payment = (await createMercadoPagoPayment(
      getPlatformAccessToken(),
      payload,
      idempotencyKey,
    )) as JsonRecord;

    const row = await getPaymentRow(context.admin, paymentRowId);

    return await persistRemoteStatus(
      context.admin,
      row,
      company,
      payment,
    );
  } catch (error) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRowId)
      .eq("company_id", companyId);

    throw error;
  }
}

export async function getSubscriptionCheckoutPaymentStatus(
  request: NextRequest,
  paymentId: string,
) {
  const context = await resolveSubscriptionContext(request);

  if (!context.user) {
    throw Object.assign(new Error("Não autorizado."), {
      status: 401,
    });
  }

  if (!context.company?.id) {
    throw Object.assign(new Error("Empresa não encontrada."), {
      status: 404,
    });
  }

  const companyId = text(context.company.id);

  const { data: row, error } = await context.admin
    .from("plan_payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("mercado_pago_payment_id", paymentId)
    .maybeSingle();

  if (error) throw error;

  if (!row) {
    throw Object.assign(new Error("Pagamento não encontrado."), {
      status: 404,
    });
  }

  if (["approved", "paid"].includes(text(row.status).toLowerCase())) {
    return {
      status: "paid",
      providerStatus: "approved",
      paymentId,
      kind:
        text(row.tipo).includes("card") ? "card" : "pix",
      pix: null,
    };
  }

  const payment = (await getMercadoPagoPayment(
    getPlatformAccessToken(),
    paymentId,
  )) as JsonRecord;

  return persistRemoteStatus(
    context.admin,
    row as JsonRecord,
    context.company as JsonRecord,
    payment,
  );
}

export async function processSubscriptionCheckoutWebhook(
  paymentId: string,
) {
  if (!paymentId) {
    return {
      received: true,
      ignored: true,
      reason: "Pagamento ausente.",
    };
  }

  const payment = (await getMercadoPagoPayment(
    getPlatformAccessToken(),
    paymentId,
  )) as JsonRecord;
  const parsed = parseReference(payment.external_reference);

  if (!parsed) {
    return {
      received: true,
      ignored: true,
      reason: "Pagamento não pertence ao checkout de assinatura.",
    };
  }

  const admin = getSupabaseAdmin();

  const row = await getPaymentRow(admin, parsed.paymentRowId);
  const company = await getCompany(admin, parsed.companyId);

  if (text(row.company_id) !== parsed.companyId) {
    return {
      received: true,
      ignored: true,
      reason: "Pagamento sem vínculo válido.",
    };
  }

  const result = await persistRemoteStatus(
    admin,
    row,
    company,
    payment,
  );

  return {
    received: true,
    ...result,
  };
}

export { statusCode as subscriptionCheckoutStatusCode };
