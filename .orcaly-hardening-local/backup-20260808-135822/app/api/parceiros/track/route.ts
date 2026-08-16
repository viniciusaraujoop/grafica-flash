// ORCALY_AFFILIATE_PROGRAM_V1
import { NextRequest, NextResponse } from "next/server";
import {
  requestIp,
  trackAffiliateClick,
} from "@/lib/affiliates/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

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
  } catch {
    return NextResponse.json({ tracked: false });
  }
}
