import fs from "node:fs";

const checks = [
  {
    file: "app/api/checkout/plano/route.ts",
    forbidden: [
      "asaasPost",
      "route.mercado-pago",
      "getDefaultPaymentProvider",
    ],
    required: ["LEGACY_PAYMENT_ROUTE_DISABLED"],
  },
  {
    file: "lib/subscription-service.ts",
    forbidden: [
      "async function claimTrial",
      "autoRecurring.free_trial",
      "freeTrialDays",
      'status: "subscription_error"',
    ],
    required: [
      "buildSubscriptionReference",
      "parseSubscriptionReference",
    ],
  },
  {
    file: "lib/subscription-mercado-pago-transparent.ts",
    forbidden: [
      "function normalizePlan(",
      "orcaly_subscription:${companyId}",
      "autoRecurring.free_trial",
      'status: "subscription_error"',
    ],
    required: [
      "normalizePlanKey",
      "buildSubscriptionReference",
    ],
  },
  {
    file: "lib/subscription-checkout-payment.ts",
    forbidden: [
      "function normalizePlan(",
      "orcaly_subscription_checkout:${companyId}",
      'status: "approval_error"',
      'status: "error"',
    ],
    required: [
      "normalizePlanKey",
      "buildSubscriptionReference",
      "idempotency_key",
    ],
  },
];

let failed = false;

for (const check of checks) {
  const content = fs.readFileSync(check.file, "utf8");

  for (const value of check.forbidden) {
    if (content.includes(value)) {
      console.error(`[FALHA] ${check.file}: ainda contÃ©m ${value}`);
      failed = true;
    }
  }

  for (const value of check.required) {
    if (!content.includes(value)) {
      console.error(`[FALHA] ${check.file}: nÃ£o contÃ©m ${value}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);

console.log(
  "Contratos validados: rota legada isolada, trial fora da renovaÃ§Ã£o, referÃªncias versionadas e status canÃ´nicos.",
);
