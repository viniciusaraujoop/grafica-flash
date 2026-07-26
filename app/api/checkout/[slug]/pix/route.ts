import {
  NextRequest,
  NextResponse,
} from "next/server";
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
    const { slug } =
      await context.params;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        {
          ...body,
          paymentMethod: "PIX",
          cardPayment: undefined,
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
            : "Nao foi possivel gerar o Pix.",
      },
      { status },
    );
  }
}
