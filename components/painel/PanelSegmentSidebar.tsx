'use client'

import Link from 'next/link'
import { getModulesByGroupForSegment, getSegmentInfo, normalizeSegment, type SegmentModule } from '@/lib/segment-modules'

type SidebarCompany = {
  nome?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
}

type PanelSegmentSidebarProps = {
  company?: SidebarCompany | null
  pathname: string
}

function planLabel(value?: string | null) {
  if (value === 'basico') return 'Básico'
  if (value === 'essencial') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano'
}

function statusBadge(module: SegmentModule) {
  if (module.status === 'beta') return 'beta'
  if (module.status === 'coming_soon') return 'breve'
  return module.badge || ''
}

function isActivePath(pathname: string, href: string) {
  if (href === '/painel') return pathname === '/painel'
  if (href.startsWith('http')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PanelSegmentSidebar({ company, pathname }: PanelSegmentSidebarProps) {
  const segment = normalizeSegment(company?.business_type || company?.site_template)
  const info = getSegmentInfo(segment)
  const groups = getModulesByGroupForSegment(segment)

  return (
    <aside className="min-w-0 border-b border-blue-100 bg-white/95 px-4 py-4 shadow-xl shadow-blue-950/5 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-4">
      <div className="rounded-[1.6rem] bg-[#05245c] p-4 text-white">
        <Link href="/painel" className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-lg font-black text-[#05245c]">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.nome || 'Logo'} className="h-full w-full object-contain p-2" />
            ) : (
              (company?.nome || 'O').slice(0, 1)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black">{company?.nome || 'Orçaly'}</span>
            <span className="mt-1 block text-xs font-bold text-white/60">{planLabel(company?.assinatura_plano || company?.plano)}</span>
          </span>
        </Link>

        <div className="mt-4 rounded-2xl bg-white/10 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Segmento</p>
          <p className="mt-1 text-sm font-black">{info.shortLabel}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-white/60">{info.description}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
        {groups.map((group) => (
          <section key={group.group} className="min-w-[260px] lg:min-w-0">
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{group.label}</p>

            <div className="grid gap-1.5">
              {group.modules.map((module) => {
                const active = isActivePath(pathname, module.href)
                const badge = statusBadge(module)

                return (
                  <Link
                    key={module.id}
                    href={module.href}
                    className={`group rounded-[1.05rem] border px-3 py-3 transition ${
                      active
                        ? 'border-[#05245c] bg-[#05245c] text-white shadow-lg shadow-blue-950/15'
                        : 'border-transparent bg-transparent text-slate-600 hover:border-blue-100 hover:bg-[#f8fbff] hover:text-[#05245c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{module.label}</span>
                        <span className={`mt-1 line-clamp-2 block text-[11px] font-bold leading-4 ${active ? 'text-white/62' : 'text-slate-400'}`}>
                          {module.description}
                        </span>
                      </span>

                      {badge ? (
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${active ? 'bg-white/15 text-white' : 'bg-blue-50 text-[#05245c]'}`}>
                          {badge}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
