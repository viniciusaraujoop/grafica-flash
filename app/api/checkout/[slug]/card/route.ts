import {
  NextRequest,
  NextResponse,
} from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rejectOversizedRequest, requireSameOrigin } from "@/lib/orcaly-security";
import {
  createCheckoutPayment,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;
    const sizeError = rejectOversizedRequest(request, 64 * 1024);
    if (sizeError) return sizeError;
    const { slug } =
      await context.params;
    const blocked = await enforceRateLimit(request, {
      scope: "public-checkout-card",
      limit: 12,
      windowSeconds: 600,
      identity: slug,
    });
    if (blocked) return blocked;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        {
          ...body,
          paymentMethod:
            "CREDIT_CARD",
        },
        request,
      ),
    );
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error
        ? Number(
            (
              error as {
                status?: number;
              }
            ).status || 500,
          )
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel processar o cartao.",
      },
      { status },
    );
  }
}
