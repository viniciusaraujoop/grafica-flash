import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AssinaturaRetornoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-black text-blue-700">✓</div>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">Assinatura em processamento</h1>
        <p className="mt-3 font-medium leading-7 text-slate-600">
          Recebemos o retorno do Mercado Pago. A confirmação pode levar alguns instantes, especialmente em pagamentos por Pix.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/painel/assinatura" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Ver assinatura</Link>
          <Link href="/painel" className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700">Ir para o painel</Link>
        </div>
      </section>
    </main>
  );
}
