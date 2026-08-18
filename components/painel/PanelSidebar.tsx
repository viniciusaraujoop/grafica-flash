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

const groupOrder: PanelModuleGroup[] = ['principal', 'comercial', 'operacao', 'financeiro', 'presenca_digital', 'sistema']

function activeFor(pathname: string, href: string) {
  if (href === '/painel') return pathname === '/painel'
  if (href.startsWith('http')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

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
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
}

function ArrowIcon() {
  return <svg className={`h-4 w-4 ${styles.navArrow}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg>
}

function DockIcon({ name }: { name: 'home' | 'orders' | 'products' | 'store' }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'home') return <svg {...common}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
  if (name === 'orders') return <svg {...common}><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>
  if (name === 'products') return <svg {...common}><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="m4 7 8 4 8-4M4 7v10l8 4 8-4V7M12 11v10" /></svg>
  return <svg {...common}><path d="M4 9h16l-1.5-5h-13L4 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /><path d="M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0" /></svg>
}

export default function PanelSidebar({ company }: { company: PanelSidebarCompany }) {
  const pathname = usePathname()
  const businessType = company.business_type || company.site_template || 'services'
  const config = getBusinessTypeConfig(businessType)
  const modules = getPanelModulesForBusinessType(businessType)
  const plan = planoLabel(company.assinatura_plano || company.plano)

  return (
    <>
      <div className={`panel-sidebar-mobile-legacy px-3 py-2.5 lg:hidden ${styles.mobileBar} ${styles.enter}`}>
        <details className={`group ${styles.mobileDetails}`}>
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 ${styles.mobileSummary}`}>
            <div className="flex min-w-0 items-center gap-3">
              {company.logo_url ? (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ${styles.mobileLogo}`}>
                  <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[76%] max-w-[76%] object-contain" />
                </span>
              ) : (
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black text-white ${styles.mobileLogo} ${styles.mobileLogoFallback}`}>{(company.nome || 'O').slice(0, 1)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-[-0.02em] text-white">{company.nome || 'Orçaly'}</p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-blue-100/70">{config.label} · {plan}</p>
              </div>
            </div>
            <span className={styles.mobileMenuButton}><span>Menu</span><ChevronIcon className={`h-4 w-4 ${styles.mobileChevron}`} /></span>
          </summary>

          <div className={styles.mobilePanel}>
            <div className={styles.mobilePanelHeader}>
              <div><strong>Navegação completa</strong><small>Todos os módulos disponíveis para sua operação.</small></div>
              <span className={styles.mobileSegment}>{config.label}</span>
            </div>
            <SidebarGroups pathname={pathname} modules={modules} mobile />
          </div>
        </details>
      </div>

      <aside className={`panel-sidebar-desktop-legacy hidden lg:block ${styles.desktopSidebar} ${styles.enter}`}>
        <div className={styles.desktopInner}>
          <div className={styles.desktopBrand}>
            <Link href="/painel/site" className={`flex items-center gap-3 ${styles.desktopBrandLink}`}>
              {company.logo_url ? (
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white ${styles.desktopLogo}`}><img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[76%] max-w-[76%] object-contain" /></span>
              ) : (
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base font-black text-white ${styles.desktopLogo} ${styles.desktopLogoFallback}`}>{(company.nome || 'O').slice(0, 1)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[15px] font-black tracking-[-0.03em] ${styles.desktopCompanyName}`}>{company.nome || 'Orçaly'}</p>
                <p className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.12em] ${styles.desktopPlan}`}>{plan}</p>
              </div>
            </Link>

            <div className={styles.segmentCard}>
              <span className={styles.segmentPulse} aria-hidden="true" />
              <div className="min-w-0"><p className={styles.segmentEyebrow}>Workspace</p><p className={styles.segmentTitle}>{config.label}</p></div>
            </div>
          </div>

          <div className={styles.sidebarScroll}><SidebarGroups pathname={pathname} modules={modules} /></div>
        </div>
      </aside>

      <nav className={styles.mobileDock} aria-label="Acessos rápidos do painel">
        <DockLink href="/painel/inicio" label="Início" icon="home" pathname={pathname} />
        <DockLink href="/painel/pedidos" label="Pedidos" icon="orders" pathname={pathname} />
        <DockLink href="/painel/produtos" label="Produtos" icon="products" pathname={pathname} />
        <DockLink href="/painel/site" label="Vitrine" icon="store" pathname={pathname} />
      </nav>
    </>
  )
}

function DockLink({ href, label, icon, pathname }: { href: string; label: string; icon: 'home' | 'orders' | 'products' | 'store'; pathname: string }) {
  const active = activeFor(pathname, href)
  return <Link href={href} aria-current={active ? 'page' : undefined} className={`${styles.dockLink} ${active ? styles.dockLinkActive : ''}`}><span className={styles.dockIcon}><DockIcon name={icon} /></span><span>{label}</span></Link>
}

function SidebarGroups({ pathname, modules, mobile = false }: { pathname: string; modules: ReturnType<typeof getPanelModulesForBusinessType>; mobile?: boolean }) {
  return (
    <nav className={styles.nav} aria-label={mobile ? 'Menu principal do painel' : 'Navegação principal do painel'}>
      {groupOrder.map((group) => {
        const items = modules.filter((module) => module.group === group && module.status === 'active').sort((a, b) => group === 'principal' ? principalPriority(a.id) - principalPriority(b.id) : 0)
        if (!items.length) return null
        return (
          <section key={group}>
            <p className={`${styles.groupLabel} ${mobile ? styles.groupLabelMobile : styles.groupLabelDesktop}`}>{panelGroupLabels[group]}</p>
            <div className={styles.navItems}>
              {items.map((module) => {
                const active = activeFor(pathname, module.href)
                const stateClass = mobile ? active ? styles.navLinkMobileActive : styles.navLinkMobileIdle : active ? styles.navLinkDesktopActive : styles.navLinkDesktopIdle
                return (
                  <Link key={`${module.id}-${module.href}`} href={module.href} aria-current={active ? 'page' : undefined} className={`${styles.navLink} ${stateClass}`}>
                    <span className={styles.navRow}>
                      <span className={styles.navIcon} aria-hidden="true">{module.icon}</span>
                      <span className={styles.navCopy}><span className={styles.navLabel}>{module.label}</span><span className={styles.navDescription}>{module.description}</span></span>
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
