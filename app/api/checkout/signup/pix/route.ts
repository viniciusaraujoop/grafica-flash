import { NextRequest, NextResponse } from "next/server";
import { createSignupPix } from "@/lib/signup-checkout";
import {
  invalidBrazilTaxIdMessage,
  parseBrazilTaxId,
} from "@/lib/brazil-tax-id";

function statusFor(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const taxId = parseBrazilTaxId(body.document);

    if (!taxId.valid) {
      return NextResponse.json(
        { error: invalidBrazilTaxIdMessage(body.document) },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await createSignupPix({
        leadId: String(body.leadId || body.lead_id || ""),
        expires: body.expires,
        checkoutToken: body.token,
        document: taxId.number,
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