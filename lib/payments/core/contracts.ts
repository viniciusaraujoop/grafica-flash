export type PlanKey = "basico" | "profissional" | "premium";

export type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "canceled"
  | "expired"
  | "refunded"
  | "charged_back";

export type SubscriptionReferenceKind =
  | "recurring"
  | "pix"
  | "checkout";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const PLAN_ALIASES: Record<string, PlanKey> = {
  basico: "basico",
  "bÃ¡sico": "basico",
  essencial: "basico",
  profissional: "profissional",
  intermediario: "profissional",
  "intermediÃ¡rio": "profissional",
  premium: "premium",
};

export function normalizePlanKey(
  value: unknown,
  fallback: PlanKey = "profissional",
): PlanKey {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return PLAN_ALIASES[normalized] || fallback;
}

export function normalizeSubscriptionProviderStatus(
  value: unknown,
): PaymentStatus {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (status === "authorized") return "authorized";

  if (status === "approved" || status === "paid") {
    return "paid";
  }

  if (status === "canceled" || status === "cancelled") {
    return "canceled";
  }

  if (status === "refunded") return "refunded";
  if (status === "charged_back") return "charged_back";

  if (
    status === "rejected" ||
    status === "failed" ||
    status === "error" ||
    status === "paused"
  ) {
    return "failed";
  }

  return "pending";
}

export function buildSubscriptionReference(options: {
  kind: SubscriptionReferenceKind;
  companyId: string;
  plan: PlanKey;
  paymentRowId: string;
}) {
  return [
    "orcaly",
    "v1",
    "subscription",
    options.kind,
    options.companyId,
    options.plan,
    options.paymentRowId,
  ].join(":");
}

export function parseSubscriptionReference(value: unknown): {
  kind: SubscriptionReferenceKind;
  companyId: string;
  plan: PlanKey;
  paymentRowId: string | null;
} | null {
  const raw = String(value || "").trim();
  const parts = raw.split(":");

  if (
    parts[0] === "orcaly" &&
    parts[1] === "v1" &&
    parts[2] === "subscription" &&
    ["recurring", "pix", "checkout"].includes(parts[3])
  ) {
    const companyId = parts[4] || "";
    const plan = normalizePlanKey(parts[5]);
    const paymentRowId = parts[6] || null;

    if (!isUuid(companyId)) return null;

    return {
      kind: parts[3] as SubscriptionReferenceKind,
      companyId,
      plan,
      paymentRowId,
    };
  }

  if (parts[0] === "orcaly_subscription") {
    if (!isUuid(parts[1] || "")) return null;

    return {
      kind: "recurring",
      companyId: parts[1],
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  if (parts[0] === "orcaly_subscription_pix") {
    if (!isUuid(parts[1] || "")) return null;

    return {
      kind: "pix",
      companyId: parts[1],
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  if (parts[0] === "orcaly_subscription_checkout") {
    if (!isUuid(parts[1] || "")) return null;

    return {
      kind: "checkout",
      companyId: parts[1],
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  return null;
}
