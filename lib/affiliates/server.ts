/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_AFFILIATE_PROGRAM_V1
import "server-only";

import {
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  decryptPaymentCredential,
  encryptPaymentCredential,
} from "@/lib/payments/credential-encryption";
import {
  AsaasProvider,
  type PixKeyType,
} from "@/lib/payments/providers/asaas";
import { requireAsaasMasterApiKey } from "@/lib/payments/asaas-config";

type JsonRecord = Record<string, unknown>;

type AffiliateProfile = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  whatsapp: string;
  document_type: "CPF" | "CNPJ";
  document_hash: string;
  document_last4: string;
  code: string;
  status: string;
  payout_status: string;
  commission_rate: number;
  debt_balance: number;
  terms_version: string;
  created_at: string;
  updated_at: string;
};

const PLAN_PRICES: Record<string, number> = {
  basico: 49.9,
  essencial: 49.9,
  profissional: 99.9,
  intermediario: 99.9,
  premium: 149.9,
};

const ACTIVE_REFERRAL_STATUSES = [
  "registered",
  "trial",
  "payment_pending",
  "qualified",
  "customer_active",
];

export class AffiliateError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AffiliateError";
    this.status = status;
  }
}

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

function roundMoney(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

export function normalizeAffiliateCode(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function normalizePlan(value: unknown) {
  const normalized = text(value).toLowerCase();

  if (["basico", "básico", "essencial"].includes(normalized)) {
    return "basico";
  }

  if (
    ["profissional", "intermediario", "intermediário"].includes(
      normalized,
    )
  ) {
    return "profissional";
  }

  return normalized === "premium" ? "premium" : "profissional";
}

function planPrice(value: unknown) {
  return PLAN_PRICES[normalizePlan(value)] || 99.9;
}

function financialHashKey() {
  const value = text(process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY);

  if (!value) {
    throw new AffiliateError(
      "Chave de segurança financeira não configurada.",
      503,
    );
  }

  return value;
}

export function hashAffiliateValue(
  value: unknown,
  purpose = "generic",
) {
  const clean = text(value).toLowerCase();
  if (!clean) return "";

  return createHmac("sha256", financialHashKey())
    .update(`${purpose}:${clean}`)
    .digest("hex");
}

function hashIp(value: unknown) {
  return hashAffiliateValue(text(value), "ip");
}

function adminClient() {
  const url = text(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = text(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRole) {
    throw new AffiliateError(
      "Configuração segura do Supabase ausente.",
      503,
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function appUrl() {
  const raw = text(
    process.env.ORCALY_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://orcaly.com.br",
  ).replace(/\/+$/, "");

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:") return parsed.origin;
  } catch {
    // Usa o domínio oficial.
  }

  return "https://orcaly.com.br";
}

function requestToken(request: NextRequest) {
  return text(
    request.headers.get("authorization") ||
      request.headers.get("x-orcaly-session"),
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export function requestIp(request: NextRequest) {
  return text(
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "",
  );
}

function randomCodeSuffix() {
  return randomBytes(4)
    .toString("base64url")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function codeBase(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 14) || "PARCEIRO"
  );
}

async function createUniqueCode(
  admin: ReturnType<typeof adminClient>,
  name: string,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = normalizeAffiliateCode(
      `${codeBase(name)}${randomCodeSuffix()}`,
    );
    const { data, error } = await admin
      .from("affiliate_profiles")
      .select("id")
      .ilike("code", code)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return code;
  }

  return `PARCEIRO${randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase()}`;
}

function maskEmail(value: unknown) {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");

  if (!name || !domain) return "E-mail protegido";

  return `${name.slice(0, 2)}${"*".repeat(
    Math.max(3, name.length - 2),
  )}@${domain}`;
}

function maskCustomerName(value: unknown) {
  const name = text(value);
  if (!name) return "Cliente protegido";

  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0] || "Cliente";
  const second = parts[1]?.[0] || "";

  return `${first} ${second}${second ? "***" : ""}`.trim();
}

function maskPixKey(value: unknown) {
  const key = text(value);
  if (!key) return "";
  if (key.includes("@")) return maskEmail(key);

  const clean = digits(key);
  if (clean.length >= 8) {
    return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
  }

  return `${key.slice(0, 3)}***${key.slice(-2)}`;
}

function documentType(value: unknown): "CPF" | "CNPJ" {
  return digits(value).length === 14 ? "CNPJ" : "CPF";
}

function validateDocument(value: unknown) {
  const clean = digits(value);

  if (![11, 14].includes(clean.length) || /^(\d)\1+$/.test(clean)) {
    throw new AffiliateError("Informe um CPF ou CNPJ válido.");
  }

  return clean;
}

function validatePhone(value: unknown) {
  const clean = digits(value);

  if (clean.length < 10 || clean.length > 13) {
    throw new AffiliateError("Informe um WhatsApp válido.");
  }

  return clean;
}

function validatePassword(value: unknown) {
  const password = text(value);

  if (password.length < 8) {
    throw new AffiliateError(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AffiliateError(
      "Use pelo menos uma letra e um número na senha.",
    );
  }

  return password;
}

function planExpectedCommission(plan: unknown, rate: number) {
  return roundMoney(planPrice(plan) * rate);
}

async function programSettings(admin: ReturnType<typeof adminClient>) {
  const { data, error } = await admin
    .from("affiliate_program_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    throw new AffiliateError(
      "Configuração do programa de parceiros indisponível.",
      503,
    );
  }

  return data as JsonRecord;
}

export async function requireAffiliate(request: NextRequest) {
  const token = requestToken(request);

  if (!token) {
    throw new AffiliateError("Faça login no Portal de Parceiros.", 401);
  }

  const admin = adminClient();
  const { data: authData, error: authError } =
    await admin.auth.getUser(token);

  if (authError || !authData.user?.id) {
    throw new AffiliateError("Sessão inválida ou expirada.", 401);
  }

  const { data: profile, error } = await admin
    .from("affiliate_profiles")
    .select("*")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile?.id) {
    throw new AffiliateError(
      "Esta conta não pertence ao Portal de Parceiros.",
      403,
    );
  }

  if (profile.status !== "active") {
    throw new AffiliateError(
      profile.status === "suspended"
        ? "Seu acesso ao programa está suspenso."
        : "Seu cadastro de parceiro ainda não está ativo.",
      403,
    );
  }

  return {
    admin,
    user: authData.user,
    profile: profile as AffiliateProfile,
  };
}

export async function registerAffiliate(input: {
  name: unknown;
  email: unknown;
  password: unknown;
  whatsapp: unknown;
  document: unknown;
  termsAccepted: unknown;
  marketingOptIn?: unknown;
  ip?: unknown;
}) {
  const name = text(input.name);
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const whatsapp = validatePhone(input.whatsapp);
  const document = validateDocument(input.document);

  if (name.length < 2 || name.length > 100) {
    throw new AffiliateError("Informe seu nome completo.");
  }

  if (!email || !email.includes("@")) {
    throw new AffiliateError("Informe um e-mail válido.");
  }

  if (input.termsAccepted !== true) {
    throw new AffiliateError(
      "Aceite os termos do programa para continuar.",
    );
  }

  const admin = adminClient();
  const settings = await programSettings(admin);
  const documentHash = hashAffiliateValue(
    document,
    "affiliate_document",
  );

  const [{ data: emailProfile }, { data: documentProfile }] =
    await Promise.all([
      admin
        .from("affiliate_profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle(),
      admin
        .from("affiliate_profiles")
        .select("id")
        .eq("document_hash", documentHash)
        .maybeSingle(),
    ]);

  if (emailProfile?.id || documentProfile?.id) {
    throw new AffiliateError(
      "Já existe um cadastro de parceiro com esses dados.",
      409,
    );
  }

  const recentLimit = new Date(
    Date.now() - 60 * 60 * 1000,
  ).toISOString();
  const ipHash = hashIp(input.ip);

  if (ipHash) {
    const { count } = await admin
      .from("affiliate_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "affiliate_registered")
      .eq("ip_hash", ipHash)
      .gte("created_at", recentLimit);

    if (Number(count || 0) >= 4) {
      throw new AffiliateError(
        "Muitos cadastros foram realizados desta conexão. Tente novamente mais tarde.",
        429,
      );
    }
  }

  const code = await createUniqueCode(admin, name);
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { orcaly_role: "affiliate" },
      user_metadata: { name, portal: "parceiros" },
    });

  if (authError || !authData.user?.id) {
    const message = text(authError?.message).toLowerCase();

    throw new AffiliateError(
      message.includes("already") || message.includes("registered")
        ? "Este e-mail já possui uma conta. Use outro e-mail exclusivo para o Portal de Parceiros."
        : authError?.message || "Não foi possível criar sua conta.",
      409,
    );
  }

  try {
    const { data: profile, error } = await admin
      .from("affiliate_profiles")
      .insert({
        user_id: authData.user.id,
        name,
        email,
        whatsapp,
        document_type: documentType(document),
        document_hash: documentHash,
        document_last4: document.slice(-4),
        code,
        status: "active",
        payout_status: "pending_verification",
        commission_rate: Math.min(
          0.6,
          Number(settings.commission_rate || 0.6),
        ),
        terms_version: text(settings.terms_version),
        terms_accepted_at: new Date().toISOString(),
        marketing_opt_in: Boolean(input.marketingOptIn),
        approved_at: new Date().toISOString(),
      })
      .select(
        "id,user_id,name,email,whatsapp,code,status,payout_status,commission_rate,terms_version,created_at",
      )
      .single();

    if (error || !profile?.id) {
      throw error || new Error("Perfil não criado.");
    }

    await admin.from("affiliate_audit_logs").insert({
      affiliate_id: profile.id,
      actor_user_id: authData.user.id,
      actor_email: email,
      action: "affiliate_registered",
      target_type: "affiliate",
      target_id: profile.id,
      ip_hash: ipHash || null,
      metadata: { code, terms_version: settings.terms_version },
    });

    return { ok: true, profile };
  } catch (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw error;
  }
}

export async function trackAffiliateClick(input: {
  code: unknown;
  sessionId?: unknown;
  ip?: unknown;
  userAgent?: unknown;
  landingPath?: unknown;
  referrer?: unknown;
}) {
  const code = normalizeAffiliateCode(input.code);

  if (!code) return { tracked: false, reason: "Código ausente." };

  const admin = adminClient();
  const { data: profile, error } = await admin
    .from("affiliate_profiles")
    .select("id,code,status")
    .ilike("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.id || profile.status !== "active") {
    return { tracked: false, reason: "Código inválido." };
  }

  const sessionHash = hashAffiliateValue(
    input.sessionId,
    "affiliate_click_session",
  );
  const recent = new Date(
    Date.now() - 30 * 60 * 1000,
  ).toISOString();

  if (sessionHash) {
    const { data: duplicate } = await admin
      .from("affiliate_clicks")
      .select("id")
      .eq("affiliate_id", profile.id)
      .eq("session_hash", sessionHash)
      .gte("created_at", recent)
      .limit(1)
      .maybeSingle();

    if (duplicate?.id) return { tracked: true, repeated: true };
  }

  let referrerHost = "";
  try {
    referrerHost = input.referrer
      ? new URL(text(input.referrer)).hostname
      : "";
  } catch {
    referrerHost = "";
  }

  await admin.from("affiliate_clicks").insert({
    affiliate_id: profile.id,
    code_snapshot: profile.code,
    session_hash: sessionHash || null,
    ip_hash: hashIp(input.ip) || null,
    user_agent_hash:
      hashAffiliateValue(input.userAgent, "affiliate_user_agent") ||
      null,
    landing_path: text(input.landingPath).slice(0, 300) || null,
    referrer_host: referrerHost.slice(0, 160) || null,
  });

  return { tracked: true };
}

export async function recordAffiliateReferral(input: {
  code: unknown;
  leadId: string;
  customerName: unknown;
  customerEmail: unknown;
  customerDocument: unknown;
  customerWhatsapp: unknown;
  plan: unknown;
  ip?: unknown;
  userAgent?: unknown;
}) {
  const code = normalizeAffiliateCode(input.code);
  if (!code || !input.leadId) {
    return { linked: false, reason: "Código ausente." };
  }

  const admin = adminClient();
  const { data: existing, error: existingError } = await admin
    .from("affiliate_referrals")
    .select("*")
    .eq("signup_lead_id", input.leadId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) {
    return { linked: true, existing: true, referral: existing };
  }

  const { data: profile, error } = await admin
    .from("affiliate_profiles")
    .select("*")
    .ilike("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!profile?.id || profile.status !== "active") {
    return { linked: false, reason: "Código inativo." };
  }

  const customerEmail = normalizeEmail(input.customerEmail);
  const customerPhone = validatePhone(input.customerWhatsapp);
  const customerDocument = validateDocument(input.customerDocument);
  const customerDocumentHash = hashAffiliateValue(
    customerDocument,
    "customer_document",
  );
  const selfDocumentHash = hashAffiliateValue(
    customerDocument,
    "affiliate_document",
  );

  const selfReferral =
    normalizeEmail(profile.email) === customerEmail ||
    digits(profile.whatsapp) === customerPhone ||
    profile.document_hash === selfDocumentHash;

  if (selfReferral) {
    await admin.from("affiliate_audit_logs").insert({
      affiliate_id: profile.id,
      action: "self_referral_blocked",
      target_type: "signup_lead",
      target_id: input.leadId,
      ip_hash: hashIp(input.ip) || null,
      metadata: { code },
    });

    return { linked: false, reason: "Autoindicação bloqueada." };
  }

  const { data: priorCustomer } = await admin
    .from("companies")
    .select("id")
    .ilike("email", customerEmail)
    .limit(1)
    .maybeSingle();

  if (priorCustomer?.id) {
    return { linked: false, reason: "Cliente já existente." };
  }

  const settings = await programSettings(admin);
  const rate = Math.min(
    0.6,
    Number(profile.commission_rate) ||
      Number(settings.commission_rate) ||
      0.6,
  );
  const plan = normalizePlan(input.plan);
  const registeredAt = new Date();
  const trialEndsAt = new Date(
    registeredAt.getTime() + 7 * 86_400_000,
  );

  const { data: referral, error: insertError } = await admin
    .from("affiliate_referrals")
    .insert({
      affiliate_id: profile.id,
      referral_code: profile.code,
      signup_lead_id: input.leadId,
      status: "registered",
      plan,
      customer_name_masked: maskCustomerName(input.customerName),
      customer_email_masked: maskEmail(customerEmail),
      customer_document_hash: customerDocumentHash,
      customer_whatsapp_hash: hashAffiliateValue(
        customerPhone,
        "customer_whatsapp",
      ),
      source: "link",
      registered_at: registeredAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      commission_expected: planExpectedCommission(plan, rate),
      ip_hash: hashIp(input.ip) || null,
      device_hash:
        hashAffiliateValue(input.userAgent, "referral_device") || null,
    })
    .select("*")
    .single();

  if (insertError || !referral?.id) {
    throw insertError || new Error("Não foi possível registrar a indicação.");
  }

  await admin
    .from("signup_leads")
    .update({
      referral_code: profile.code,
      affiliate_referral_id: referral.id,
    })
    .eq("id", input.leadId);

  await admin.from("affiliate_audit_logs").insert({
    affiliate_id: profile.id,
    action: "referral_registered",
    target_type: "signup_lead",
    target_id: input.leadId,
    ip_hash: hashIp(input.ip) || null,
    metadata: { plan, referral_id: referral.id },
  });

  return { linked: true, referral };
}

export async function bindAffiliateReferralToCompany(input: {
  leadId: string;
  companyId: string;
  ownerId?: string | null;
  companyEmail?: unknown;
  companyWhatsapp?: unknown;
  plan?: unknown;
  trialEndsAt?: string | null;
}) {
  if (!input.leadId || !input.companyId) return { linked: false };

  const admin = adminClient();
  const { data: referral, error } = await admin
    .from("affiliate_referrals")
    .select("*,affiliate_profiles(*)")
    .eq("signup_lead_id", input.leadId)
    .maybeSingle();

  if (error) throw error;
  if (!referral?.id) return { linked: false };

  const profile = record(referral.affiliate_profiles);
  const selfReferral =
    (input.ownerId && text(profile.user_id) === input.ownerId) ||
    (input.companyEmail &&
      normalizeEmail(profile.email) === normalizeEmail(input.companyEmail)) ||
    (input.companyWhatsapp &&
      digits(profile.whatsapp) === digits(input.companyWhatsapp));

  if (selfReferral) {
    await admin
      .from("affiliate_referrals")
      .update({
        company_id: input.companyId,
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason:
          "Autoindicação identificada na criação da empresa.",
      })
      .eq("id", referral.id);

    return { linked: false, rejected: true };
  }

  const registeredAt = new Date(
    referral.registered_at || referral.created_at || Date.now(),
  );
  const fallbackTrial = new Date(
    registeredAt.getTime() + 7 * 86_400_000,
  );
  const providedTrial = input.trialEndsAt
    ? new Date(input.trialEndsAt)
    : null;
  const trialEnd =
    providedTrial && !Number.isNaN(providedTrial.getTime())
      ? providedTrial
      : fallbackTrial;

  const { error: updateError } = await admin
    .from("affiliate_referrals")
    .update({
      company_id: input.companyId,
      plan: normalizePlan(input.plan || referral.plan),
      status: "trial",
      trial_ends_at: trialEnd.toISOString(),
    })
    .eq("id", referral.id)
    .is("company_id", null);

  if (updateError) throw updateError;

  return { linked: true, referralId: referral.id };
}

export async function createAffiliateCommissionForApprovedPayment(
  admin: any,
  company: JsonRecord,
  input: {
    providerPaymentId: string;
    plan?: unknown;
    amount?: number | null;
    planPaymentId?: string | null;
    paidAt?: string | null;
  },
) {
  const companyId = text(company.id);
  const providerPaymentId = text(input.providerPaymentId);

  if (!companyId || !providerPaymentId) {
    return { created: false, reason: "Vínculo ausente." };
  }

  const { data: referral, error: referralError } = await admin
    .from("affiliate_referrals")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ACTIVE_REFERRAL_STATUSES)
    .order("registered_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (referralError) throw referralError;
  if (!referral?.id) {
    return { created: false, reason: "Empresa sem indicação elegível." };
  }

  const [{ data: byReferral }, { data: byPayment }] = await Promise.all([
    admin
      .from("affiliate_commissions")
      .select("id,status")
      .eq("referral_id", referral.id)
      .maybeSingle(),
    admin
      .from("affiliate_commissions")
      .select("id,status")
      .eq("provider_payment_id", providerPaymentId)
      .maybeSingle(),
  ]);

  if (byReferral?.id || byPayment?.id) {
    return { created: false, repeated: true };
  }

  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin
      .from("affiliate_profiles")
      .select("*")
      .eq("id", referral.affiliate_id)
      .maybeSingle(),
    admin
      .from("affiliate_program_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (!profile?.id || profile.status !== "active" || !settings?.id) {
    return { created: false, reason: "Indicador não elegível." };
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const registeredAt = new Date(
    referral.registered_at || referral.created_at || paidAt,
  );
  const minimumDate = new Date(
    registeredAt.getTime() + 7 * 86_400_000,
  );
  const trialEnd = referral.trial_ends_at
    ? new Date(referral.trial_ends_at)
    : null;
  const eligibilityAt =
    trialEnd &&
    !Number.isNaN(trialEnd.getTime()) &&
    trialEnd > minimumDate
      ? trialEnd
      : minimumDate;

  if (paidAt < eligibilityAt) {
    await admin
      .from("affiliate_referrals")
      .update({ status: "payment_pending" })
      .eq("id", referral.id);

    return {
      created: false,
      reason: "Pagamento realizado antes do fim do período elegível.",
    };
  }

  const plan = normalizePlan(
    input.plan || referral.plan || company.assinatura_plano,
  );
  const maximumEligible = planPrice(plan);
  const received = roundMoney(input.amount);

  if (received <= 0) {
    return { created: false, reason: "Valor recebido inválido." };
  }

  const eligibleAmount = roundMoney(Math.min(received, maximumEligible));
  const rate = Math.min(
    0.6,
    Number(profile.commission_rate) ||
      Number(settings.commission_rate) ||
      0.6,
  );
  const commissionAmount = roundMoney(eligibleAmount * rate);
  const holdDays = Math.max(
    7,
    Math.min(60, Number(settings.hold_days || 14)),
  );
  const holdUntil = new Date(
    paidAt.getTime() + holdDays * 86_400_000,
  );

  const { data: commission, error } = await admin
    .from("affiliate_commissions")
    .insert({
      affiliate_id: profile.id,
      referral_id: referral.id,
      company_id: companyId,
      plan_payment_id: input.planPaymentId || null,
      provider_payment_id: providerPaymentId,
      plan,
      gross_amount: received,
      eligible_amount: eligibleAmount,
      commission_rate: rate,
      commission_amount: commissionAmount,
      status: "hold",
      hold_until: holdUntil.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    const message = text(error.message).toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return { created: false, repeated: true };
    }
    throw error;
  }

  await admin
    .from("affiliate_referrals")
    .update({
      status: "qualified",
      qualified_at: paidAt.toISOString(),
      first_payment_reference: providerPaymentId,
      first_payment_amount: received,
      commission_expected: commissionAmount,
    })
    .eq("id", referral.id);

  await admin.from("affiliate_audit_logs").insert({
    affiliate_id: profile.id,
    action: "commission_created",
    target_type: "affiliate_commission",
    target_id: commission.id,
    metadata: {
      referral_id: referral.id,
      company_id: companyId,
      plan,
      gross_amount: received,
      eligible_amount: eligibleAmount,
      commission_rate: rate,
      commission_amount: commissionAmount,
      hold_until: holdUntil.toISOString(),
    },
  });

  return { created: true, commission };
}

export async function reverseAffiliateCommissionForPayment(
  admin: any,
  providerPaymentId: string,
  reason: string,
) {
  const id = text(providerPaymentId);
  if (!id) return false;

  const { data, error } = await admin.rpc(
    "reverse_affiliate_commission_admin",
    {
      p_provider_payment_id: id,
      p_reason: text(reason) || "Pagamento estornado.",
    },
  );

  if (error) {
    const message = text(error.message).toLowerCase();
    if (message.includes("function") || message.includes("does not exist")) {
      return false;
    }
    throw error;
  }

  return Boolean(data);
}

async function getPayoutAccount(
  admin: ReturnType<typeof adminClient>,
  affiliateId: string,
) {
  const { data, error } = await admin.rpc(
    "get_affiliate_payout_account_admin",
    { p_affiliate_id: affiliateId },
  );

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

function scoreReferral(row: JsonRecord) {
  const status = text(row.status);
  if (!["qualified", "customer_active"].includes(status)) return 0;

  let score = 100;
  const plan = normalizePlan(row.plan);
  if (plan === "profissional") score += 20;
  if (plan === "premium") score += 40;

  const qualified = row.qualified_at ? new Date(text(row.qualified_at)) : null;
  if (qualified && !Number.isNaN(qualified.getTime())) {
    const age = (Date.now() - qualified.getTime()) / 86_400_000;
    if (age >= 30) score += 50;
    if (age >= 90) score += 100;
  }

  return score;
}

async function ranking(
  admin: ReturnType<typeof adminClient>,
  currentAffiliateId: string,
) {
  const [{ data: profiles }, { data: referrals }] = await Promise.all([
    admin
      .from("affiliate_profiles")
      .select("id,name,code,status")
      .eq("status", "active")
      .limit(500),
    admin
      .from("affiliate_referrals")
      .select("affiliate_id,status,plan,qualified_at")
      .in("status", ["qualified", "customer_active"])
      .limit(5000),
  ]);

  const scores = new Map<string, { score: number; conversions: number }>();

  for (const referral of referrals || []) {
    const current = scores.get(referral.affiliate_id) || {
      score: 0,
      conversions: 0,
    };
    current.score += scoreReferral(referral as JsonRecord);
    current.conversions += 1;
    scores.set(referral.affiliate_id, current);
  }

  const rows = (profiles || [])
    .map((profile) => ({
      id: profile.id,
      name: maskCustomerName(profile.name),
      code: profile.code,
      score: scores.get(profile.id)?.score || 0,
      conversions: scores.get(profile.id)?.conversions || 0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.conversions - a.conversions ||
        a.name.localeCompare(b.name),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));

  return {
    top: rows.slice(0, 10),
    current: rows.find((row) => row.id === currentAffiliateId) || null,
  };
}

export async function getAffiliateDashboard(request: NextRequest) {
  const { admin, profile } = await requireAffiliate(request);
  try {
    await admin.rpc("release_affiliate_commissions_admin");
  } catch {
    // A liberação também ocorre ao montar um pagamento.
  }

  const [
    referralsResult,
    commissionsResult,
    payoutsResult,
    clickResult,
    account,
    settings,
    rankingData,
  ] = await Promise.all([
    admin
      .from("affiliate_referrals")
      .select(
        "id,status,plan,customer_name_masked,customer_email_masked,registered_at,trial_ends_at,qualified_at,commission_expected,first_payment_amount,created_at",
      )
      .eq("affiliate_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("affiliate_commissions")
      .select(
        "id,referral_id,plan,gross_amount,eligible_amount,commission_rate,commission_amount,status,hold_until,available_at,reversed_at,reversal_reason,created_at",
      )
      .eq("affiliate_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("affiliate_payouts")
      .select(
        "id,gross_commissions,debt_offset,amount,status,provider,provider_transfer_id,external_reference,pix_key_type,pix_key_masked,holder_name,requested_at,paid_at,failure_reason,proof_url,created_at",
      )
      .eq("affiliate_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("affiliate_clicks")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", profile.id),
    getPayoutAccount(admin, profile.id),
    programSettings(admin),
    ranking(admin, profile.id),
  ]);

  if (referralsResult.error) throw referralsResult.error;
  if (commissionsResult.error) throw commissionsResult.error;
  if (payoutsResult.error) throw payoutsResult.error;

  const referrals = referralsResult.data || [];
  const commissions = commissionsResult.data || [];
  const payouts = payoutsResult.data || [];
  const sumStatus = (statuses: string[]) =>
    roundMoney(
      commissions
        .filter((row) => statuses.includes(text(row.status)))
        .reduce(
          (sum, row) => sum + Number(row.commission_amount || 0),
          0,
        ),
    );
  const future = roundMoney(
    referrals
      .filter((row) =>
        ["registered", "trial", "payment_pending"].includes(
          text(row.status),
        ),
      )
      .reduce(
        (sum, row) => sum + Number(row.commission_expected || 0),
        0,
      ),
  );

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      whatsapp: profile.whatsapp,
      code: profile.code,
      status: profile.status,
      payoutStatus: profile.payout_status,
      commissionRate: Number(profile.commission_rate) * 100,
      debtBalance: Number(profile.debt_balance || 0),
      referralLink: `${appUrl()}/cadastro?ref=${encodeURIComponent(
        profile.code,
      )}`,
    },
    program: {
      commissionRate: Number(settings.commission_rate) * 100,
      holdDays: Number(settings.hold_days),
      minimumPayout: Number(settings.minimum_payout_amount),
      attributionDays: Number(settings.attribution_days),
      payoutsEnabled: Boolean(settings.payouts_enabled),
    },
    stats: {
      clicks: Number(clickResult.count || 0),
      referrals: referrals.length,
      trials: referrals.filter((row) => row.status === "trial").length,
      qualified: referrals.filter((row) =>
        ["qualified", "customer_active"].includes(row.status),
      ).length,
      future,
      hold: sumStatus(["hold"]),
      available: sumStatus(["available"]),
      processing: sumStatus(["processing"]),
      paid: sumStatus(["paid"]),
      reversed: sumStatus(["reversed"]),
    },
    payoutAccount: account
      ? {
          pixKeyType: account.pix_key_type,
          pixKeyMasked: account.pix_key_masked,
          holderName: account.holder_name,
          bankName: account.bank_name,
          isVerified: Boolean(account.is_verified),
          verifiedAt: account.verified_at,
          updatedAt: account.updated_at,
        }
      : null,
    referrals,
    commissions,
    payouts,
    ranking: rankingData,
  };
}

export async function saveAffiliatePayoutAccount(
  request: NextRequest,
  input: JsonRecord,
) {
  const { admin, profile, user } = await requireAffiliate(request);
  const pixKeyType = text(input.pixKeyType).toUpperCase() as PixKeyType;

  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(pixKeyType)) {
    throw new AffiliateError("Escolha um tipo de chave Pix válido.");
  }

  const pixKey = text(input.pixKey);
  const holderName = text(input.holderName);
  const holderDocument = validateDocument(input.holderDocument);
  const holderHash = hashAffiliateValue(
    holderDocument,
    "affiliate_document",
  );

  if (holderHash !== profile.document_hash) {
    throw new AffiliateError(
      "O CPF ou CNPJ do titular precisa ser o mesmo do cadastro do parceiro.",
      409,
    );
  }

  if (!pixKey || pixKey.length > 180) {
    throw new AffiliateError("Informe uma chave Pix válida.");
  }

  if (holderName.length < 2) {
    throw new AffiliateError("Informe o nome do titular.");
  }

  let providerValidation: JsonRecord = {};
  let bankName = "";
  let verified = false;

  try {
    const provider = new AsaasProvider(requireAsaasMasterApiKey());
    const external = await provider.getExternalPixKey(pixKeyType, pixKey);
    const providerDocument = digits(external.cpfCnpj);

    providerValidation = {
      ownerName: external.ownerName || null,
      cpfCnpjLast4: providerDocument.slice(-4) || null,
      bankName: external.bankName || null,
      checkedAt: new Date().toISOString(),
    };
    bankName = external.bankName || "";

    if (providerDocument) {
      verified =
        hashAffiliateValue(providerDocument, "affiliate_document") ===
        profile.document_hash;
    }
  } catch (error) {
    providerValidation = {
      pendingManualVerification: true,
      reason:
        error instanceof Error
          ? error.message.slice(0, 180)
          : "Validação automática indisponível.",
      checkedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await admin.rpc(
    "save_affiliate_payout_account_admin",
    {
      p_affiliate_id: profile.id,
      p_pix_key_type: pixKeyType,
      p_pix_key_encrypted: encryptPaymentCredential(pixKey),
      p_pix_key_masked: maskPixKey(pixKey),
      p_holder_name: holderName,
      p_holder_document_hash: holderHash,
      p_holder_document_last4: holderDocument.slice(-4),
      p_bank_name: bankName || null,
      p_provider_validation: providerValidation,
      p_is_verified: verified,
      p_verified_by: verified ? "asaas_pix_validation" : null,
    },
  );

  if (error) throw error;

  await admin.from("affiliate_audit_logs").insert({
    affiliate_id: profile.id,
    actor_user_id: user.id,
    actor_email: profile.email,
    action: "payout_account_saved",
    target_type: "affiliate",
    target_id: profile.id,
    ip_hash: hashIp(requestIp(request)) || null,
    metadata: {
      pix_key_type: pixKeyType,
      pix_key_masked: maskPixKey(pixKey),
      automatically_verified: verified,
    },
  });

  return {
    ok: Boolean(data),
    verified,
    message: verified
      ? "Conta Pix validada e salva."
      : "Conta Pix salva e enviada para conferência.",
  };
}

export async function requestAffiliatePayout(request: NextRequest) {
  const { admin, profile, user } = await requireAffiliate(request);
  const { data, error } = await admin.rpc(
    "create_affiliate_payout_admin",
    { p_affiliate_id: profile.id },
  );

  if (error) throw new AffiliateError(error.message, 409);

  const payout = Array.isArray(data) ? data[0] : data;

  await admin.from("affiliate_audit_logs").insert({
    affiliate_id: profile.id,
    actor_user_id: user.id,
    actor_email: profile.email,
    action: "payout_requested",
    target_type: "affiliate_payout",
    target_id: text(payout?.payout_id),
    ip_hash: hashIp(requestIp(request)) || null,
    metadata: payout || {},
  });

  return { ok: true, payout };
}

async function affiliateAdminData() {
  const admin = adminClient();
  try {
    await admin.rpc("release_affiliate_commissions_admin");
  } catch {
    // A liberação também ocorre ao montar um pagamento.
  }

  const [
    profilesResult,
    referralsResult,
    commissionsResult,
    payoutsResult,
    settingsResult,
  ] = await Promise.all([
    admin
      .from("affiliate_profiles")
      .select(
        "id,user_id,name,email,whatsapp,document_type,document_last4,code,status,payout_status,commission_rate,debt_balance,approved_at,suspended_at,suspension_reason,last_login_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("affiliate_referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("affiliate_commissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("affiliate_payouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("affiliate_program_settings")
      .select("*")
      .eq("id", 1)
      .single(),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (referralsResult.error) throw referralsResult.error;
  if (commissionsResult.error) throw commissionsResult.error;
  if (payoutsResult.error) throw payoutsResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const referrals = referralsResult.data || [];
  const leadIds = Array.from(
    new Set(referrals.map((row) => row.signup_lead_id).filter(Boolean)),
  );
  const companyIds = Array.from(
    new Set(referrals.map((row) => row.company_id).filter(Boolean)),
  );

  const leadPromise = leadIds.length
    ? admin
        .from("signup_leads")
        .select(
          "id,nome_responsavel,email,whatsapp,empresa_nome,plano,status,payment_status,paid_at,converted_company_id,created_at",
        )
        .in("id", leadIds)
    : Promise.resolve({ data: [], error: null } as any);
  const companyPromise = companyIds.length
    ? admin
        .from("companies")
        .select(
          "id,nome,email,whatsapp,plano,assinatura_plano,assinatura_status,trial_ends_at,assinatura_ultimo_pagamento,created_at",
        )
        .in("id", companyIds)
    : Promise.resolve({ data: [], error: null } as any);

  const [{ data: leads }, { data: companies }] = await Promise.all([
    leadPromise,
    companyPromise,
  ]);
  const leadMap = new Map((leads || []).map((row: any) => [row.id, row]));
  const companyMap = new Map(
    (companies || []).map((row: any) => [row.id, row]),
  );
  const enrichedReferrals = referrals.map((row) => ({
    ...row,
    lead: row.signup_lead_id
      ? leadMap.get(row.signup_lead_id) || null
      : null,
    company: row.company_id
      ? companyMap.get(row.company_id) || null
      : null,
  }));
  const profiles = profilesResult.data || [];
  const commissions = commissionsResult.data || [];
  const payouts = payoutsResult.data || [];
  const sum = (rows: any[], key: string) =>
    roundMoney(
      rows.reduce((total, row) => total + Number(row[key] || 0), 0),
    );

  return {
    settings: settingsResult.data,
    summary: {
      affiliates: profiles.length,
      activeAffiliates: profiles.filter((row) => row.status === "active")
        .length,
      referrals: referrals.length,
      qualified: referrals.filter((row) =>
        ["qualified", "customer_active"].includes(row.status),
      ).length,
      commissionsHold: sum(
        commissions.filter((row) => row.status === "hold"),
        "commission_amount",
      ),
      commissionsAvailable: sum(
        commissions.filter((row) => row.status === "available"),
        "commission_amount",
      ),
      commissionsPaid: sum(
        commissions.filter((row) => row.status === "paid"),
        "commission_amount",
      ),
      payoutsPending: sum(
        payouts.filter((row) =>
          ["requested", "approved", "processing"].includes(row.status),
        ),
        "amount",
      ),
    },
    profiles,
    referrals: enrichedReferrals,
    commissions,
    payouts,
    ranking: await ranking(admin, ""),
  };
}

export async function getAffiliateAdminDashboard() {
  return affiliateAdminData();
}

async function auditAdmin(
  admin: ReturnType<typeof adminClient>,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: JsonRecord = {},
) {
  await admin.from("affiliate_audit_logs").insert({
    actor_email: adminEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

export async function processAffiliateAdminAction(
  adminEmail: string,
  input: JsonRecord,
) {
  const admin = adminClient();
  const action = text(input.action);
  const affiliateId = text(input.affiliateId);
  const payoutId = text(input.payoutId);
  const commissionId = text(input.commissionId);

  if (action === "profile_status") {
    const status = text(input.status);
    if (
      !["pending", "active", "suspended", "rejected", "closed"].includes(
        status,
      )
    ) {
      throw new AffiliateError("Status de parceiro inválido.");
    }

    const { error } = await admin
      .from("affiliate_profiles")
      .update({
        status,
        suspended_at:
          status === "suspended" ? new Date().toISOString() : null,
        suspension_reason:
          status === "suspended"
            ? text(input.reason).slice(0, 500) ||
              "Suspensão administrativa."
            : null,
      })
      .eq("id", affiliateId);

    if (error) throw error;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_profile_status_changed",
      "affiliate",
      affiliateId,
      { status, reason: text(input.reason) },
    );
    return { ok: true };
  }

  if (action === "verify_payout_account") {
    const verified = Boolean(input.verified);
    const { data, error } = await admin.rpc(
      "set_affiliate_payout_account_verification_admin",
      {
        p_affiliate_id: affiliateId,
        p_verified: verified,
        p_verified_by: adminEmail,
        p_note: text(input.note) || null,
      },
    );

    if (error) throw error;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_payout_account_verified",
      "affiliate",
      affiliateId,
      { verified, note: text(input.note) },
    );
    return { ok: Boolean(data) };
  }

  if (action === "create_payout") {
    const { data, error } = await admin.rpc(
      "create_affiliate_payout_admin",
      { p_affiliate_id: affiliateId },
    );
    if (error) throw new AffiliateError(error.message, 409);
    const payout = Array.isArray(data) ? data[0] : data;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_payout_created",
      "affiliate_payout",
      text(payout?.payout_id),
      payout || {},
    );
    return { ok: true, payout };
  }

  if (action === "approve_payout") {
    const { error } = await admin
      .from("affiliate_payouts")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        admin_note: text(input.note).slice(0, 500) || null,
      })
      .eq("id", payoutId)
      .eq("status", "requested");
    if (error) throw error;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_payout_approved",
      "affiliate_payout",
      payoutId,
      { note: text(input.note) },
    );
    return { ok: true };
  }

  if (action === "send_payout") {
    const { data: payout, error: payoutError } = await admin
      .from("affiliate_payouts")
      .select("*")
      .eq("id", payoutId)
      .in("status", ["requested", "approved"])
      .maybeSingle();

    if (payoutError) throw payoutError;
    if (!payout?.id) {
      throw new AffiliateError(
        "Pagamento não encontrado ou não elegível.",
        404,
      );
    }

    const account = await getPayoutAccount(admin, payout.affiliate_id);
    if (!account?.is_verified) {
      throw new AffiliateError("A conta Pix ainda não foi verificada.", 409);
    }

    await admin
      .from("affiliate_payouts")
      .update({
        status: "processing",
        provider: "asaas",
        processing_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    try {
      const provider = new AsaasProvider(requireAsaasMasterApiKey());
      const transfer = await provider.createPixTransfer({
        value: Number(payout.amount),
        pixAddressKey: decryptPaymentCredential(account.pix_key_encrypted),
        pixAddressKeyType: account.pix_key_type as PixKeyType,
        description: `Comissão Orçaly ${payout.external_reference}`,
        externalReference: payout.external_reference,
      });

      await admin
        .from("affiliate_payouts")
        .update({
          provider_transfer_id: transfer.id,
          status: "processing",
          failure_reason: transfer.failReason || null,
        })
        .eq("id", payout.id);

      if (transfer.status.toUpperCase() === "DONE") {
        await admin.rpc("mark_affiliate_payout_paid_admin", {
          p_payout_id: payout.id,
          p_provider: "asaas",
          p_provider_transfer_id: transfer.id,
          p_proof_url: null,
        });
      }

      await auditAdmin(
        admin,
        adminEmail,
        "affiliate_payout_sent",
        "affiliate_payout",
        payout.id,
        {
          provider_transfer_id: transfer.id,
          status: transfer.status,
          amount: payout.amount,
        },
      );

      return { ok: true, transfer };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Falha na transferência Pix.";
      await admin.rpc("fail_affiliate_payout_admin", {
        p_payout_id: payout.id,
        p_reason: reason,
      });
      throw new AffiliateError(reason, 502);
    }
  }

  if (action === "mark_paid_manual") {
    const providerReference =
      text(input.providerReference) || `manual:${payoutId}:${Date.now()}`;
    const { data, error } = await admin.rpc(
      "mark_affiliate_payout_paid_admin",
      {
        p_payout_id: payoutId,
        p_provider: "manual",
        p_provider_transfer_id: providerReference,
        p_proof_url: text(input.proofUrl) || null,
      },
    );
    if (error) throw error;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_payout_marked_paid",
      "affiliate_payout",
      payoutId,
      { providerReference, proofUrl: text(input.proofUrl) },
    );
    return { ok: Boolean(data) };
  }

  if (action === "cancel_payout") {
    const { data, error } = await admin.rpc(
      "cancel_affiliate_payout_admin",
      {
        p_payout_id: payoutId,
        p_reason:
          text(input.reason) || "Pagamento cancelado pelo administrador.",
      },
    );
    if (error) throw error;
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_payout_cancelled",
      "affiliate_payout",
      payoutId,
      { reason: text(input.reason) },
    );
    return { ok: Boolean(data) };
  }

  if (action === "reverse_commission") {
    let providerPaymentId = text(input.providerPaymentId);

    if (!providerPaymentId && commissionId) {
      const { data: commission } = await admin
        .from("affiliate_commissions")
        .select("provider_payment_id")
        .eq("id", commissionId)
        .maybeSingle();
      providerPaymentId = text(commission?.provider_payment_id);
    }

    if (!providerPaymentId) {
      throw new AffiliateError("Pagamento da comissão não encontrado.");
    }

    const reversed = await reverseAffiliateCommissionForPayment(
      admin,
      providerPaymentId,
      text(input.reason) || "Comissão revertida administrativamente.",
    );
    await auditAdmin(
      admin,
      adminEmail,
      "affiliate_commission_reversed",
      "affiliate_commission",
      commissionId || providerPaymentId,
      { providerPaymentId, reason: text(input.reason) },
    );
    return { ok: reversed };
  }

  throw new AffiliateError("Ação administrativa inválida.");
}

export async function updateAffiliatePayoutFromTransferEvent(
  transfer: JsonRecord,
  eventType: string,
) {
  const admin = adminClient();
  const transferId = text(transfer.id);
  if (!transferId) return false;

  const { data: payout, error } = await admin
    .from("affiliate_payouts")
    .select("*")
    .eq("provider", "asaas")
    .eq("provider_transfer_id", transferId)
    .maybeSingle();

  if (error) throw error;
  if (!payout?.id) return false;

  const status = text(
    transfer.status || eventType.replace(/^TRANSFER_/, ""),
  ).toUpperCase();

  if (status === "DONE") {
    await admin.rpc("mark_affiliate_payout_paid_admin", {
      p_payout_id: payout.id,
      p_provider: "asaas",
      p_provider_transfer_id: transferId,
      p_proof_url: null,
    });
    return true;
  }

  if (["FAILED", "CANCELLED", "BLOCKED", "REFUSED"].includes(status)) {
    await admin.rpc("fail_affiliate_payout_admin", {
      p_payout_id: payout.id,
      p_reason:
        text(transfer.failReason || transfer.failureReason) ||
        `Transferência ${status}.`,
    });
    return true;
  }

  await admin
    .from("affiliate_payouts")
    .update({ status: "processing", failure_reason: null })
    .eq("id", payout.id);

  return true;
}

export function affiliateStatusCode(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}
