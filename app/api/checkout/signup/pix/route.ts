import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";
import { getClientIp, requireSameOrigin } from "@/lib/orcaly-security";
import { createSignupPix } from "@/lib/signup-checkout";
import {
  invalidBrazilTaxIdMessage,
  parseBrazilTaxId,
} from "@/lib/brazil-tax-id";

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
      scope: "signup-pix",
      limit: 10,
      windowSeconds: 600,
      identity: `${getClientIp(request)}:${leadId}`,
    });
    if (blocked) return blocked;
    const taxId = parseBrazilTaxId(body.document);

    if (!taxId.valid) {
      return NextResponse.json(
        { error: invalidBrazilTaxIdMessage(body.document) },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await createSignupPix({
        leadId,
        expires: body.expires,
        checkoutToken: body.token,
        document: taxId.number,
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
            : "Não foi possível gerar o Pix.",
      },
      { status: statusFor(error) },
    );
  }
}