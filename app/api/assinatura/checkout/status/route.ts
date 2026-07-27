import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionCheckoutPaymentStatus,
  subscriptionCheckoutStatusCode,
} from "@/lib/subscription-checkout-payment";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const paymentId = String(
      request.nextUrl.searchParams.get("paymentId") || "",
    ).trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Informe o pagamento." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await getSubscriptionCheckoutPaymentStatus(
        request,
        paymentId,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o pagamento.",
      },
      { status: subscriptionCheckoutStatusCode(error) },
    );
  }
}
