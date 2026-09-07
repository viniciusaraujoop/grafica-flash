import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const shouldCommit = args.has("--commit");
const shouldPush = args.has("--push");

if (shouldPush && !shouldCommit) {
  throw new Error("--push exige também --commit.");
}

const branchName = "fix/unify-payment-flows-phase-1";
const commitMessage = "Unifica contratos dos fluxos de pagamento - fase 1";
const root = process.cwd();

function step(message) {
  process.stdout.write(`\n==> ${message}\n`);
}

function run(command, commandArgs = [], options = {}) {
  const { capture = false, ...execOptions } = options;
  const result = execFileSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...execOptions,
  });

  return typeof result === "string" ? result.trim() : "";
}

function read(relativePath) {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function write(relativePath, content) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content.replace(/\r\n/g, "\n"), "utf8");
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Arquivo obrigatório não encontrado: ${relativePath}`);
  }
}

function replaceExact(relativePath, oldValue, newValue, label) {
  const content = read(relativePath);
  const occurrences = content.split(oldValue).length - 1;

  if (occurrences !== 1) {
    throw new Error(
      `${relativePath}: esperado 1 trecho para "${label}", encontrado ${occurrences}.`,
    );
  }

  write(relativePath, content.replace(oldValue, newValue));
  console.log(`  [OK] ${label}`);
}

function replaceRegex(relativePath, pattern, replacement, label) {
  const content = read(relativePath);
  const matches = content.match(new RegExp(pattern.source, pattern.flags));

  if (!matches) {
    throw new Error(
      `${relativePath}: trecho não encontrado para "${label}".`,
    );
  }

  const globalPattern = pattern.flags.includes("g")
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`);
  const count = [...content.matchAll(globalPattern)].length;

  if (count !== 1) {
    throw new Error(
      `${relativePath}: esperado 1 trecho para "${label}", encontrado ${count}.`,
    );
  }

  write(relativePath, content.replace(pattern, replacement));
  console.log(`  [OK] ${label}`);
}

function backupFiles(files) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const backupRoot = path.join(
    root,
    ".orcaly-backups",
    `payment-flow-phase1-${timestamp}`,
  );

  for (const file of files) {
    const source = path.join(root, file);
    const destination = path.join(backupRoot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }

  return path.relative(root, backupRoot);
}

for (const command of ["git", "node", "npm", "npx"]) {
  try {
    run(command, ["--version"], { capture: true });
  } catch {
    throw new Error(`Comando obrigatório não encontrado: ${command}`);
  }
}

if (!fs.existsSync(path.join(root, ".git"))) {
  throw new Error(
    "Execute o PowerShell na raiz do repositório grafica-flash.",
  );
}

const requiredFiles = [
  "package.json",
  "lib/subscription-service.ts",
  "lib/subscription-mercado-pago-transparent.ts",
  "lib/subscription-checkout-payment.ts",
  "app/api/checkout/plano/route.ts",
  "app/api/mercado-pago/webhook/route.ts",
];

requiredFiles.forEach(assertFile);

const packageJson = JSON.parse(read("package.json"));
if (packageJson.name !== "grafica-flash") {
  throw new Error(
    "O package.json atual não parece pertencer ao projeto grafica-flash.",
  );
}

step("Preparando branch");
const currentBranch = run("git", ["branch", "--show-current"], {
  capture: true,
});

if (["main", "master"].includes(currentBranch)) {
  const existing = run("git", ["branch", "--list", branchName], {
    capture: true,
  });

  if (existing) {
    run("git", ["switch", branchName]);
  } else {
    run("git", ["switch", "-c", branchName]);
  }
} else if (currentBranch !== branchName) {
  throw new Error(
    `Branch atual: ${currentBranch}. Execute a partir de main/master ou de ${branchName}.`,
  );
}

console.log(
  `Branch de trabalho: ${run("git", ["branch", "--show-current"], {
    capture: true,
  })}`,
);

step("Criando backup local");
const backupRoot = backupFiles(requiredFiles);
console.log(`Backup: ${backupRoot}`);

