// ORCALY_AFFILIATE_PROGRAM_V1
// ORCALY_OWNER_BACKOFFICE_V2
import { NextRequest, NextResponse } from "next/server";
import {
  affiliateStatusCode,
  getAffiliateDashboard,
  requestAffiliatePayout,
  saveAffiliatePayoutAccount,
} from "@/lib/affiliates/server";
import {
  getCurrentPlatformAdminFromRequest,
  isOfficialPlatformOwner,
} from "@/lib/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const internal = await getCurrentPlatformAdminFromRequest(request);
    if (internal) {
      if (isOfficialPlatformOwner(internal)) {
        return NextResponse.json({ ok: true, internalPortal: true, destination: "/admin" });
      }
      if (internal.role === "support") {
        return NextResponse.json({ ok: true, internalPortal: true, destination: "/suporte" });
      }
    }
    return NextResponse.json(await getAffiliateDashboard(request));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o portal." },
      { status: affiliateStatusCode(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    if (action === "save_payout_account") return NextResponse.json(await saveAffiliatePayoutAccount(request, body));
    if (action === "request_payout") return NextResponse.json(await requestAffiliatePayout(request));
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a operação." },
      { status: affiliateStatusCode(error) },
    );
  }
}
