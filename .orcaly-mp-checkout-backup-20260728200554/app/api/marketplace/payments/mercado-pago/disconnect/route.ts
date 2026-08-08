import { NextRequest, NextResponse } from "next/server";
// ORCALY_MP_AUTO_DISABLE_V1
import {
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
} from "@/lib/company-access";

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requester = await getRequester(
      request,
      supabaseAdmin,
    );

    if (!requester) {
      return NextResponse.json(
        { error: "Nao autorizado." },
        { status: 401 },
      );
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    );

    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa nao encontrada." },
        { status: 404 },
      );
    }

    if (!access.canConfig && !access.canFinance) {
      return NextResponse.json(
        {
          error:
            "Sem permissao para desconectar pagamentos.",
        },
        { status: 403 },
      );
    }

    const { error } = await supabaseAdmin
      .from("marketplace_payment_settings")
      .update({
        is_active: false,
        onboarding_status: "disconnected",
        account_status: "disconnected",
        charges_enabled: false,
        pix_enabled: false,
        card_enabled: false,
        last_status_check_at: new Date().toISOString(),
        access_token: null,
        refresh_token: null,
        public_key: null,
        token_expires_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", access.company.id)
      .eq("provider", "mercado_pago");

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao desconectar Mercado Pago.",
      },
      { status: 500 },
    );
  }
}
