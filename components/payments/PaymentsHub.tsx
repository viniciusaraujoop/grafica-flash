// ORCALY_ASAAS_MIGRATION_V2
import type { ReactNode } from "react";
import AsaasFinancialPanel from "@/components/payments/AsaasFinancialPanel";

export default function PaymentsHub({
  legacy,
  useAsaas,
}: {
  legacy: ReactNode;
  useAsaas: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-sm font-bold text-violet-600">Financeiro da empresa</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Pagamentos</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
          Gerencie sua conta de recebimento, acompanhe transacoes e consulte os repasses das vendas realizadas pelo seu site.
        </p>
      </header>

      {useAsaas ? <AsaasFinancialPanel /> : legacy}
    </div>
  );
}
