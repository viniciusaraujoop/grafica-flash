import { NextResponse } from "next/server";

function inspect(value: string | undefined) {
  const raw = String(value || "");
  const trimmed = raw.trim();

  return {
    present: Boolean(raw),
    trimmed_present: Boolean(trimmed),
    length: trimmed.length,
    has_whitespace_edges: raw !== trimmed,
    prefix:
      trimmed.startsWith("APP_USR-")
        ? "APP_USR"
        : trimmed.startsWith("TEST-")
          ? "TEST"
          : trimmed
            ? "OTHER"
            : "EMPTY",
  };
}

export async function GET() {
  return NextResponse.json(
    {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      subscription_public_key: inspect(
        process.env.NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY,
      ),
      subscription_access_token: inspect(
        process.env.MP_SUBSCRIPTION_ACCESS_TOKEN,
      ),
      signup_public_key_present: Boolean(
        String(process.env.NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY || "").trim(),
      ),
      marketplace_public_key_present: Boolean(
        String(process.env.NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY || "").trim(),
      ),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
