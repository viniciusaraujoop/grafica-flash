import Link from 'next/link'

export default function CheckoutFalhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
        <img
          src="/logo-orcaly.png"
          alt="OrÃ§aly"
          className="mx-auto mb-6 h-14 w-auto object-contain"
        />

        <h1 className="text-3xl font-black text-[#071b3a]">
          Pagamento nÃ£o concluÃ­do
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          O pagamento foi recusado, cancelado ou nÃ£o finalizado. Volte ao cadastro e tente novamente.
        </p>

        <Link
          href="/cadastro"
          className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
        >
          Voltar ao cadastro
        </Link>
      </div>
    </main>
  )
}
