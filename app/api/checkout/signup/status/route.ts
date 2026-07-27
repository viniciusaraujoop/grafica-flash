import { NextRequest, NextResponse } from "next/server";
import {
  refreshSignupCheckoutStatus,
} from "@/lib/signup-checkout";

function statusFor(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const leadId = String(
      request.nextUrl.searchParams.get("lead_id") || "",
    ).trim();
    const expires = request.nextUrl.searchParams.get("expires");
    const token = request.nextUrl.searchParams.get("token");

    return NextResponse.json(
      await refreshSignupCheckoutStatus({
        leadId,
        expires,
        checkoutToken: token,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar o pagamento.",
      },
      { status: statusFor(error) },
    );
  }
}
