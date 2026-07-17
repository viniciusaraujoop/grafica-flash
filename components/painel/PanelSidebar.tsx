"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getPanelModulesForBusinessType, panelGroupLabels, type PanelModuleGroup } from '@/lib/panel-modules'
import { getBusinessTypeConfig } from '@/lib/business-types'

type PanelSidebarCompany = {
  nome?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
}

const groupOrder: PanelModuleGroup[] = [
  'principal',
  'comercial',
  'operacao',
  'financeiro',
  'presenca_digital',
  'sistema',
]

function activeFor(pathname: string, href: string) {
  if (href === '/painel') return pathname === '/painel'
  if (href.startsWith('http')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function planoLabel(value?: string | null) {
  if (value === 'basico') return 'Básico'
  if (value === 'essencial') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano'
}

export default function PanelSidebar({ company }: { company: PanelSidebarCompany }) {
  const pathname = usePathname()
  const businessType = company.business_type || company.site_template || 'services'
  const config = getBusinessTypeConfig(businessType)
  const modules = getPanelModulesForBusinessType(businessType)

  return (
    <>
      <div className="panel-sidebar-mobile-legacy sticky top-0 z-40 border-b border-blue-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {company.logo_url ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-blue-100">
                  <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[75%] max-w-[75%] object-contain" />
                </span>
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-sm font-black text-white">
                  {(company.nome || 'O').slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#071b3a]">{company.nome || 'Orçaly'}</p>
                <p className="truncate text-xs font-bold text-slate-500">{config.label}</p>
              </div>
            </div>
            <span className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Menu</span>
          </summary>

          <div className="mt-3 max-h-[75vh] overflow-y-auto rounded-[1.4rem] border border-blue-100 bg-[#f8fbff] p-3 shadow-xl shadow-blue-950/10">
            <SidebarGroups pathname={pathname} modules={modules} />
          </div>
        </details>
      </div>

      <aside className="panel-sidebar-desktop-legacy hidden min-h-screen border-r border-blue-100 bg-white/95 lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="border-b border-blue-100 p-5">
            <Link href="/painel" className="flex items-center gap-3">
              {company.logo_url ? (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
                  <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[75%] max-w-[75%] object-contain" />
                </span>
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-lg font-black text-white">
                  {(company.nome || 'O').slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[-0.03em] text-[#071b3a]">{company.nome || 'Orçaly'}</p>
                <p className="truncate text-xs font-bold text-slate-500">{planoLabel(company.assinatura_plano || company.plano)}</p>
              </div>
            </Link>

            <div className="mt-4 rounded-[1.2rem] bg-[#f5f8ff] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#05245c]">Segmento</p>
              <p className="mt-1 text-sm font-black text-[#071b3a]">{config.label}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">O menu mostra a operação certa sem esconder módulos globais.</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <SidebarGroups pathname={pathname} modules={modules} />
          </div>
        </div>
      </aside>
    </>
  )
}

function SidebarGroups({ pathname, modules }: { pathname: string; modules: ReturnType<typeof getPanelModulesForBusinessType> }) {
  return (
    <nav className="space-y-5">
      {groupOrder.map((group) => {
        const items = modules.filter((module) => module.group === group && module.status === 'active')
        if (!items.length) return null

        return (
          <section key={group}>
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {panelGroupLabels[group]}
            </p>

            <div className="grid gap-1.5">
              {items.map((module) => {
                const active = activeFor(pathname, module.href)

                return (
                  <Link
                    key={`${module.id}-${module.href}`}
                    href={module.href}
                    className={`group rounded-[1.1rem] border px-3 py-3 transition ${
                      active
                        ? 'border-[#05245c] bg-[#05245c] text-white shadow-lg shadow-blue-950/15'
                        : 'border-transparent text-slate-600 hover:border-blue-100 hover:bg-[#f8fbff] hover:text-[#05245c]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">{module.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-black">{module.label}</span>
                          {module.status !== 'active' ? (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700'}`}>
                              breve
                            </span>
                          ) : null}
                        </span>
                        <span className={`mt-1 line-clamp-2 block text-[11px] font-bold leading-4 ${active ? 'text-white/65' : 'text-slate-400'}`}>
                          {module.description}
                        </span>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </nav>
  )
}
