// ORCALY_PAYMENTS_PREMIUM_V2
import type { ReactNode } from "react";
import AsaasFinancialPanel from "@/components/payments/AsaasFinancialPanel";

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 3 4.5 6v5.2c0 4.6 3 8.4 7.5 9.8 4.5-1.4 7.5-5.2 7.5-9.8V6L12 3Z" />
      <path d="m9.5 12 1.7 1.7 3.7-4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
      <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5.5 13 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M7 7h11l-3-3" />
      <path d="m18 7-3 3" />
      <path d="M17 17H6l3 3" />
      <path d="m6 17 3-3" />
    </svg>
  );
}

export default function PaymentsHub({
  legacy,
  useAsaas,
}: {
  legacy: ReactNode;
  useAsaas: boolean;
}) {
  return (
    <div className="min-w-0 max-w-full space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-[2rem] border border-violet-200/70 bg-slate-950 text-white shadow-[0_24px_80px_-40px_rgba(76,29,149,0.8)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-violet-100 backdrop-blur">
                <SparkIcon />
                Central financeira
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Recebimentos
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Acompanhe suas vendas, veja o valor liquido de cada pedido e
                configure o repasse automatico para sua chave Pix.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
              {[
                {
                  icon: <ShieldIcon />,
                  title: "Checkout seguro",
                  text: "Dados protegidos",
                },
                {
                  icon: <TransferIcon />,
                  title: "Repasse automatico",
                  text: "Direto para sua conta",
                },
                {
                  icon: <SparkIcon />,
                  title: "Controle completo",
                  text: "Tudo em um so lugar",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
                >
                  <div className="text-violet-200">{item.icon}</div>
                  <p className="mt-3 text-sm font-black text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {useAsaas ? <AsaasFinancialPanel /> : legacy}
    </div>
  );
}
