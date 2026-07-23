// ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
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
      <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 p-6 text-white md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-100">
            Recebimentos da empresa
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
            Pagamentos
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-violet-100 md:text-base">
            Configure sua conta Asaas, acompanhe cada venda e receba o valor
            lÃ­quido na chave Pix cadastrada, com a comissÃ£o do OrÃ§aly jÃ¡
            descontada.
          </p>
        </div>
      </header>

      {useAsaas ? <AsaasFinancialPanel /> : legacy}
    </div>
  );
}
