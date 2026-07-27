import { NextRequest, NextResponse } from "next/server";
import {
  createSubscriptionCheckoutPayment,
  subscriptionCheckoutStatusCode,
} from "@/lib/subscription-checkout-payment";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createSubscriptionCheckoutPayment(request),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível processar o pagamento.",
      },
      { status: subscriptionCheckoutStatusCode(error) },
    );
  }
}
