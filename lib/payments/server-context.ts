// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { decryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { resolveCompanyPaymentProvider } from "@/lib/payments/provider-factory";

type JsonRecord = Record<string, unknown>;

export function getSupabaseAdmin() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !serviceRole) {
    throw new Error(
      "As credenciais administrativas do Supabase nao foram configuradas.",
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearer(request: NextRequest) {
  return String(request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function requireUserCompany(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const token = bearer(request);

  if (!token) {
    throw Object.assign(new Error("Sessao nao enviada."), { status: 401 });
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token);
  const user = authData.user;

  if (authError || !user) {
    throw Object.assign(new Error("Sessao invalida."), { status: 401 });
  }

  const { data: owned } = await supabase
    .from("companies")
    .select("*")
    .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    return {
      supabase,
      user,
      company: owned as JsonRecord,
      role: "owner",
    };
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id,cargo,status")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  if (!member?.company_id) {
    throw Object.assign(
      new Error("Empresa nao encontrada para esta sessao."),
      { status: 403 },
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", member.company_id)
    .maybeSingle();

  if (!company?.id) {
    throw Object.assign(new Error("Empresa nao encontrada."), {
      status: 404,
    });
  }

  return {
    supabase,
    user,
    company: company as JsonRecord,
    role: String(member.cargo || "member"),
  };
}

export async function resolveCompanyBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const clean = String(slug || "").trim().toLowerCase();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .or(`slug.eq.${clean},subdomain_slug.eq.${clean}`)
    .limit(1)
    .maybeSingle();

  if (error || !company?.id) {
    throw Object.assign(new Error("Empresa nao encontrada."), {
      status: 404,
    });
  }

  return {
    supabase,
    company: company as JsonRecord,
  };
}

export async function getCompanyPaymentSettings(companyId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("marketplace_payment_settings")
    .select("*")
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error("Nao foi possivel consultar a configuracao financeira."),
      { status: 500 },
    );
  }

  const record = (data || {}) as JsonRecord;
  return {
    record,
    provider: resolveCompanyPaymentProvider(record.provider),
  };
}

export async function getCompanyProviderAccount(companyId: string) {
  const settings = await getCompanyPaymentSettings(companyId);
  const data = settings.record;

  if (settings.provider !== "asaas") {
    throw Object.assign(
      new Error("Esta empresa ainda utiliza Mercado Pago."),
      { status: 409, code: "ASAAS_NOT_ENABLED_FOR_COMPANY" },
    );
  }

  if (!data.provider_account_id) {
    throw Object.assign(
      new Error(
        "A conta de recebimento da empresa ainda nao foi configurada.",
      ),
      { status: 409 },
    );
  }

  if (!data.encrypted_provider_api_key) {
    throw Object.assign(
      new Error("A credencial protegida da subconta nao esta disponivel."),
      { status: 409 },
    );
  }

  return {
    record: data,
    apiKey: decryptPaymentCredential(
      String(data.encrypted_provider_api_key),
    ),
  };
}

export function getRequestIp(request: NextRequest) {
  const forwarded = String(
    request.headers.get("x-forwarded-for") || "",
  )
    .split(",")[0]
    .trim();

  const real = String(request.headers.get("x-real-ip") || "").trim();
  const candidate = forwarded || real;

  if (!candidate) {
    throw Object.assign(
      new Error("Nao foi possivel identificar o IP do dispositivo."),
      { status: 400, code: "REMOTE_IP_MISSING" },
    );
  }

  return candidate;
}

export function cleanSensitivePayload(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};

  const blocked = new Set([
    "apikey",
    "access_token",
    "authorization",
    "creditcard",
    "creditcardholderinfo",
    "creditcardtoken",
    "ccv",
    "cvv",
    "number",
    "cpfcnpj",
    "document",
    "documento",
    "asaas-access-token",
  ]);

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (blocked.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(item)) {
      result[key] = item.map((entry) =>
        entry && typeof entry === "object"
          ? cleanSensitivePayload(entry)
          : entry,
      );
    } else if (item && typeof item === "object") {
      result[key] = cleanSensitivePayload(item);
    } else {
      result[key] = item;
    }
  }

  return result;
}
