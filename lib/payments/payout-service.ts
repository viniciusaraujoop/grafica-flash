// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
import "server-only";
import { randomUUID } from "node:crypto";
import { decryptPaymentCredential } from "@/lib/payments/credential-encryption";
import { AsaasProvider, type PixKeyType } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  getSupabaseAdmin,
} from "@/lib/payments/server-context";

type JsonRecord = Record<string, unknown>;

type PayoutResult = {
  created: boolean;
  reason?: string;
  payoutId?: string;
  providerPayoutId?: string;
  status?: string;
};

function money(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function text(value: unknown) {
  return String(value || "").trim();
}

export async function createAutomaticPayoutForTransaction(
  transactionId: string,
  options: { force?: boolean } = {},
): Promise<PayoutResult> {
  const supabase = getSupabaseAdmin();

  const { data: transaction, error: transactionError } = await supabase
    .from("marketplace_payments")
    .select("*")
    .eq("id", transactionId)
    .eq("provider", "asaas")
    .maybeSingle();

  if (transactionError || !transaction?.id) {
    return { created: false, reason: "Transação não encontrada." };
  }

  const normalizedStatus = text(transaction.status).toUpperCase();
  if (!["PAID", "RECEIVED", "CONFIRMED"].includes(normalizedStatus)) {
    return { created: false, reason: "Pagamento ainda não confirmado." };
  }

  const { data: settings } = await supabase
    .from("marketplace_payment_settings")
    .select("*")
    .eq("company_id", transaction.company_id)
    .eq("provider", "asaas")
    .eq("is_active", true)
    .maybeSingle();

  if (!settings?.automatic_payout_enabled && !options.force) {
    return { created: false, reason: "Transferência automática desativada." };
  }

  if (!settings?.payouts_enabled) {
    return { created: false, reason: "Repasses ainda não habilitados." };
  }

  if (!settings?.payout_pix_key_encrypted || !settings?.payout_pix_key_type) {
    return { created: false, reason: "Chave Pix de repasse não configurada." };
  }

  const amount = money(transaction.seller_net_amount);
  const minimum = money(settings.minimum_payout_amount);

  if (amount <= 0) {
    return { created: false, reason: "Valor líquido ainda indisponível." };
  }

  if (amount < minimum && !options.force) {
    return {
      created: false,
      reason: "Valor líquido abaixo do mínimo configurado.",
    };
  }

  const { data: existing } = await supabase
    .from("payment_payouts")
    .select("*")
    .eq("marketplace_payment_id", transaction.id)
    .maybeSingle();

  const existingStatus = text(existing?.status).toUpperCase();
  if (
    existing?.provider_payout_id &&
    !["FAILED", "CANCELLED", "BLOCKED"].includes(existingStatus)
  ) {
    return {
      created: false,
      reason: "A transferência já foi criada.",
      payoutId: text(existing.id),
      providerPayoutId: text(existing.provider_payout_id),
      status: text(existing.status),
    };
  }

  const payoutId = text(existing?.id) || randomUUID();
  const externalReference = `payout:${transaction.id}`;

  await supabase.from("payment_payouts").upsert(
    {
      id: payoutId,
      company_id: transaction.company_id,
      marketplace_payment_id: transaction.id,
      provider: "asaas",
      amount,
      status: "CREATING",
      external_reference: externalReference,
      pix_key_type: settings.payout_pix_key_type,
      pix_key_masked: settings.payout_pix_key_masked,
      attempts: Number(existing?.attempts || 0) + 1,
      failure_reason: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "marketplace_payment_id" },
  );

  try {
    const account = await getCompanyProviderAccount(
      String(transaction.company_id),
    );
    const provider = new AsaasProvider(account.apiKey);
    const pixKey = decryptPaymentCredential(
      String(settings.payout_pix_key_encrypted),
    );

    const transfer = await provider.createPixTransfer({
      value: amount,
      pixAddressKey: pixKey,
      pixAddressKeyType: String(
        settings.payout_pix_key_type,
      ) as PixKeyType,
      description: `Repasse do pedido ${transaction.order_id || transaction.id}`,
      externalReference,
    });

    await supabase
      .from("payment_payouts")
      .update({
        provider_payout_id: transfer.id,
        status: transfer.status,
        expected_at: transfer.effectiveDate || null,
        paid_at:
          transfer.status.toUpperCase() === "DONE"
            ? new Date().toISOString()
            : null,
        failure_reason: transfer.failReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId)
      .eq("company_id", transaction.company_id);

    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: transfer.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("company_id", transaction.company_id);

    if (transfer.status.toUpperCase() === "DONE") {
      await supabase
        .from("marketplace_payment_settings")
        .update({
          last_payout_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", transaction.company_id)
        .eq("provider", "asaas")
        .eq("is_active", true);
    }

    return {
      created: true,
      payoutId,
      providerPayoutId: transfer.id,
      status: transfer.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Falha no repasse.";

    await supabase
      .from("payment_payouts")
      .update({
        status: "FAILED",
        failure_reason: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId)
      .eq("company_id", transaction.company_id);

    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: "FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("company_id", transaction.company_id);

    return { created: false, reason: message, payoutId, status: "FAILED" };
  }
}

export async function updatePayoutFromTransferEvent(
  transfer: JsonRecord,
  eventType: string,
) {
  const supabase = getSupabaseAdmin();
  const providerPayoutId = text(transfer.id);
  if (!providerPayoutId) return false;

  const { data: payout } = await supabase
    .from("payment_payouts")
    .select("*")
    .eq("provider", "asaas")
    .eq("provider_payout_id", providerPayoutId)
    .maybeSingle();

  if (!payout?.id) return false;

  const eventStatus = eventType.replace(/^TRANSFER_/, "");
  const status = text(transfer.status || eventStatus).toUpperCase();
  const done = status === "DONE";
  const failure = text(
    transfer.failReason || transfer.failureReason || transfer.refusalReason,
  );

  await supabase
    .from("payment_payouts")
    .update({
      status,
      paid_at: done ? new Date().toISOString() : payout.paid_at,
      failure_reason: failure || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id)
    .eq("company_id", payout.company_id);

  if (payout.marketplace_payment_id) {
    await supabase
      .from("marketplace_payments")
      .update({
        payout_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.marketplace_payment_id)
      .eq("company_id", payout.company_id);
  }

  if (done) {
    await supabase
      .from("marketplace_payment_settings")
      .update({
        last_payout_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", payout.company_id)
      .eq("provider", "asaas")
      .eq("is_active", true);
  }

  return true;
}
