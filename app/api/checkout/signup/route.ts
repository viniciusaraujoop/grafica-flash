import { NextRequest, NextResponse } from "next/server";
import { loadSignupCheckout } from "@/lib/signup-checkout";
import { parseBrazilTaxId } from "@/lib/brazil-tax-id";

function statusFor(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    return Number((error as { status?: number }).status || 500);
  }

  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const leadId = String(
      request.nextUrl.searchParams.get("lead_id") || "",
    ).trim();
    const expires = request.nextUrl.searchParams.get("expires");
    const token = request.nextUrl.searchParams.get("token");
    const checkout = await loadSignupCheckout(leadId, expires, token);
    const taxId = parseBrazilTaxId(checkout.document);

    return NextResponse.json({
      ...checkout,
      document: taxId.valid ? taxId.number : "",
      documentNeedsCorrection: Boolean(taxId.number) && !taxId.valid,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o pagamento.",
      },
      { status: statusFor(error) },
    );
  }
}