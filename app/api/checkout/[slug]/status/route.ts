// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  resolveCompanyBySlug,
} from "@/lib/payments/server-context";

type Context = { params: Promise<{ slug: string }> };

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const paymentId = String(
      request.nextUrl.searchParams.get("paymentId") || "",
    ).trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Informe o pagamento." },
        { status: 400 },
      );
    }

    const { supabase, company } = await resolveCompanyBySlug(slug);
    const companyId = String(company.id || "");
    const { data: transaction } = await supabase
      .from("marketplace_payments")
      .select("id,provider_payment_id,status,order_id,paid_at")
      .eq("company_id", companyId)
      .eq("provider", "asaas")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    if (!transaction) {
      return NextResponse.json(
        { error: "Pagamento nao encontrado." },
        { status: 404 },
      );
    }

    if (
      ["PAID", "RECEIVED", "CONFIRMED", "REFUNDED", "CANCELLED"].includes(
        String(transaction.status || "").toUpperCase(),
      )
    ) {
      return NextResponse.json(transaction);
    }

    const account = await getCompanyProviderAccount(companyId);
    const provider = new AsaasProvider(account.apiKey);
    const remote = await provider.getPayment(paymentId);

    return NextResponse.json({
      ...transaction,
      providerStatus: remote.status,
    });
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error
        ? Number((error as { status?: number }).status || 500)
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar o pagamento.",
      },
      { status },
    );
  }
}
