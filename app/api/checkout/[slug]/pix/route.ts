// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutPayment } from "@/lib/payments/checkout-service";
import { paymentErrorMessage, paymentErrorStatus } from "@/lib/payments/payment-errors";

type Context = { params: Promise<{ slug: string }> };

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        { ...body, paymentMethod: "PIX", card: undefined },
        request,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: paymentErrorMessage(error) },
      { status: paymentErrorStatus(error) },
    );
  }
}
