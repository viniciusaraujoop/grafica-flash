import Link from 'next/link'

const areas = [
  {
    href: '/admin/growth/assistente',
    title: 'Assistente Orçaly',
    description: 'Conversas, funil, recomendações, leads, feedback, latência e perguntas sem resposta.',
  },
  {
    href: '/admin/indicacoes/growth',
    title: 'Parceiros',
    description: 'Aquisição, indicação, receita atribuída e saúde do programa de parceiros.',
  },
]

export default function AdminGrowthPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Growth</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-.05em] text-[#0b2347]">Aquisição e conversão</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Escolha a frente que deseja analisar. Os painéis preservam os domínios existentes e não misturam dados de parceiros com o Assistente público.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {areas.map((area) => (
          <Link key={area.href} href={area.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60">
            <h2 className="text-lg font-black text-[#0b2347]">{area.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{area.description}</p>
            <span className="mt-4 inline-flex text-xs font-black text-blue-700">Abrir painel →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
