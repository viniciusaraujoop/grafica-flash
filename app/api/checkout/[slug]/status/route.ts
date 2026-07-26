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
  }>;
};

function statusFor(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    return Number(
      (error as { status?: number })
        .status || 500,
    );
  }

  return 500;
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const paymentId = String(
      request.nextUrl.searchParams.get(
        "paymentId",
      ) || "",
    ).trim();

    if (!paymentId) {
      return NextResponse.json(
        {
          error:
            "Informe o pagamento.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await getCheckoutPaymentStatus(
        slug,
        paymentId,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar o pagamento.",
      },
      { status: statusFor(error) },
    );
  }
}
