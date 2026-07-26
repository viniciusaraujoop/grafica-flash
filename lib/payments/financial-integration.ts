// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import { getSupabaseAdmin } from "@/lib/payments/server-context";

type FinancialInput = {
  companyId: string;
  orderId?: string;
  transactionId: string;
  grossAmount: number;
  providerFeeAmount?: number;
  platformFeeAmount?: number;
  sellerNetAmount?: number;
  paymentMethod: string;
};

export async function createFinancialEntryOnce(input: FinancialInput) {
  const supabase = getSupabaseAdmin();
  const externalReference = `payment:${input.transactionId}`;

  const { data: existing } = await supabase
    .from("financial_transactions")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("external_reference", externalReference)
    .maybeSingle();

  if (existing?.id) return { created: false, id: existing.id };

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      company_id: input.companyId,
      order_id: input.orderId || null,
      tipo: "entrada",
      valor: input.sellerNetAmount ?? input.grossAmount,
      valor_bruto: input.grossAmount,
      taxa: input.providerFeeAmount || 0,
      comissao: input.platformFeeAmount || 0,
      forma_pagamento: input.paymentMethod,
      descricao: "Recebimento de venda online",
      status: "confirmado",
      external_reference: externalReference,
    })
    .select("id")
    .single();

  if (error) {
    return {
      created: false,
      warning:
        "Pagamento confirmado, mas o financeiro existente exige conciliacao manual.",
    };
  }

  return { created: true, id: data.id };
}
