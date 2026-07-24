import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error: "A integracao antiga foi desativada.",
      code: "LEGACY_PROVIDER_DISABLED",
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
