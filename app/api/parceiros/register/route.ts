// ORCALY_AFFILIATE_PROGRAM_V1
import { NextRequest, NextResponse } from "next/server";
import {
  affiliateStatusCode,
  registerAffiliate,
  requestIp,
} from "@/lib/affiliates/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json(
      await registerAffiliate({
        name: body.name,
        email: body.email,
        password: body.password,
        whatsapp: body.whatsapp,
        document: body.document,
        termsAccepted: body.termsAccepted,
        marketingOptIn: body.marketingOptIn,
        ip: requestIp(request),
      }),
      { status: 201 },
    );
  } catch (error) {
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
