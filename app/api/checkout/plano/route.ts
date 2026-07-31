import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      deprecated: true,
      route: "/api/checkout/plano",
      replacement: {
        one_time: "/api/assinatura/checkout",
        recurring: "/api/assinatura/mercado-pago",
        management: "/api/company/subscription",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Esta rota foi desativada para impedir conflito entre implementaÃ§Ãµes de assinatura.",
      code: "LEGACY_PAYMENT_ROUTE_DISABLED",
      replacement: {
        one_time: "/api/assinatura/checkout",
        recurring: "/api/assinatura/mercado-pago",
      },
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
