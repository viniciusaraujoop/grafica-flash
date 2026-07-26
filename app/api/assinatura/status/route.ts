// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import { NextRequest, NextResponse } from "next/server";
import { getAsaasCapabilities } from "@/lib/payments/asaas-config";
import { requireUserCompany } from "@/lib/payments/server-context";

export async function GET(request: NextRequest) {
  try {
    const context = await requireUserCompany(request);
    const companyId = String(context.company.id);
    const { data, error } = await context.supabase.from("plan_payments")
      .select("id,plano,valor,status,payment_method,next_payment_date,paid_at,cancelled_at,created_at")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    return NextResponse.json({
      subscription: {
        plan: context.company.assinatura_plano || context.company.plano,
        status: context.company.assinatura_status || "pendente",
        trialEndsAt: context.company.trial_ends_at || null,
        accessUntil: context.company.access_until || context.company.assinatura_expira_em || null,
        nextBillingAt: context.company.next_billing_at || context.company.assinatura_proxima_cobranca || null,
        cancelAtPeriodEnd: Boolean(context.company.cancel_at_period_end),
      },
      capabilities: {
        subscriptionsEnabled: getAsaasCapabilities().subscriptionsEnabled,
        cardEnabled: getAsaasCapabilities().cardTokenizationEnabled,
      },
      payments: data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel carregar a assinatura." }, { status: 500 });
  }
}
