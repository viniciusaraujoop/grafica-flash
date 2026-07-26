import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getCheckoutPaymentStatus,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
    paymentId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  try {
    const {
      slug,
      paymentId,
    } = await context.params;

    const payment =
      await getCheckoutPaymentStatus(
        slug,
        paymentId,
      );

    return NextResponse.json({
      payment,
    });
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
            : "Nao foi possivel consultar o Pix.",
      },
      { status },
    );
  }
}
