// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { getPaymentFlags } from "@/lib/payments/asaas-config";
import { createCheckoutPayment } from "@/lib/payments/checkout-service";
import { paymentErrorMessage, paymentErrorStatus } from "@/lib/payments/payment-errors";

type Context = { params: Promise<{ slug: string }> };

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const flags = getPaymentFlags();

    if (!flags.cardTokenizationEnabled) {
      return NextResponse.json(
        {
          error:
            "O pagamento por cartao ainda nao foi habilitado. Utilize Pix.",
        },
        { status: 409 },
      );
    }

    const { slug } = await context.params;
    const body = await request.json();

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        { ...body, paymentMethod: "CREDIT_CARD" },
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
