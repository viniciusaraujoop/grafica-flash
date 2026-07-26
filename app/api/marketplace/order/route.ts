import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || "").trim();

  return NextResponse.json(
    {
      error: "O fluxo antigo foi desativado. Utilize o checkout unificado.",
      code: "LEGACY_CHECKOUT_DISABLED",
      checkout_url: slug
        ? `/checkout/${encodeURIComponent(slug)}`
        : null,
    },
    { status: 410 },
  );
}
