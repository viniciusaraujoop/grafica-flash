// ORCALY_AFFILIATE_PROGRAM_V1
import { NextRequest, NextResponse } from "next/server";
import {
  affiliateStatusCode,
  getAffiliateDashboard,
  requestAffiliatePayout,
  saveAffiliatePayoutAccount,
} from "@/lib/affiliates/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getAffiliateDashboard(request));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o portal.",
      },
      { status: affiliateStatusCode(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = String(body.action || "").trim();

    if (action === "save_payout_account") {
      return NextResponse.json(
        await saveAffiliatePayoutAccount(request, body),
      );
    }

    if (action === "request_payout") {
      return NextResponse.json(await requestAffiliatePayout(request));
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
      },
      { status: affiliateStatusCode(error) },
    );
  }
}
