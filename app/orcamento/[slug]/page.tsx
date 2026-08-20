import { notFound } from 'next/navigation'
import PublicOrderRequestForm from '@/components/public-order/PublicOrderRequestForm'
import { getSupabaseAdmin } from '@/lib/company-access'

type PageProps = {
  params: Promise<{ slug: string }>
}

const slugPattern = /^[a-z0-9][a-z0-9-]{1,79}$/

export default async function PublicOrderRequestPage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(String(rawSlug || '')).trim().toLowerCase()
  if (!slugPattern.test(slug)) notFound()

  const supabaseAdmin = getSupabaseAdmin()
  const { data: company, error } = await supabaseAdmin
    .from('companies')
    .select('id,nome,slug,subdomain_slug,logo_url,site_primary_color')
    .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
    .limit(1)
    .maybeSingle()

  if (error || !company?.id) notFound()

  const canonicalSlug = String(company.subdomain_slug || company.slug || slug)
  const initial = String(company.nome || 'O').trim().charAt(0).toUpperCase() || 'O'

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-[#0b2347] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl">
        <header className="mb-6 rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.nome || 'Logo da empresa'} className="h-14 w-14 rounded-xl border border-slate-100 bg-white object-contain p-1" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-[#0b3b78] text-xl font-bold text-white">{initial}</span>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#1776cf]">Formulário público</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">Solicitar pedido ou orçamento</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Envie os dados diretamente para {company.nome || 'a empresa'}. A solicitação entra no painel para acompanhamento.</p>
            </div>
          </div>
        </header>

        <PublicOrderRequestForm slug={canonicalSlug} companyName={company.nome || 'a empresa'} primaryColor={company.site_primary_color} />
      </section>
    </main>
  )
}
