// ORCALY_AFFILIATE_PROGRAM_V1
import { NextRequest, NextResponse } from "next/server";
import {
  requestIp,
  trackAffiliateClick,
} from "@/lib/affiliates/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 8 * 1024);
    const code = String(body.code || "").trim().toUpperCase().slice(0, 32);
    const blocked = await enforceRateLimit(request, {
      scope: "affiliate-click-track",
      limit: 60,
      windowSeconds: 60,
      identity: `${requestIp(request)}:${code || "unknown"}`,
    });
    if (blocked) return blocked;

    return NextResponse.json(
      await trackAffiliateClick({
        code: body.code,
        sessionId: body.sessionId,
        landingPath: body.landingPath,
        referrer: body.referrer,
        ip: requestIp(request),
        userAgent: request.headers.get("user-agent"),
      }),
    );
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ tracked: false });
  }
}
