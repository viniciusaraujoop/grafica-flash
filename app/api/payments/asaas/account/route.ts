// ORCALY_ASAAS_MIGRATION_V2
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

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data } = await context.supabase
      .from("marketplace_payment_settings")
      .select(
        "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4,bank_name,bank_account_last4,bank_account_type,last_status_check_at,created_at,updated_at",
      )
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .maybeSingle();

    return NextResponse.json({
      configured: Boolean(data),
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
            : "Nao foi possivel consultar a conta.",
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
        {
          error:
            "A criacao de subcontas ainda nao foi habilitada no ambiente.",
        },
        { status: 409 },
      );
    }

    const context = await requireUserCompany(request);
    const body = await request.json();
    const companyId = String(context.company.id);

    const { data: existing } = await context.supabase
      .from("marketplace_payment_settings")
      .select("id,account_status")
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        repeated: true,
        account: existing,
      });
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
          name: "Orcaly pagamentos",
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
          ],
        },
      ],
    });

    if (!account.apiKey || !account.walletId) {
      throw new Error(
        "O Asaas nao retornou a credencial ou a carteira da subconta.",
      );
    }

    const document = String(body.cpfCnpj || "").replace(/\D/g, "");

    const { data, error } = await context.supabase
      .from("marketplace_payment_settings")
      .insert({
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
        onboarding_url: account.onboardingUrl || null,
        legal_name: String(body.name || "").trim(),
        document_last4: document.slice(-4) || null,
      })
      .select(
        "id,provider_account_id,provider_wallet_id,onboarding_status,account_status,charges_enabled,payouts_enabled,card_enabled,pix_enabled,onboarding_url,legal_name,document_last4",
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, account: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a conta de recebimento.",
      },
      { status: statusOf(error) },
    );
  }
}
