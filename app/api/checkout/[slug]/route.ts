// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import {
  createCheckoutPayment,
  getCheckoutCatalog,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{ slug: string }>;
};

function errorStatus(error: unknown) {
  return Number(
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status || 500
      : 500,
  );
}

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    return NextResponse.json(await getCheckoutCatalog(slug));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o checkout.",
      },
      { status: errorStatus(error) },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    return NextResponse.json(
      await createCheckoutPayment(slug, body, request),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar o pagamento.",
      },
      { status: errorStatus(error) },
    );
  }
}
