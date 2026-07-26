// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)),
    );

    const { data, error } = await context.supabase
      .from("marketplace_payments")
      .select(
        "id,order_id,provider,payment_method,gross_amount,provider_fee_amount,provider_net_amount,platform_fee_percent,platform_fee_amount,seller_net_amount,currency,status,split_status,payout_status,external_reference,paid_at,created_at,updated_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ transactions: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as transacoes.",
      },
      { status: 500 },
    );
  }
}
