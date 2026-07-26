// ORCALY_ASAAS_MIGRATION_V2
import Link from "next/link";

export default function AdminPagamentosPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-violet-600">
          Administração financeira
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Pagamentos
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Consulte contas, transações, comissões, repasses, assinaturas,
          webhooks e itens que exigem conciliação.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/pagamentos/asaas"
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="text-sm font-bold text-violet-600">
            Migração controlada
          </span>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            Asaas
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Acompanhe a infraestrutura de sandbox e as empresas piloto.
          </p>
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="text-sm font-bold text-emerald-600">
            Provider legado
          </span>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            Mercado Pago preservado
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            O fallback permanece ativo enquanto a migração não for aprovada.
          </p>
        </div>
      </section>
    </main>
  );
}
