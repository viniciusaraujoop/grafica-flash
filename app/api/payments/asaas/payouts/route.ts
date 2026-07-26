// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);

    const { data, error } = await context.supabase
      .from("payment_payouts")
      .select(
        "id,marketplace_payment_id,provider_payout_id,amount,status,expected_at,paid_at,failure_reason,external_reference,pix_key_type,pix_key_masked,attempts,created_at,updated_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ payouts: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os repasses.",
      },
      { status: 500 },
    );
  }
}
