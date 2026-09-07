import { NextRequest, NextResponse } from "next/server";
import { affiliateStatusCode } from "@/lib/affiliates/server";
import { getPartnerPortalV2, partnerPortalV2Action } from "@/lib/affiliates/portal-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getPartnerPortalV2(request));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o Portal de Parceiros 2.0." },
      { status: affiliateStatusCode(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await partnerPortalV2Action(request, body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível concluir a ação." },
      { status: affiliateStatusCode(error) },
    );
  }
}