step("Criando contrato canônico de pagamentos");
write(
  "lib/payments/core/contracts.ts",
  `export type PlanKey = "basico" | "profissional" | "premium";

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
  "básico": "basico",
  essencial: "basico",
  profissional: "profissional",
  intermediario: "profissional",
  "intermediário": "profissional",
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
      companyId: parts[1] || "",
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  if (parts[0] === "orcaly_subscription_pix") {
    if (!isUuid(parts[1] || "")) return null;

    return {
      kind: "pix",
      companyId: parts[1] || "",
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  if (parts[0] === "orcaly_subscription_checkout") {
    if (!isUuid(parts[1] || "")) return null;

    return {
      kind: "checkout",
      companyId: parts[1] || "",
      plan: normalizePlanKey(parts[2]),
      paymentRowId: parts[3] || null,
    };
  }

  return null;
}
`,
);
console.log("  [OK] lib/payments/core/contracts.ts");

step("Neutralizando a rota legada de checkout");
write(
  "app/api/checkout/plano/route.ts",
  `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      deprecated: true,
      route: "/api/checkout/plano",
      replacement: {
        one_time: "/api/assinatura/checkout",
        recurring: "/api/assinatura/mercado-pago",
        management: "/api/company/subscription",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Esta rota foi desativada para impedir conflito entre implementações de assinatura.",
      code: "LEGACY_PAYMENT_ROUTE_DISABLED",
      replacement: {
        one_time: "/api/assinatura/checkout",
        recurring: "/api/assinatura/mercado-pago",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
`,
);
console.log("  [OK] app/api/checkout/plano/route.ts");

step("Retirando o trial do fluxo de renovação");
const subscriptionService = "lib/subscription-service.ts";

replaceExact(
  subscriptionService,
  `import { getCompanySubscriptionAccess } from "@/lib/subscription-access";`,
  `import { getCompanySubscriptionAccess } from "@/lib/subscription-access";
import {
  buildSubscriptionReference,
  normalizePlanKey,
  normalizeSubscriptionProviderStatus,
  parseSubscriptionReference,
  type PlanKey,
} from "@/lib/payments/core/contracts";`,
  "importar contrato canônico",
);

replaceExact(
  subscriptionService,
  `export type PlanKey = "basico" | "profissional" | "premium";`,
  `export type { PlanKey } from "@/lib/payments/core/contracts";`,
  "reexportar PlanKey canônico",
);

replaceExact(
  subscriptionService,
  `const DAY_MS = 86_400_000;\n`,
  ``,
  "remover constante exclusiva do trial",
);

replaceExact(
  subscriptionService,
  `function normalizePlan(value: unknown): PlanKey {
  if (value === "basico" || value === "profissional" || value === "premium") {
    return value;
  }
  return "profissional";
}
`,
  `function normalizePlan(value: unknown): PlanKey {
  return normalizePlanKey(value);
}
`,
  "normalizar aliases de plano",
);

replaceRegex(
  subscriptionService,
  /function addDays\(date: Date, days: number\) \{[\s\S]*?\}\n\n/,
  "",
  "remover cálculo de dias do trial",
);

