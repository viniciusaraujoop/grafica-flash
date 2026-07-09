import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AssinaturaRetornoPage() {
  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-12 text-[#05245c]">
      <section className="mx-auto max-w-2xl rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-3xl">
          💳
        </div>

        <h1 className="text-3xl font-black">Assinatura em processamento</h1>

        <p className="mt-4 text-base font-semibold text-slate-600">
          Recebemos o retorno do Mercado Pago. A confirmação pode levar alguns instantes,
          especialmente em pagamentos por Pix.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/assinatura"
            className="rounded-2xl bg-[#05245c] px-6 py-3 font-black text-white transition hover:opacity-90"
          >
            Ver assinatura
          </Link>

          <Link
            href="/painel"
            className="rounded-2xl border border-blue-100 bg-white px-6 py-3 font-black text-[#05245c] transition hover:bg-blue-50"
          >
            Ir para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}
