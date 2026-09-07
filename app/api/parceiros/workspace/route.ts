import { NextRequest, NextResponse } from "next/server";
import { affiliateStatusCode } from "@/lib/affiliates/server";
import {
  getPartnerWorkspace,
  partnerWorkspaceAction,
} from "@/lib/affiliates/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getPartnerWorkspace(request));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a Central Comercial.",
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

    return NextResponse.json(
      await partnerWorkspaceAction(request, body),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a ação.",
      },
      { status: affiliateStatusCode(error) },
    );
  }
}
