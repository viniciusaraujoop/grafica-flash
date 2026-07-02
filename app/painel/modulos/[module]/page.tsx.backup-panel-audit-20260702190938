import Link from 'next/link'
import { getBusinessTypeConfig } from '@/lib/business-types'

type PageProps = {
  params: Promise<{ module: string }>
}

const moduleLabels: Record<string, string> = {
  entregas: 'Entregas',
  horarios: 'Horários',
  'taxas-entrega': 'Taxas de entrega',
  artes: 'Artes',
  'aprovacao-arte': 'Aprovação de arte',
  agenda: 'Agenda',
  profissionais: 'Profissionais',
}

export default async function ModuloSegmentoPlaceholderPage({ params }: PageProps) {
  const { module } = await params
  const label = moduleLabels[module] || 'Módulo do segmento'

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center justify-center">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-2xl shadow-blue-950/10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Módulo por segmento</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em]">{label}</h1>
          <p className="mx-auto mt-4 max-w-2xl font-bold leading-8 text-slate-500">
            Este módulo está em preparação para o seu segmento. Enquanto isso, use pedidos, produtos, site e WhatsApp normalmente.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/painel/segmento" className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
              Ver módulos do segmento
            </Link>
            <Link href="/painel" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]">
              Voltar ao painel
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
