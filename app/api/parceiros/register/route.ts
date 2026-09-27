// ORCALY_AFFILIATE_PROGRAM_V1
import { NextRequest, NextResponse } from "next/server";
import {
  affiliateStatusCode,
  registerAffiliate,
  requestIp,
} from "@/lib/affiliates/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";
import { requireSameOrigin } from "@/lib/orcaly-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request);
    if (originError) return originError;
    const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);
    const normalizedEmail = String(body.email || "").trim().toLowerCase();
    const ip = requestIp(request);
    const blocked = await enforceRateLimit(request, {
      scope: "partner-register",
      limit: 8,
      windowSeconds: 3600,
      identity: `${ip}:${normalizedEmail}`,
    });
    if (blocked) return blocked;

    return NextResponse.json(
      await registerAffiliate({
        name: body.name,
        email: normalizedEmail,
        password: body.password,
        whatsapp: body.whatsapp,
        document: body.document,
        termsAccepted: body.termsAccepted,
        marketingOptIn: body.marketingOptIn,
        ip,
      }),
      { status: 201 },
    );
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o cadastro.",
      },
      { status: affiliateStatusCode(error) },
    );
  }
}
