// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import { NextRequest, NextResponse } from "next/server";
import { createAutomaticPayoutForTransaction } from "@/lib/payments/payout-service";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function POST(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const body = await request.json();
    const payoutId = String(body.payoutId || "").trim();

    if (!payoutId) {
      return NextResponse.json(
        { error: "Informe o repasse que será reenviado." },
        { status: 400 },
      );
    }

    const { data: payout } = await context.supabase
      .from("payment_payouts")
      .select("id,marketplace_payment_id,status")
      .eq("id", payoutId)
      .eq("company_id", String(context.company.id))
      .maybeSingle();

    if (!payout?.marketplace_payment_id) {
      return NextResponse.json(
        { error: "Repasse não encontrado." },
        { status: 404 },
      );
    }

    if (!["FAILED", "CANCELLED", "BLOCKED"].includes(String(payout.status).toUpperCase())) {
      return NextResponse.json(
        { error: "Este repasse não pode ser reenviado no estado atual." },
        { status: 409 },
      );
    }

    const result = await createAutomaticPayoutForTransaction(
      String(payout.marketplace_payment_id),
      { force: true },
    );

    return NextResponse.json({ ok: result.created, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível reenviar o repasse.",
      },
      { status: 500 },
    );
  }
}