replaceRegex(
  subscriptionService,
  /async function claimTrial\([\s\S]*?\nfunction safeCompany/,
  "function safeCompany",
  "remover concessão de trial na renovação",
);

replaceRegex(
  subscriptionService,
  /  let workingCompany = company;\n  let freeTrialDays = 0;\n\n  if \(!company\.trial_used_at\) \{[\s\S]*?\n  \}\n\n  const \{ data: paymentRow/,
  "  const { data: paymentRow",
  "remover trial do cartão recorrente",
);

replaceExact(
  subscriptionService,
  `      status: "subscription_pending",`,
  `      status: "pending",`,
  "status inicial recorrente canônico",
);

replaceExact(
  subscriptionService,
  "  const externalReference = `orcaly_subscription:${company.id}:${planKey}:${paymentRow.id}`;",
  `  const externalReference = buildSubscriptionReference({
    kind: "recurring",
    companyId: company.id,
    plan: planKey,
    paymentRowId: paymentRow.id,
  });`,
  "referência recorrente versionada",
);

replaceRegex(
  subscriptionService,
  /  if \(freeTrialDays > 0\) \{\n    autoRecurring\.free_trial = \{[\s\S]*?\n  \}\n\n/,
  "",
  "remover free_trial do Mercado Pago",
);

let content = read(subscriptionService);
const requiredSubscriptionReplacements = [
  [`"subscription_error"`, `"failed"`],
  [
    `status: subscription.status ? \`subscription_\${subscription.status}\` : "subscription_pending",`,
    `status: normalizeSubscriptionProviderStatus(subscription.status),`,
  ],
  [
    `  const internalStatus = freeTrialDays > 0 ? "trialing" : "pendente";`,
    `  const internalStatus = "pendente";`,
  ],
  [
    `      assinatura_proxima_cobranca: subscription.next_payment_date || workingCompany.trial_ends_at || null,`,
    `      assinatura_proxima_cobranca: subscription.next_payment_date || null,`,
  ],
  [
    `    metadata: { plan: planKey, payment_type: "card_recurring", trial_days: freeTrialDays },`,
    `    metadata: { plan: planKey, payment_type: "card_recurring", trial_days: 0 },`,
  ],
  [
    `    message:
      freeTrialDays > 0
        ? "Teste gratuito iniciado. Conclua o cadastro do cartão para a cobrança após o período gratuito."
        : "Assinatura criada. Conclua o cadastro no Mercado Pago.",`,
    `    message: "Assinatura criada. Conclua o cadastro no Mercado Pago.",`,
  ],
];

for (const [oldValue, newValue] of requiredSubscriptionReplacements) {
  const count = content.split(oldValue).length - 1;
  if (count < 1) {
    throw new Error(
      `${subscriptionService}: trecho obrigatório não encontrado: ${oldValue.slice(0, 80)}`,
    );
  }
  content = content.split(oldValue).join(newValue);
}
write(subscriptionService, content);
console.log("  [OK] remover estados e mensagens de trial no cartão");

replaceRegex(
  subscriptionService,
  /  if \(!company\.trial_used_at\) \{[\s\S]*?\n  \}\n\n  const access = getCompanySubscriptionAccess\(company\);/,
  "  const access = getCompanySubscriptionAccess(company);",
  "remover concessão de trial no Pix",
);

replaceExact(
  subscriptionService,
  "  const externalReference = `orcaly_subscription_pix:${company.id}:${planKey}:${paymentRow.id}`;",
  `  const externalReference = buildSubscriptionReference({
    kind: "pix",
    companyId: company.id,
    plan: planKey,
    paymentRowId: paymentRow.id,
  });`,
  "referência Pix versionada",
);

replaceRegex(
  subscriptionService,
  /export function parseOrcalySubscriptionReference\(value: unknown\) \{[\s\S]*?\n\}\n\nexport async function findCompanyForProviderReference/,
  `export function parseOrcalySubscriptionReference(value: unknown) {
  return parseSubscriptionReference(value);
}

export async function findCompanyForProviderReference`,
  "parser compatível com referências novas e antigas",
);

step("Unificando o cartão recorrente transparente");
const transparent = "lib/subscription-mercado-pago-transparent.ts";

replaceExact(
  transparent,
  `import type { NextRequest } from "next/server";`,
  `import type { NextRequest } from "next/server";
import {
  buildSubscriptionReference,
  normalizePlanKey,
  normalizeSubscriptionProviderStatus,
} from "@/lib/payments/core/contracts";`,
  "importar contrato no cartão recorrente",
);

replaceRegex(
  transparent,
  /function normalizePlan\(value: unknown\): PlanKey \{[\s\S]*?\n\}\n\nasync function cancelRemoteSubscription/,
  "async function cancelRemoteSubscription",
  "remover normalizador duplicado",
);

replaceExact(
  transparent,
  `  type PlanKey,\n`,
  ``,
  "remover import de tipo não utilizado",
);

content = read(transparent)
  .replaceAll("normalizePlan(", "normalizePlanKey(")
  .replaceAll(`status: "subscription_creating"`, `status: "created"`)
  .replaceAll(`"subscription_error"`, `"failed"`)
  .replace(
    `  const externalReference =
    \`orcaly_subscription:\${companyId}:\${planKey}:\${paymentRow.id}\`;`,
    `  const externalReference = buildSubscriptionReference({
    kind: "recurring",
    companyId,
    plan: planKey,
    paymentRowId: String(paymentRow.id),
  });`,
  )
  .replace(
    `        status: \`subscription_\${providerStatus}\`,`,
    `        status: normalizeSubscriptionProviderStatus(providerStatus),`,
  )
  .replace(
    `        provider: "mercado_pago",
        provider_subscription_id: subscriptionId,`,
    `        provider: "mercado_pago",
        external_reference: externalReference,
        provider_subscription_id: subscriptionId,`,
  );

content = content.replace(
  /  if \(trialDays > 0\) \{\n    autoRecurring\.free_trial = \{[\s\S]*?\n  \}\n\n/,
  "",
);

if (
  content.includes("orcaly_subscription:${companyId}") ||
  content.includes("autoRecurring.free_trial")
) {
  throw new Error(
    `${transparent}: referência antiga ou free_trial ainda presente.`,
  );
}
write(transparent, content);
console.log("  [OK] cartão recorrente usa contratos canônicos");

step("Unificando Pix e cartão avulsos");
const checkout = "lib/subscription-checkout-payment.ts";

replaceExact(
  checkout,
  `import type { NextRequest } from "next/server";`,
  `import type { NextRequest } from "next/server";
import {
  buildSubscriptionReference,
  normalizePlanKey,
  parseSubscriptionReference,
} from "@/lib/payments/core/contracts";`,
  "importar contrato no checkout avulso",
);

replaceRegex(
  checkout,
  /function normalizePlan\(value: unknown\): PlanKey \{[\s\S]*?\n\}\n\nfunction digits/,
  "function digits",
  "remover normalizador duplicado do checkout",
);

replaceExact(
  checkout,
  `  type PlanKey,\n`,
  ``,
  "remover import de tipo não utilizado",
);

content = read(checkout)
  .replaceAll("normalizePlan(", "normalizePlanKey(")
  .replaceAll(`status: "creating"`, `status: "created"`)
  .replaceAll(`status: remoteStatus,`, `status: mappedStatus,`)
  .replaceAll(`status: "approved"`, `status: "paid"`)
  .replaceAll(`status: "approval_error"`, `status: "failed"`)
  .replaceAll(`status: "error"`, `status: "failed"`)
  .replace(
    `  const externalReference =
    \`orcaly_subscription_checkout:\${companyId}:\${planKey}:\${paymentRowId}\`;`,
    `  const externalReference = buildSubscriptionReference({
    kind: "checkout",
    companyId,
    plan: planKey,
    paymentRowId,
  });`,
  );

const oldIdempotency = `  const idempotencyKey =
    text(request.headers.get("idempotency-key")) || randomUUID();
`;
const newIdempotency = `  const idempotencyKey =
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
`;

if (!content.includes(oldIdempotency)) {
  throw new Error(`${checkout}: bloco de idempotência não encontrado.`);
}
content = content.replace(oldIdempotency, newIdempotency);

if (content.includes("orcaly_subscription_checkout:${companyId}")) {
  throw new Error(`${checkout}: referência antiga ainda presente.`);
}

write(checkout, content);
console.log("  [OK] referência e idempotência persistidas");

replaceRegex(
  checkout,
  /function parseReference\(value: unknown\) \{[\s\S]*?\n\}\n\nexport async function createSubscriptionCheckoutPayment/,
  `function parseReference(value: unknown) {
  const parsed = parseSubscriptionReference(value);

  if (!parsed || parsed.kind !== "checkout" || !parsed.paymentRowId) {
    return null;
  }

  return parsed;
}

export async function createSubscriptionCheckoutPayment`,
  "parser único do checkout",
);

step("Normalizando status no webhook de assinatura");
const webhook = "app/api/mercado-pago/webhook/route.ts";

replaceExact(
  webhook,
  `import { NextRequest, NextResponse } from "next/server";`,
  `import { NextRequest, NextResponse } from "next/server";
import { mapMercadoPagoStatus } from "@/lib/mercado-pago";`,
  "importar normalizador de status",
);

replaceExact(
  webhook,
  `        status,`,
  `        status: mapMercadoPagoStatus(status),`,
  "persistir status canônico no plan_payments",
);

step("Criando verificação automatizada");
write(
  "scripts/verify-payment-flow-boundaries.mjs",
  `import fs from "node:fs";

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
      "orcaly_subscription:\${companyId}",
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
      "orcaly_subscription_checkout:\${companyId}",
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
      console.error(\`[FALHA] \${check.file}: ainda contém \${value}\`);
      failed = true;
    }
  }

  for (const value of check.required) {
    if (!content.includes(value)) {
      console.error(\`[FALHA] \${check.file}: não contém \${value}\`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);

console.log(
  "Contratos validados: rota legada isolada, trial fora da renovação, referências versionadas e status canônicos.",
);
`,
);
console.log("  [OK] scripts/verify-payment-flow-boundaries.mjs");

const updatedPackage = JSON.parse(read("package.json"));
updatedPackage.scripts ||= {};
updatedPackage.scripts["verify:payments"] =
  "node scripts/verify-payment-flow-boundaries.mjs";
write("package.json", `${JSON.stringify(updatedPackage, null, 2)}\n`);
console.log("  [OK] npm run verify:payments");

step("Criando migration sem aplicar na produção");
const migrationPath =
  "supabase/migrations/20260730212000_unify_payment_domain_phase_1.sql";

write(
  migrationPath,
  `begin;

update public.companies
set
  plano = case
    when lower(coalesce(plano, '')) in ('essencial', 'básico') then 'basico'
    when lower(coalesce(plano, '')) in ('intermediario', 'intermediário') then 'profissional'
    else plano
  end,
  assinatura_plano = case
    when lower(coalesce(assinatura_plano, '')) in ('essencial', 'básico') then 'basico'
    when lower(coalesce(assinatura_plano, '')) in ('intermediario', 'intermediário') then 'profissional'
    else assinatura_plano
  end
where
  lower(coalesce(plano, '')) in (
    'essencial',
    'básico',
    'intermediario',
    'intermediário'
  )
  or lower(coalesce(assinatura_plano, '')) in (
    'essencial',
    'básico',
    'intermediario',
    'intermediário'
  );

update public.plan_payments
set plano = case
  when lower(plano) in ('essencial', 'básico') then 'basico'
  when lower(plano) in ('intermediario', 'intermediário') then 'profissional'
  else plano
end
where lower(plano) in (
  'essencial',
  'básico',
  'intermediario',
  'intermediário'
);

update public.plan_payments
set status = case
  when lower(coalesce(status, '')) in (
    'erro',
    'error',
    'subscription_error',
    'approval_error',
    'rejected'
  ) then 'failed'
  when lower(coalesce(status, '')) in (
    'pendente',
    'pending',
    'checkout_gerado',
    'pix_checkout_gerado',
    'subscription_pending',
    'subscription_creating',
    'creating',
    'applying'
  ) then 'pending'
  when lower(coalesce(status, '')) in (
    'approved',
    'paid'
  ) then 'paid'
  else lower(status)
end
where status is not null;

update public.plan_payments
set provider = 'mercado_pago'
where provider is null
  and (
    mercado_pago_preference_id is not null
    or mercado_pago_payment_id is not null
    or mercado_pago_preapproval_id is not null
    or provider_payment_id is not null
    or provider_subscription_id is not null
    or lower(coalesce(payment_method, '')) in (
      'pix',
      'card_recurring',
      'credit_card',
      'debit_card'
    )
  );

alter table public.plan_payments
  alter column status set default 'pending';

commit;
`,
);
console.log(`  [OK] ${migrationPath}`);
console.log("  A migration foi criada, mas NÃO foi aplicada.");

step("Validando alterações");
run("npm", ["run", "verify:payments"]);

const lintFiles = [
  "app/api/checkout/plano/route.ts",
  "app/api/mercado-pago/webhook/route.ts",
  "lib/payments/core/contracts.ts",
  "lib/subscription-service.ts",
  "lib/subscription-mercado-pago-transparent.ts",
  "lib/subscription-checkout-payment.ts",
];

run("npx", ["eslint", ...lintFiles]);

if (!skipBuild) {
  step("Executando build de produção");
  run("npm", ["run", "build"]);
} else {
  console.log("Build ignorado por --skip-build.");
}

step("Revisando diff");
run("git", ["diff", "--check"]);
run("git", ["diff", "--stat"]);
run("git", ["status", "--short"]);

const commitFiles = [
  "package.json",
  "app/api/checkout/plano/route.ts",
  "app/api/mercado-pago/webhook/route.ts",
  "lib/payments/core/contracts.ts",
  "lib/subscription-service.ts",
  "lib/subscription-mercado-pago-transparent.ts",
  "lib/subscription-checkout-payment.ts",
  "scripts/verify-payment-flow-boundaries.mjs",
  migrationPath,
];

if (shouldCommit) {
  step("Criando commit apenas com os arquivos de pagamentos");
  run("git", ["add", "--", ...commitFiles]);
  run("git", ["diff", "--cached", "--check"]);
  run("git", ["commit", "-m", commitMessage]);

  console.log(
    `Commit criado: ${run("git", ["rev-parse", "--short", "HEAD"], {
      capture: true,
    })}`,
  );

  if (shouldPush) {
    step("Enviando branch ao GitHub");
    run("git", [
      "push",
      "-u",
      "origin",
      run("git", ["branch", "--show-current"], { capture: true }),
    ]);
  }
}

step("Fase 1 concluída");
console.log(
  `Branch: ${run("git", ["branch", "--show-current"], {
    capture: true,
  })}`,
);
console.log(`Backup: ${backupRoot}`);
console.log("Migration criada, mas ainda não aplicada no Supabase.");
console.log(
  "Próxima fase: ledger idempotente dos webhooks e correção do split do marketplace.",
);
