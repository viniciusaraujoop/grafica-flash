// ORCALY_ASAAS_MIGRATION_V2
import Link from "next/link";

export default function AdminAsaasPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-sm font-bold text-violet-600">Administracao financeira</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Asaas e conciliacao</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Consulte contas, transacoes, splits, repasses e webhooks pelas APIs administrativas existentes. Nenhuma credencial e exibida nesta pagina.
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Contas financeiras", "Status cadastral, cobrancas e repasses habilitados."],
            ["Transacoes e splits", "Valores brutos, tarifas, comissoes e divergencias."],
            ["Webhooks", "Eventos recebidos, processados e pendentes de conciliacao."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </section>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
          As acoes de consulta e conciliacao devem permanecer protegidas pelas regras administrativas atuais. Nao ha aprovacao forcada ou alteracao manual de valores.
        </div>
        <Link href="/admin/pagamentos" className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
          Voltar para pagamentos
        </Link>
      </div>
    </main>
  );
}
