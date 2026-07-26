// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest, NextResponse } from "next/server";
import { handleAsaasSubscriptionCheckout } from "@/lib/payments/subscription-asaas";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await handleAsaasSubscriptionCheckout(request),
    );
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status || 500)
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a assinatura.",
      },
      { status },
    );
  }
}
