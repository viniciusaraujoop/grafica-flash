import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getFounderProviderSubscription,
  isClosedSubscription,
  providerAmountCents,
  providerStatus,
  updateFounderSubscriptionToNormalPrice,
} from "@/lib/founder-billing";
import {
  getSupabaseAdmin,
} from "@/lib/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Conversion = {
  company_id: string;
  claim_id: string;
  provider_subscription_id: string;
  normal_price_cents: number;
};

function authorizedCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false as const,
      status: 503,
      error:
        "CRON_SECRET não configurado no ambiente.",
    };
  }

  const authorization =
    request.headers.get("authorization") || "";

  if (authorization !== `Bearer ${secret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "Não autorizado.",
    };
  }

  return { ok: true as const };
}

async function releaseConversion(
  admin: ReturnType<typeof getSupabaseAdmin>,
  item: Conversion,
  reason: string,
) {
  const { error } = await admin.rpc(
    "release_founder_price_conversion_claim",
    {
      p_company_id: item.company_id,
      p_claim_id: item.claim_id,
      p_error: reason.slice(0, 1000),
    },
  );

  if (error) {
    console.error(
      "orcaly_founder_conversion_claim_release_error",
      error.message,
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizedCron(request);

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const admin = getSupabaseAdmin();

  const { data: expiredTrials, error: trialError } =
    await admin.rpc("expire_due_founder_trials");

  if (trialError) {
    return NextResponse.json(
      { error: trialError.message },
      { status: 500 },
    );
  }

  const { data, error: claimError } =
    await admin.rpc(
      "claim_due_founder_price_conversions",
      { p_limit: 20 },
    );

  if (claimError) {
    return NextResponse.json(
      { error: claimError.message },
      { status: 500 },
    );
  }

  const conversions = (
    Array.isArray(data) ? data : []
  ) as Conversion[];

  let converted = 0;
  const failures: Array<{
    company_id: string;
    error: string;
  }> = [];

  for (const item of conversions) {
    try {
      const { data: paymentRow, error: paymentError } =
        await admin
          .from("plan_payments")
          .select(
            "id,provider_subscription_id,mercado_pago_preapproval_id",
          )
          .eq("company_id", item.company_id)
          .eq(
            "idempotency_key",
            "founder-recurring-v1",
          )
          .maybeSingle();

      if (paymentError) throw paymentError;

      const linkedSubscription =
        String(
          paymentRow?.provider_subscription_id ||
            paymentRow
              ?.mercado_pago_preapproval_id ||
            "",
        ).trim();

      if (
        !linkedSubscription ||
        linkedSubscription !==
          item.provider_subscription_id
      ) {
        throw new Error(
          "FOUNDER_CONVERSION_SUBSCRIPTION_LINK_MISMATCH",
        );
      }

      let subscription =
        await getFounderProviderSubscription(
          item.provider_subscription_id,
        );
      let action = "already_standard";

      if (isClosedSubscription(subscription)) {
        action = "cancelled";
      } else if (
        providerAmountCents(subscription) !==
        Number(item.normal_price_cents)
      ) {
        subscription =
          await updateFounderSubscriptionToNormalPrice(
            item.provider_subscription_id,
            Number(item.normal_price_cents),
          );
        action = "updated";
      }

      if (
        action !== "cancelled" &&
        providerAmountCents(subscription) !==
          Number(item.normal_price_cents)
      ) {
        throw new Error(
          "FOUNDER_CONVERSION_PROVIDER_AMOUNT_MISMATCH",
        );
      }

      const { error: completeError } =
        await admin.rpc(
          "complete_founder_price_conversion",
          {
            p_company_id: item.company_id,
            p_claim_id: item.claim_id,
            p_provider_status:
              providerStatus(subscription),
            p_provider_payload: subscription,
            p_action: action,
          },
        );

      if (completeError) throw completeError;

      converted += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro desconhecido.";

      failures.push({
        company_id: item.company_id,
        error: message,
      });

      await releaseConversion(
        admin,
        item,
        message,
      );
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    expired_trials:
      Number(expiredTrials || 0),
    claimed_conversions: conversions.length,
    converted,
    failures,
  });
}
