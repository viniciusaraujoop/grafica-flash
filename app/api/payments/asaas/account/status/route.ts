// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  requireUserCompany,
} from "@/lib/payments/server-context";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const account = await getCompanyProviderAccount(companyId);
    const provider = new AsaasProvider(account.apiKey);
    const result = await provider.getProviderAccountStatus(
      String(account.record.provider_account_id || ""),
    );
    const status = String(result.status || "PENDING");
    const approved = ["APPROVED", "ACTIVE", "NORMAL"].includes(
      status.toUpperCase(),
    );

    await context.supabase
      .from("marketplace_payment_settings")
      .update({
        account_status: status,
        charges_enabled: approved,
        payouts_enabled: approved,
        pix_enabled: approved,
        card_enabled: approved,
        last_status_check_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("provider", "asaas");

    return NextResponse.json({
      ok: true,
      account: {
        status,
        chargesEnabled: approved,
        payoutsEnabled: approved,
        pixEnabled: approved,
        cardEnabled: approved,
      },
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status || 500)
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o status.",
      },
      { status },
    );
  }
}
