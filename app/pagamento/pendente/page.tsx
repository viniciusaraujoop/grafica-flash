import Link from 'next/link'

const titles = {
  sucesso: 'Pagamento aprovado',
  erro: 'Pagamento não concluído',
  pendente: 'Pagamento pendente',
} as const

const descriptions = {
  sucesso: 'Recebemos a confirmação do pagamento. O pedido seguirá para a operação da empresa.',
  erro: 'O pagamento não foi concluído. Você pode voltar ao site da empresa ou falar com o atendimento.',
  pendente: 'O pagamento está aguardando confirmação do Mercado Pago. Assim que confirmar, o pedido será atualizado.',
} as const

export default function PagamentoRetornoPage() {
  const status = 'pendente' as keyof typeof titles
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8fbff] p-6 text-[#071b3a]">
      <section className="max-w-xl rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
        <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12 w-auto object-contain" />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Marketplace Orçaly</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.055em]">{titles[status]}</h1>
        <p className="mt-4 font-bold leading-7 text-slate-500">{descriptions[status]}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Ir para o Orçaly</Link>
        </div>
      </section>
    </main>
  )
}
