import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error:
        "A criacao de contas Asaas foi desativada. Conecte uma conta Mercado Pago no painel.",
      code: "ASAAS_ACCOUNT_DISABLED",
    },
    { status: 410 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
