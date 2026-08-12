import "server-only";
import {
  getAppUrl,
  mercadoPagoPlatformRequest,
} from "@/lib/subscription-service";

export type FounderPlanKey =
  | "basico"
  | "profissional"
  | "premium";

type JsonRecord = Record<string, unknown>;

export const FOUNDER_BILLING_PLANS: Record<
  FounderPlanKey,
  {
    name: string;
    founderPriceCents: number;
    normalPriceCents: number;
  }
> = {
  basico: {
    name: "Básico",
    founderPriceCents: 3490,
    normalPriceCents: 4990,
  },
  profissional: {
    name: "Profissional",
    founderPriceCents: 6990,
    normalPriceCents: 9990,
  },
  premium: {
    name: "Premium",
    founderPriceCents: 9990,
    normalPriceCents: 14990,
  },
};

export function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeFounderBillingPlan(
  value: unknown,
): FounderPlanKey {
  const plan = text(value).toLowerCase();

  if (plan === "premium") return "premium";

  if (
    plan === "profissional" ||
    plan === "intermediario" ||
    plan === "intermediário"
  ) {
    return "profissional";
  }

  return "basico";
}

export function providerAmountCents(
  subscription: unknown,
) {
  const source = record(subscription);
  const autoRecurring = record(source.auto_recurring);
  const value = Number(autoRecurring.transaction_amount);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

export function providerStatus(subscription: unknown) {
  return text(record(subscription).status || "pending")
    .toLowerCase();
}

export function providerCheckoutUrl(
  subscription: unknown,
) {
  const source = record(subscription);

  return (
    text(source.init_point) ||
    text(source.sandbox_init_point) ||
    null
  );
}

export function providerNextPaymentDate(
  subscription: unknown,
) {
  const value = text(record(subscription).next_payment_date);
  return value || null;
}

export function isClosedSubscription(
  subscription: unknown,
) {
  return ["canceled", "cancelled"].includes(
    providerStatus(subscription),
  );
}

export async function getFounderProviderSubscription(
  subscriptionId: string,
) {
  return record(
    await mercadoPagoPlatformRequest(
      `/preapproval/${encodeURIComponent(
        subscriptionId,
      )}`,
    ),
  );
}

export async function findRecoverableFounderSubscription(
  externalReference: string,
) {
  const result = record(
    await mercadoPagoPlatformRequest(
      `/preapproval/search?q=${encodeURIComponent(
        externalReference,
      )}&limit=20&offset=0`,
    ),
  );

  const rows = Array.isArray(result.results)
    ? result.results.map(record)
    : [];

  const exact = rows.filter(
    (item) =>
      text(item.external_reference) ===
        externalReference &&
      !isClosedSubscription(item),
  );

  if (exact.length > 1) {
    throw new Error(
      "FOUNDER_BILLING_DUPLICATE_PROVIDER_SUBSCRIPTIONS",
    );
  }

  return exact[0] || null;
}

export async function createFounderProviderSubscription(args: {
  plan: FounderPlanKey;
  payerEmail: string;
  planPaymentId: string;
  effectivePriceCents: number;
  billingStartAt: string | null;
}) {
  const plan = FOUNDER_BILLING_PLANS[args.plan];
  const autoRecurring: JsonRecord = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: args.effectivePriceCents / 100,
    currency_id: "BRL",
  };

  if (args.billingStartAt) {
    const start = new Date(args.billingStartAt);

    if (
      !Number.isNaN(start.getTime()) &&
      start.getTime() > Date.now() + 60_000
    ) {
      autoRecurring.start_date = start.toISOString();
    }
  }

  return record(
    await mercadoPagoPlatformRequest("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `Plano ${plan.name} Founder - Orçaly`,
        external_reference: args.planPaymentId,
        payer_email: args.payerEmail,
        back_url:
          `${getAppUrl()}/painel/assinatura?founder=retorno`,
        notification_url:
          `${getAppUrl()}/api/mercado-pago/webhook`,
        auto_recurring: autoRecurring,
        status: "pending",
      }),
    }),
  );
}

export async function updateFounderSubscriptionToNormalPrice(
  subscriptionId: string,
  normalPriceCents: number,
) {
  return record(
    await mercadoPagoPlatformRequest(
      `/preapproval/${encodeURIComponent(
        subscriptionId,
      )}`,
      {
        method: "PUT",
        body: JSON.stringify({
          auto_recurring: {
            transaction_amount:
              normalPriceCents / 100,
            currency_id: "BRL",
          },
        }),
      },
    ),
  );
}
