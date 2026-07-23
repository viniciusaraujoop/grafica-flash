// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import {
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
  requireAsaasWebhookToken,
} from "@/lib/payments/asaas-config";
import { encryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { requireUserCompany } from "@/lib/payments/server-context";

export const runtime = "nodejs";

function statusOf(error: unknown) {
  return Number(
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status || 500
      : 500,
  );
}

const PUBLIC_ACCOUNT_FIELDS =
  "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,is_active,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data } = await context.supabase
      .from("marketplace_payment_settings")
      .select(PUBLIC_ACCOUNT_FIELDS)
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      configured: Boolean(data?.provider_account_id),
      provider: "asaas",
      accountStatus: data?.account_status || null,
      onboardingStatus: data?.onboarding_status || null,
      chargesEnabled: Boolean(data?.charges_enabled),
      payoutsEnabled: Boolean(data?.payouts_enabled),
      pixEnabled: Boolean(data?.pix_enabled),
      cardEnabled:
        Boolean(data?.card_enabled) &&
        getAsaasCapabilities().cardTokenizationEnabled,
      onboardingUrl: data?.onboarding_url || null,
      legalName: data?.legal_name || null,
      documentLast4: data?.document_last4 || null,
      bankName: data?.bank_name || null,
      bankAccountLast4: data?.bank_account_last4 || null,
      bankAccountType: data?.bank_account_type || null,
      capabilities: getAsaasCapabilities(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a conta.",
      },
      { status: statusOf(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const capabilities = getAsaasCapabilities();

    if (!capabilities.subaccountsEnabled) {
      return NextResponse.json(
        { error: "A criação de subcontas ainda não foi habilitada." },
        { status: 409 },
      );
    }

    const context = await requireUserCompany(request);
    const body = await request.json();
    const companyId = String(context.company.id);

    const { data: existing } = await context.supabase
      .from("marketplace_payment_settings")
      .select("*")
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .maybeSingle();

    if (existing?.provider_account_id) {
      await context.supabase
        .from("marketplace_payment_settings")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("company_id", companyId);

      const { data: active } = await context.supabase
        .from("marketplace_payment_settings")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(PUBLIC_ACCOUNT_FIELDS)
        .single();

      return NextResponse.json({ ok: true, repeated: true, account: active });
    }

    const provider = new AsaasProvider(requireAsaasMasterApiKey());
    const appUrl = String(
      process.env.NEXT_PUBLIC_APP_URL || "https://orcaly.com.br",
    ).replace(/\/+$/, "");
    const webhookToken = requireAsaasWebhookToken();

    const account = await provider.createProviderAccount({
      name: String(body.name || context.company.nome || "").trim(),
      email: String(body.email || context.user.email || "").trim(),
      cpfCnpj: String(body.cpfCnpj || "").replace(/\D/g, ""),
      birthDate: String(body.birthDate || "").trim() || undefined,
      companyType: String(body.companyType || "").trim() || undefined,
      phone: String(body.phone || "").replace(/\D/g, "") || undefined,
      mobilePhone:
        String(body.mobilePhone || "").replace(/\D/g, "") || undefined,
      address: String(body.address || "").trim() || undefined,
      addressNumber:
        String(body.addressNumber || "").trim() || undefined,
      complement: String(body.complement || "").trim() || undefined,
      province: String(body.province || "").trim() || undefined,
      postalCode:
        String(body.postalCode || "").replace(/\D/g, "") || undefined,
      incomeValue: Number(body.incomeValue || 0) || undefined,
      webhooks: [
        {
          name: "Orçaly pagamentos e repasses",
          url: `${appUrl}/api/webhooks/asaas`,
          email: String(body.email || context.user.email || "").trim(),
          enabled: true,
          interrupted: false,
          apiVersion: 3,
          authToken: webhookToken,
          sendType: "SEQUENTIALLY",
          events: [
            "PAYMENT_CREATED",
            "PAYMENT_UPDATED",
            "PAYMENT_CONFIRMED",
            "PAYMENT_RECEIVED",
            "PAYMENT_OVERDUE",
            "PAYMENT_REFUNDED",
            "PAYMENT_DELETED",
            "PAYMENT_SPLIT_DONE",
            "PAYMENT_SPLIT_CANCELLED",
            "TRANSFER_CREATED",
            "TRANSFER_PENDING",
            "TRANSFER_IN_BANK_PROCESSING",
            "TRANSFER_BLOCKED",
            "TRANSFER_DONE",
            "TRANSFER_FAILED",
            "TRANSFER_CANCELLED",
          ],
        },
      ],
    });

    if (!account.apiKey || !account.walletId) {
      throw new Error(
        "O Asaas não retornou a credencial ou a carteira da subconta.",
      );
    }

    const document = String(body.cpfCnpj || "").replace(/\D/g, "");

    await context.supabase
      .from("marketplace_payment_settings")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("company_id", companyId);

    const payload = {
      company_id: companyId,
      provider: "asaas",
      provider_account_id: account.id,
      provider_wallet_id: account.walletId,
      encrypted_provider_api_key: encryptPaymentCredential(account.apiKey),
      onboarding_status: "started",
      account_status: account.status,
      charges_enabled: false,
      payouts_enabled: false,
      card_enabled: false,
      pix_enabled: true,
      is_active: true,
      onboarding_url: account.onboardingUrl || null,
      legal_name: String(body.name || "").trim(),
      document_last4: document.slice(-4) || null,
      updated_at: new Date().toISOString(),
    };

    const query = existing?.id
      ? context.supabase
          .from("marketplace_payment_settings")
          .update(payload)
          .eq("id", existing.id)
      : context.supabase.from("marketplace_payment_settings").insert(payload);

    const { data, error } = await query.select(PUBLIC_ACCOUNT_FIELDS).single();
    if (error) throw error;

    return NextResponse.json({ ok: true, account: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a conta de recebimento.",
      },
      { status: statusOf(error) },
    );
  }
}
