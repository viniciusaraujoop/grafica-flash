import { NextRequest, NextResponse } from "next/server";
import {
  createSignupCardSubscription,
} from "@/lib/signup-checkout";

function statusFor(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json(
      await createSignupCardSubscription({
        leadId: String(body.leadId || body.lead_id || ""),
        expires: body.expires,
        checkoutToken: body.token,
        cardTokenId: body.cardTokenId || body.card_token_id,
        payerEmail: body.payerEmail || body.payer_email,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar o cartão.",
      },
      { status: statusFor(error) },
    );
  }
}
