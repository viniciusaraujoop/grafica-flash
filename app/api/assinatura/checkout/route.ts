import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rejectOversizedRequest, requireSameOrigin } from "@/lib/orcaly-security";
import {
  createSubscriptionCheckoutPayment,
  subscriptionCheckoutStatusCode,
} from "@/lib/subscription-checkout-payment";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;
    const sizeError = rejectOversizedRequest(request, 64 * 1024);
    if (sizeError) return sizeError;
    const blocked = await enforceRateLimit(request, {
      scope: "subscription-checkout",
      limit: 15,
      windowSeconds: 600,
    });
    if (blocked) return blocked;
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
