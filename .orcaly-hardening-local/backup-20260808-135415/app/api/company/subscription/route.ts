import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionSnapshot,
  manageCompanySubscription,
} from "@/lib/subscription-service";

function statusForMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("não autorizado")) return 401;
  if (normalized.includes("permissão")) return 403;
  if (normalized.includes("não encontrada")) return 404;
  return 400;
}

export async function GET(request: NextRequest) {
  try {
    const snapshot = await getSubscriptionSnapshot(request);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar assinatura.";
    return NextResponse.json({ error: message }, { status: statusForMessage(message) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await manageCompanySubscription(request, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerenciar assinatura.";
    return NextResponse.json({ error: message }, { status: statusForMessage(message) });
  }
}
