import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";
import { getClientIp, requireSameOrigin } from "@/lib/orcaly-security";
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
    const originError = requireSameOrigin(request);
    if (originError) return originError;
    const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);
    const leadId = String(body.leadId || body.lead_id || "");
    const blocked = await enforceRateLimit(request, {
      scope: "signup-card",
      limit: 8,
      windowSeconds: 600,
      identity: `${getClientIp(request)}:${leadId}`,
    });
    if (blocked) return blocked;

    return NextResponse.json(
      await createSignupCardSubscription({
        leadId,
        expires: body.expires,
        checkoutToken: body.token,
        cardTokenId: body.cardTokenId || body.card_token_id,
        payerEmail: body.payerEmail || body.payer_email,
      }),
    );
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

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
