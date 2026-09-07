'use client'

import PublicSiteRenderer, { type PublicSiteCompany, type PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import StorefrontExperienceV2 from '@/components/public-site/StorefrontExperienceV2'
import { getSiteTemplateByBusinessType } from '@/lib/site-templates'

type SitePreviewMode = 'desktop' | 'mobile'
type StorefrontCompanyProp = Parameters<typeof StorefrontExperienceV2>[0]['company']

type SitePreviewProps = {
  company: PublicSiteCompany
  products?: PublicSiteProduct[]
  compact?: boolean
  mode?: SitePreviewMode
}

export default function SitePreview({ company, products = [], compact = false, mode = 'desktop' }: SitePreviewProps) {
  const template = getSiteTemplateByBusinessType(company.business_type || company.site_template)
  const fakeProducts: PublicSiteProduct[] = template.previewItems.map((item, index) => ({ id: `preview-${index}`, nome: item, descricao: 'Item demonstrativo do modelo escolhido.', categoria: template.catalogLabel, preco: index === 0 ? 0 : 49.9 + index * 20, preco_sob_consulta: index === 0, available: true, ativo: true }))
  const widthClass = mode === 'mobile' ? 'mx-auto max-w-[390px]' : 'w-full'
  const heightClass = compact ? 'h-[760px]' : 'min-h-[720px]'
  const previewProducts = products.length ? products : fakeProducts

  return <div className={`w-full max-w-full overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 ${heightClass}`}><div className="flex items-center justify-between border-b border-blue-100 bg-white px-4 py-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Prévia</p><p className="text-sm font-black text-slate-500">{mode === 'mobile' ? 'Visual mobile' : 'Visual desktop'} · Storefront 2.0</p></div><div className="flex gap-1"><span className="h-3 w-3 rounded-full bg-red-200"/><span className="h-3 w-3 rounded-full bg-amber-200"/><span className="h-3 w-3 rounded-full bg-emerald-200"/></div></div><div className="h-[calc(100%-57px)] overflow-y-auto overflow-x-hidden bg-[#f5f8ff] p-3"><div className={`min-w-0 ${widthClass}`}><StorefrontExperienceV2 company={company as StorefrontCompanyProp} products={previewProducts}><PublicSiteRenderer company={company} products={previewProducts}/></StorefrontExperienceV2></div></div></div>
}
