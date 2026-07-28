const { loadEnvConfig } = require("@next/env");

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

let missing = 0;

for (const [group, names] of Object.entries(groups)) {
  console.log(`\n[${group.toUpperCase()}]`);

  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    const required = !name.endsWith("_WEBHOOK_SECRET");
    console.log(
      `${value ? "[OK]" : required ? "[FALTA]" : "[AVISO]"} ${name} ` +
        `(configurada=${Boolean(value)}, tamanho=${value.length})`,
    );
    if (required && !value) missing += 1;
  }
}

console.log(`\nISOLATED_PAYMENT_ENV_EXIT=${missing ? 1 : 0}`);
process.exit(missing ? 1 : 0);
