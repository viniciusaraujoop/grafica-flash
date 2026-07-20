import { NextRequest, NextResponse } from "next/server";
import { cancelCompanySubscription } from "@/lib/subscription-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await cancelCompanySubscription(request, body?.reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível cancelar sua assinatura.";
    const status = message.toLowerCase().includes("não autorizado")
      ? 401
      : message.toLowerCase().includes("permissão")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
