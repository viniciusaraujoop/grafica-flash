import { NextRequest, NextResponse } from "next/server";
import { createSignupPix } from "@/lib/signup-checkout";

function statusFor(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json(
      await createSignupPix({
        leadId: String(body.leadId || body.lead_id || ""),
        expires: body.expires,
        checkoutToken: body.token,
        document: body.document,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o Pix.",
      },
      { status: statusFor(error) },
    );
  }
}
