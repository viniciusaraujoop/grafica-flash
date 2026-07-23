// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { getCheckoutCatalog } from "@/lib/payments/checkout-service";
import { paymentErrorMessage, paymentErrorStatus } from "@/lib/payments/payment-errors";

type Context = { params: Promise<{ slug: string }> };

export async function POST(
  _request: NextRequest,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    return NextResponse.json(await getCheckoutCatalog(slug));
  } catch (error) {
    return NextResponse.json(
      { error: paymentErrorMessage(error) },
      { status: paymentErrorStatus(error) },
    );
  }
}
