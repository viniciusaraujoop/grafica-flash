'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getPanelModulesForBusinessType, panelGroupLabels, type PanelModuleGroup } from '@/lib/panel-modules'
import { getBusinessTypeConfig } from '@/lib/business-types'
import styles from './PanelChromeV3.module.css'

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

// ORCALY_MINHA_VITRINE_NAV_V1
function principalPriority(id: string) {
  if (id === 'site') return 0
  if (id === 'dashboard') return 1
  return 10
}

function planoLabel(value?: string | null) {
  if (value === 'basico') return 'Básico'
  if (value === 'essencial') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano'
}

function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      className={`h-4 w-4 ${styles.navArrow}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

export default function PanelSidebar({ company }: { company: PanelSidebarCompany }) {
  const pathname = usePathname()
  const businessType = company.business_type || company.site_template || 'services'
  const config = getBusinessTypeConfig(businessType)
  const modules = getPanelModulesForBusinessType(businessType)
  const plan = planoLabel(company.assinatura_plano || company.plano)

  return (
    <>
      <div className={`panel-sidebar-mobile-legacy px-4 py-2.5 lg:hidden ${styles.mobileBar} ${styles.enter}`}>
        <details className={`group ${styles.mobileDetails}`}>
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 ${styles.mobileSummary}`}>
            <div className="flex min-w-0 items-center gap-3">
              {company.logo_url ? (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-blue-100 ${styles.mobileLogo}`}>
                  <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[76%] max-w-[76%] object-contain" />
                </span>
              ) : (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0a377f] text-sm font-black text-white ${styles.mobileLogo}`}>
                  {(company.nome || 'O').slice(0, 1)}
                </span>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-[-0.02em] text-[#10233f]">{company.nome || 'Orçaly'}</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{config.label} · {plan}</p>
              </div>
            </div>

            <span className={styles.mobileMenuButton}>
              Menu
              <ChevronIcon className={`h-4 w-4 ${styles.mobileChevron}`} />
            </span>
          </summary>

          <div className={styles.mobilePanel}>
            <div className={styles.mobilePanelHeader}>
              <div>
                <strong>Navegação do painel</strong>
                <small>Acesse as áreas da sua operação.</small>
              </div>
              <span className={styles.mobileSegment}>{config.label}</span>
            </div>

            <SidebarGroups pathname={pathname} modules={modules} mobile />
          </div>
        </details>
      </div>

      <aside className={`panel-sidebar-desktop-legacy hidden min-h-screen lg:block ${styles.desktopSidebar} ${styles.enter}`}>
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className={styles.desktopBrand}>
            <Link href="/painel/site" className={`flex items-center gap-3 ${styles.desktopBrandLink}`}>
              {company.logo_url ? (
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white ${styles.desktopLogo}`}>
                  <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[76%] max-w-[76%] object-contain" />
                </span>
              ) : (
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg font-black text-white ${styles.desktopLogo}`}>
                  {(company.nome || 'O').slice(0, 1)}
                </span>
              )}

              <div className="min-w-0">
                <p className={`truncate text-base font-black tracking-[-0.03em] ${styles.desktopCompanyName}`}>{company.nome || 'Orçaly'}</p>
                <p className={`mt-0.5 truncate text-xs font-bold ${styles.desktopPlan}`}>{plan}</p>
              </div>
            </Link>

            <div className={`mt-4 rounded-[1rem] p-3 ${styles.segmentCard}`}>
              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${styles.segmentEyebrow}`}>Segmento</p>
              <p className={`mt-1 text-sm font-black ${styles.segmentTitle}`}>{config.label}</p>
              <p className={`mt-1 text-[11px] font-bold leading-4 ${styles.segmentDescription}`}>
                Os módulos exibidos acompanham a operação da empresa.
              </p>
            </div>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto ${styles.sidebarScroll}`}>
            <SidebarGroups pathname={pathname} modules={modules} />
          </div>
        </div>
      </aside>
    </>
  )
}

function SidebarGroups({
  pathname,
  modules,
  mobile = false,
}: {
  pathname: string
  modules: ReturnType<typeof getPanelModulesForBusinessType>
  mobile?: boolean
}) {
  return (
    <nav className={styles.nav} aria-label={mobile ? 'Menu principal do painel' : 'Navegação principal do painel'}>
      {groupOrder.map((group) => {
        const items = modules
          .filter((module) => module.group === group && module.status === 'active')
          .sort((a, b) => group === 'principal' ? principalPriority(a.id) - principalPriority(b.id) : 0)

        if (!items.length) return null

        return (
          <section key={group}>
            <p className={`mb-2 px-2 text-[10px] font-black uppercase tracking-[0.17em] ${mobile ? styles.groupLabelMobile : styles.groupLabelDesktop}`}>
              {panelGroupLabels[group]}
            </p>

            <div className={styles.navItems}>
              {items.map((module) => {
                const active = activeFor(pathname, module.href)
                const stateClass = mobile
                  ? active
                    ? styles.navLinkMobileActive
                    : styles.navLinkMobileIdle
                  : active
                    ? styles.navLinkDesktopActive
                    : styles.navLinkDesktopIdle

                return (
                  <Link
                    key={`${module.id}-${module.href}`}
                    href={module.href}
                    aria-current={active ? 'page' : undefined}
                    className={`${styles.navLink} ${stateClass}`}
                  >
                    <span className={styles.navRow}>
                      <span className={styles.navIcon} aria-hidden="true">{module.icon}</span>

                      <span className={styles.navCopy}>
                        <span className={styles.navLabel}>{module.label}</span>
                        <span className={styles.navDescription}>{module.description}</span>
                      </span>

                      <ArrowIcon />
                    </span>
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
