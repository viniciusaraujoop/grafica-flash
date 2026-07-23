// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  resolveCompanyBySlug,
} from "@/lib/payments/server-context";

type Context = {
  params: Promise<{ slug: string; paymentId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  try {
    const { slug, paymentId } = await context.params;
    const { supabase, company } = await resolveCompanyBySlug(slug);
    const companyId = String(company.id);

    const { data: transaction } = await supabase
      .from("marketplace_payments")
      .select("provider_payment_id")
      .eq("company_id", companyId)
      .eq("provider_payment_id", paymentId)
      .maybeSingle();

    if (!transaction) {
      return NextResponse.json(
        { error: "Pagamento nao encontrado." },
        { status: 404 },
      );
    }

    const account = await getCompanyProviderAccount(companyId);
    const provider = new AsaasProvider(account.apiKey);
    const payment = await provider.getPayment(paymentId);

    return NextResponse.json({ payment });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar o pagamento.",
      },
      { status: 500 },
    );
  }
}
