import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createTransparentSubscription,
} from "@/lib/subscription-mercado-pago-transparent";

export const runtime = "nodejs";

function errorStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    return Number(
      (error as { status?: number }).status || 500,
    );
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await createTransparentSubscription(request),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível configurar a assinatura.",
      },
      { status: errorStatus(error) },
    );
  }
}
