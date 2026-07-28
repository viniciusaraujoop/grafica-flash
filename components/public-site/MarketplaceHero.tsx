/* eslint-disable @next/next/no-img-element */

import type { PublicSiteCompany } from '@/components/public-site/PublicSiteRenderer'

type GalleryItem = {
  url?: string
  image_url?: string
  kind?: string
  type?: string
  title?: string
}

type MarketplaceHeroProps = {
  company: PublicSiteCompany
  label: string
  headline: string
  subheadline: string
  cta: string
  whatsapp: string
  primaryColor: string
  accentColor: string
}

function asGallery(value: unknown): GalleryItem[] {
  return Array.isArray(value) ? (value as GalleryItem[]) : []
}

function bannerUrl(company: PublicSiteCompany) {
  const gallery = asGallery(company.site_gallery)
  const banner = gallery.find((item) => item.kind === 'banner' || item.type === 'banner')

  return banner?.url || banner?.image_url || ''
}

export default function MarketplaceHero({
  company,
  label,
  headline,
  subheadline,
  cta,
  whatsapp,
  primaryColor,
  accentColor,
}: MarketplaceHeroProps) {
  const banner = bannerUrl(company)
  const companyName = company.nome || 'Empresa'

  return (
    <section className="px-3 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="relative mx-auto min-h-[470px] max-w-7xl overflow-hidden rounded-[2.6rem] bg-[#071b3a] shadow-2xl shadow-blue-950/20">
        {banner ? (
          <img
            src={banner}
            alt={`Banner de ${companyName}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 15% 20%, ${accentColor}, transparent 35%), linear-gradient(135deg, ${primaryColor}, #071b3a 68%)`,
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#071b3a]/95 via-[#071b3a]/45 to-[#071b3a]/10" />

        <div className="relative flex min-h-[470px] items-end p-4 sm:p-7 lg:p-10">
          <div className="grid w-full gap-5 rounded-[2rem] border border-white/20 bg-white/94 p-5 shadow-2xl backdrop-blur-xl sm:p-7 lg:grid-cols-[132px_minmax(0,1fr)_auto] lg:items-center">
            <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-blue-100 lg:mx-0 lg:h-32 lg:w-32">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={`Logo de ${companyName}`}
                  className="max-h-[82%] max-w-[82%] object-contain"
                />
              ) : (
                <span
                  className="grid h-full w-full place-items-center text-5xl font-black text-white"
                  style={{ background: primaryColor }}
                >
                  {companyName.slice(0, 1)}
                </span>
              )}
            </div>

            <div className="min-w-0 text-center lg:text-left">
              <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                <span
                  className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white"
                  style={{ background: primaryColor }}
                >
                  {label}
                </span>
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                  Compra e atendimento online
                </span>
              </div>

              <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                {companyName}
              </p>
              <h1 className="mt-2 text-4xl font-black leading-[1] tracking-[-0.06em] text-[#071b3a] sm:text-5xl lg:text-6xl">
                {headline}
              </h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-slate-500">
                {subheadline}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-52 lg:grid-cols-1">
              <a
                href="#catalogo"
                className="rounded-2xl px-5 py-4 text-center font-black text-white shadow-lg"
                style={{ background: primaryColor }}
              >
                {cta}
              </a>
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black"
                style={{ color: primaryColor }}
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
