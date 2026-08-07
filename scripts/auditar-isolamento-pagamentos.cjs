const { loadEnvConfig } = require("@next/env");
const fs = require("node:fs");
const path = require("node:path");

loadEnvConfig(process.cwd(), true);

const groups = {
  cadastro: [
    "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY",
    "MP_SIGNUP_ACCESS_TOKEN",
    "MP_SIGNUP_WEBHOOK_SECRET",
  ],
  assinatura: [
    "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY",
    "MP_SUBSCRIPTION_ACCESS_TOKEN",
    "MP_SUBSCRIPTION_WEBHOOK_SECRET",
  ],
  marketplace: [
    "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY",
    "MP_MARKETPLACE_CLIENT_ID",
    "MP_MARKETPLACE_CLIENT_SECRET",
    "MP_MARKETPLACE_REDIRECT_URI",
    "MP_MARKETPLACE_WEBHOOK_SECRET",
  ],
};

const legacyCredentialNames = [
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
];

const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];

  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }

  return result;
}

let structuralFailures = 0;

console.log("\n[FRONTEIRAS DE CREDENCIAIS]");

for (const root of sourceRoots) {
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, "utf8");

    for (const legacy of legacyCredentialNames) {
      if (content.includes(`process.env.${legacy}`) || content.includes(`process.env["${legacy}"]`) || content.includes(`process.env['${legacy}']`)) {
        console.error(`[FALHA] ${file} ainda usa ${legacy}`);
        structuralFailures += 1;
      }
    }
  }
}

const requiredOwnership = [
  {
    file: "lib/payments/signup/mercado-pago.ts",
    required: ["MP_SIGNUP_ACCESS_TOKEN", "MP_SIGNUP_WEBHOOK_SECRET"],
    forbidden: ["MP_SUBSCRIPTION_", "MP_MARKETPLACE_"],
  },
  {
    file: "lib/payments/subscription/mercado-pago.ts",
    required: ["MP_SUBSCRIPTION_ACCESS_TOKEN", "MP_SUBSCRIPTION_WEBHOOK_SECRET"],
    forbidden: ["MP_SIGNUP_", "MP_MARKETPLACE_"],
  },
  {
    file: "lib/payments/marketplace/config.ts",
    required: [
      "MP_MARKETPLACE_CLIENT_ID",
      "MP_MARKETPLACE_CLIENT_SECRET",
      "MP_MARKETPLACE_WEBHOOK_SECRET",
    ],
    forbidden: ["MP_SIGNUP_", "MP_SUBSCRIPTION_", "MP_MARKETPLACE_ACCESS_TOKEN"],
  },
];

for (const check of requiredOwnership) {
  const content = fs.readFileSync(check.file, "utf8");

  for (const required of check.required) {
    if (!content.includes(required)) {
      console.error(`[FALHA] ${check.file} nÃ£o contÃ©m ${required}`);
      structuralFailures += 1;
    }
  }

  for (const forbidden of check.forbidden) {
    if (content.includes(forbidden)) {
      console.error(`[FALHA] ${check.file} mistura credencial ${forbidden}`);
      structuralFailures += 1;
    }
  }
}

const signupWebhook = fs.readFileSync(
  "app/api/mercado-pago/webhook-leads/route.ts",
  "utf8",
);

if (!signupWebhook.includes("getSignupWebhookSecret")) {
  console.error("[FALHA] webhook de cadastro nÃ£o usa MP_SIGNUP_WEBHOOK_SECRET");
  structuralFailures += 1;
}

if (/export\s+async\s+function\s+GET\s*\([^)]*request/.test(signupWebhook)) {
  console.error("[FALHA] webhook de cadastro ainda possui GET capaz de receber request");
  structuralFailures += 1;
}

const subscriptionWebhook = fs.readFileSync(
  "app/api/mercado-pago/webhook/route.ts",
  "utf8",
);

if (!subscriptionWebhook.includes("getSubscriptionWebhookSecret")) {
  console.error("[FALHA] webhook de assinatura nÃ£o usa MP_SUBSCRIPTION_WEBHOOK_SECRET");
  structuralFailures += 1;
}

const marketplaceWebhook = fs.readFileSync(
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "utf8",
);

if (!marketplaceWebhook.includes("getMarketplaceWebhookSecret")) {
  console.error("[FALHA] webhook do marketplace nÃ£o usa MP_MARKETPLACE_WEBHOOK_SECRET");
  structuralFailures += 1;
}

console.log(
  structuralFailures
    ? `\nPAYMENT_CREDENTIAL_BOUNDARIES_EXIT=1 (${structuralFailures} falhas)`
    : "\nPAYMENT_CREDENTIAL_BOUNDARIES_EXIT=0",
);

if (process.argv.includes("--check-env")) {
  let missing = 0;

  console.log("\n[CREDENCIAIS DO AMBIENTE LOCAL]");

  for (const [group, names] of Object.entries(groups)) {
    console.log(`\n[${group.toUpperCase()}]`);

    for (const name of names) {
      const value = String(process.env[name] || "").trim();

      console.log(
        `${value ? "[OK]" : "[FALTA]"} ${name} ` +
          `(configurada=${Boolean(value)}, tamanho=${value.length})`,
      );

      if (!value) missing += 1;
    }
  }

  if (missing) {
    console.error(`\nPAYMENT_ENV_EXIT=1 (${missing} ausentes)`);
    process.exit(1);
  }

  console.log("\nPAYMENT_ENV_EXIT=0");
}

process.exit(structuralFailures ? 1 : 0);