// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { encryptPaymentCredential } from "@/lib/payments/credential-encryption";
import {
  AsaasProvider,
  type PixKeyType,
} from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  requireUserCompany,
} from "@/lib/payments/server-context";

const ALLOWED_TYPES = new Set<PixKeyType>([
  "CPF",
  "CNPJ",
  "EMAIL",
  "PHONE",
  "EVP",
]);

function statusOf(error: unknown) {
  return Number(
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status || 500
      : 500,
  );
}

function normalizeType(value: unknown): PixKeyType {
  const type = String(value || "").trim().toUpperCase() as PixKeyType;
  if (!ALLOWED_TYPES.has(type)) {
    throw Object.assign(new Error("Selecione um tipo de chave Pix válido."), {
      status: 400,
    });
  }
  return type;
}

function normalizeKey(type: PixKeyType, value: unknown) {
  const raw = String(value || "").trim();
  const key = ["CPF", "CNPJ", "PHONE"].includes(type)
    ? raw.replace(/\D/g, "")
    : type === "EMAIL"
      ? raw.toLowerCase()
      : raw;

  if (!key) {
    throw Object.assign(new Error("Informe a chave Pix."), { status: 400 });
  }

  return key;
}

function maskKey(type: PixKeyType, key: string) {
  if (type === "EMAIL") {
    const [name, domain] = key.split("@");
    if (!domain) return "***";
    return `${name.slice(0, 1)}***@${domain}`;
  }

  if (type === "PHONE") {
    return key.length >= 4 ? `(**) *****-${key.slice(-4)}` : "****";
  }

  if (type === "CPF" || type === "CNPJ") {
    return key.length >= 4 ? `***.***.${key.slice(-4)}` : "****";
  }

  return key.length >= 8
    ? `${key.slice(0, 4)}••••${key.slice(-4)}`
    : "••••••••";
}

async function validatePixKey(
  companyId: string,
  type: PixKeyType,
  key: string,
) {
  const account = await getCompanyProviderAccount(companyId);
  const provider = new AsaasProvider(account.apiKey);
  const result = await provider.getExternalPixKey(type, key);

  return {
    type,
    maskedKey: maskKey(type, key),
    ownerName: result.ownerName || "Titular confirmado pelo Asaas",
    ownerDocumentMasked: result.cpfCnpj || null,
    bankName: result.bankName || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data } = await context.supabase
      .from("marketplace_payment_settings")
      .select(
        "payout_pix_key_type,payout_pix_key_masked,payout_pix_owner_name,payout_pix_owner_document_masked,automatic_payout_enabled,minimum_payout_amount,last_payout_at",
      )
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .maybeSingle();

    return NextResponse.json({
      configured: Boolean(data?.payout_pix_key_masked),
      type: data?.payout_pix_key_type || null,
      maskedKey: data?.payout_pix_key_masked || null,
      ownerName: data?.payout_pix_owner_name || null,
      ownerDocumentMasked: data?.payout_pix_owner_document_masked || null,
      automaticPayoutEnabled: Boolean(data?.automatic_payout_enabled),
      minimumPayoutAmount: Number(data?.minimum_payout_amount || 0),
      lastPayoutAt: data?.last_payout_at || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const body = await request.json();
    const type = normalizeType(body.type);
    const key = normalizeKey(type, body.key);
    const validated = await validatePixKey(companyId, type, key);

    return NextResponse.json({ ok: true, ...validated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const body = await request.json();
    const type = normalizeType(body.type);
    const key = normalizeKey(type, body.key);
    const validated = await validatePixKey(companyId, type, key);
    const minimum = Math.max(0, Number(body.minimumPayoutAmount || 0));

    const { data, error } = await context.supabase
      .from("marketplace_payment_settings")
      .update({
        payout_pix_key_encrypted: encryptPaymentCredential(key),
        payout_pix_key_type: type,
        payout_pix_key_masked: validated.maskedKey,
        payout_pix_owner_name: validated.ownerName,
        payout_pix_owner_document_masked:
          validated.ownerDocumentMasked || null,
        bank_name: validated.bankName || null,
        automatic_payout_enabled: Boolean(body.automaticPayoutEnabled),
        minimum_payout_amount: Number.isFinite(minimum) ? minimum : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true)
      .select(
        "payout_pix_key_type,payout_pix_key_masked,payout_pix_owner_name,payout_pix_owner_document_masked,automatic_payout_enabled,minimum_payout_amount,last_payout_at",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      configured: true,
      type: data.payout_pix_key_type,
      maskedKey: data.payout_pix_key_masked,
      ownerName: data.payout_pix_owner_name,
      ownerDocumentMasked: data.payout_pix_owner_document_masked,
      automaticPayoutEnabled: data.automatic_payout_enabled,
      minimumPayoutAmount: Number(data.minimum_payout_amount || 0),
      lastPayoutAt: data.last_payout_at || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { error } = await context.supabase
      .from("marketplace_payment_settings")
      .update({
        payout_pix_key_encrypted: null,
        payout_pix_key_type: null,
        payout_pix_key_masked: null,
        payout_pix_owner_name: null,
        payout_pix_owner_document_masked: null,
        automatic_payout_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("is_active", true);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível remover a chave Pix.",
      },
      { status: statusOf(error) },
    );
  }
}
