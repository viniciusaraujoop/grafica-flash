import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  prepareCheckoutPayment,
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

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await prepareCheckoutPayment(
        slug,
        body,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel calcular o checkout.",
      },
      { status: statusFor(error) },
    );
  }
}
