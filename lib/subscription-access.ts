export type SubscriptionAccessInput = {
  assinatura_status?: string | null;
  assinatura_expira_em?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_used_at?: string | null;
  cancel_at_period_end?: boolean | null;
  access_until?: string | null;
  assinatura_cancelada_em?: string | null;
};

export type CompanySubscriptionAccess = {
  hasAccess: boolean;
  status: string;
  accessUntil: string | null;
  isTrial: boolean;
  isCancelled: boolean;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
};

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCompanySubscriptionAccess(
  company: SubscriptionAccessInput | null | undefined,
  now = new Date(),
): CompanySubscriptionAccess {
  const rawStatus = String(company?.assinatura_status || "expired").toLowerCase();
  const trialEndsAt = validDate(company?.trial_ends_at);
  const paidUntil = validDate(company?.access_until || company?.assinatura_expira_em);
  const isTrial = rawStatus === "trialing" && Boolean(trialEndsAt && trialEndsAt > now);
  const cancelAtPeriodEnd = Boolean(company?.cancel_at_period_end) || rawStatus === "cancel_at_period_end";
  const accessDate = isTrial ? trialEndsAt : paidUntil;
  const hasFutureAccess = Boolean(accessDate && accessDate > now);

  const status = isTrial
    ? "trialing"
    : cancelAtPeriodEnd && hasFutureAccess
      ? "cancel_at_period_end"
      : ["ativa", "active", "authorized"].includes(rawStatus) && hasFutureAccess
        ? "active"
        : ["pendente", "pending", "past_due"].includes(rawStatus) && hasFutureAccess
          ? "past_due"
          : ["cancelada", "cancelled", "canceled"].includes(rawStatus)
            ? "cancelled"
            : hasFutureAccess
              ? rawStatus
              : "expired";

  const diff = accessDate ? accessDate.getTime() - now.getTime() : 0;
  const daysRemaining = diff > 0 ? Math.max(1, Math.ceil(diff / 86_400_000)) : 0;

  return {
    hasAccess: hasFutureAccess,
    status,
    accessUntil: accessDate?.toISOString() || null,
    isTrial,
    isCancelled: status === "cancelled" || status === "cancel_at_period_end",
    cancelAtPeriodEnd,
    daysRemaining,
  };
}
