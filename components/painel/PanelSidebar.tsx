'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getPanelModulesForBusinessType } from '@/lib/panel-modules'
import { getBusinessTypeConfig } from '@/lib/business-types'
import { smartNavigationFor } from '@/lib/operations-experience'
import styles from './PanelChromeV3.module.css'
import contrast from './PanelContrastV4.module.css'

type PanelSidebarCompany = {
  nome?: string | null
  logo_url?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
}

function activeFor(pathname: string, href: string) {
  if (href === '/painel') return pathname === '/painel'
  if (href.startsWith('http')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function planLabel(value?: string | null) {
  if (value === 'basico' || value === 'essencial') return 'Essencial'
  if (value === 'intermediario' || value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano ativo'
}

function Icon({ name }: { name: 'today' | 'orders' | 'plus' | 'customers' | 'more' | 'star' }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'today') return <svg {...props}><path d="M4 5h16v15H4z"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9 15 2 2 4-4"/></svg>
  if (name === 'orders') return <svg {...props}><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
  if (name === 'plus') return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>
  if (name === 'customers') return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (name === 'star') return <svg {...props}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>
  return <svg {...props}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
}

export default function PanelSidebar({ company }: { company: PanelSidebarCompany }) {
  const pathname = usePathname()
  const businessType = company.business_type || company.site_template || 'services'
  const config = getBusinessTypeConfig(businessType)
  const legacyModules = getPanelModulesForBusinessType(businessType).filter((module) => module.status === 'active')
  const smartGroups = smartNavigationFor(businessType)
  const plan = planLabel(company.assinatura_plano || company.plano)
  const [favorites, setFavorites] = useState<string[]>([])
  const [showMore, setShowMore] = useState(false)
  const [showActions, setShowActions] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('orcaly.panel.favorites')
      if (raw) setFavorites(JSON.parse(raw))
    } catch {
      setFavorites([])
    }
  }, [])

  function toggleFavorite(href: string) {
    setFavorites((current) => {
      const next = current.includes(href) ? current.filter((item) => item !== href) : [...current, href].slice(-8)
      try { window.localStorage.setItem('orcaly.panel.favorites', JSON.stringify(next)) } catch { /* armazenamento local pode estar indisponível */ }
      return next
    })
  }

  const usedHrefs = useMemo(() => new Set(smartGroups.flatMap((group) => group.items.map((item) => item.href))), [smartGroups])
  const extras = useMemo(() => legacyModules.filter((module) => !usedHrefs.has(module.href)), [legacyModules, usedHrefs])
  const favoriteItems = useMemo(() => {
    const allSmart = smartGroups.flatMap((group) => group.items)
    return favorites.map((href) => allSmart.find((item) => item.href === href) || legacyModules.find((item) => item.href === href)).filter(Boolean) as Array<{ id: string; label: string; href: string; description: string; icon?: string }>
  }, [favorites, smartGroups, legacyModules])

  const publicSlug = company.subdomain_slug || company.slug
  const quickActions = [
    { label: 'Novo pedido', description: 'Abrir formulário de orçamento', href: publicSlug ? `/orcamento/${publicSlug}` : '/painel/central-operacional' },
    { label: 'Novo orçamento', description: 'Criar e enviar proposta', href: '/painel/propostas' },
    { label: 'Novo cliente', description: 'Abrir relacionamento/CRM', href: '/painel/crm' },
    { label: 'Nova tarefa', description: 'Criar próxima ação', href: '/painel/tarefas' },
  ]

  return (
    <>
      <aside className={`hidden lg:block ${styles.desktopSidebar} ${contrast.desktopSidebarContrast} ${styles.enter}`}>
        <div className={`${styles.desktopInner} !bg-white`}>
          <div className="border-b border-slate-100 px-4 pb-4 pt-4">
            <Link href="/painel/inicio" className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-50">
              {company.logo_url ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-white shadow-sm"><img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[78%] max-w-[78%] object-contain"/></span> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0b3b78] text-base font-black text-white">{(company.nome || 'O').slice(0, 1)}</span>}
              <span className="min-w-0"><strong className="block truncate text-[15px] text-slate-900">{company.nome || 'Orçaly'}</strong><small className="mt-0.5 block truncate text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">{config.label} · {plan}</small></span>
            </Link>
          </div>

          <div className={`${styles.sidebarScroll} !px-3 !py-4`}>
            {favoriteItems.length ? <NavSection label="Favoritos" items={favoriteItems} pathname={pathname} favorites={favorites} onFavorite={toggleFavorite}/> : null}
            {smartGroups.filter((group) => group.id !== 'tools').map((group) => <NavSection key={group.id} label={group.label} items={group.items} pathname={pathname} favorites={favorites} onFavorite={toggleFavorite}/>)}

            <section className="mt-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setShowMore((value) => !value)} aria-expanded={showMore} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"><span>Mais ferramentas</span><span className={`text-slate-400 transition ${showMore ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span></button>
              {showMore ? <div className="mt-1 grid gap-1 motion-safe:animate-[orcaly-nav-in_160ms_ease-out_both]">{[...smartGroups.find((group) => group.id === 'tools')!.items, ...extras].filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index).map((item) => <NavRow key={`${item.id}-${item.href}`} item={item} pathname={pathname} favorite={favorites.includes(item.href)} onFavorite={toggleFavorite}/>)}</div> : null}
            </section>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-2 bottom-2 z-[100] grid h-[66px] grid-cols-5 items-center rounded-[1.25rem] border border-slate-200 bg-white/95 px-1 shadow-[0_18px_55px_rgba(3,19,45,.22)] backdrop-blur-xl lg:hidden" aria-label="Navegação rápida">
        <MobileLink href="/painel/inicio" label="Hoje" icon="today" pathname={pathname}/>
        <MobileLink href="/painel/pedidos" label="Pedidos" icon="orders" pathname={pathname}/>
        <button type="button" onClick={() => setShowActions(true)} className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#0b3b78] text-white shadow-lg shadow-blue-950/20 transition active:scale-95" aria-label="Criar novo"><span className="h-5 w-5"><Icon name="plus"/></span></button>
        <MobileLink href="/painel/clientes" label="Clientes" icon="customers" pathname={pathname}/>
        <button type="button" onClick={() => setShowMore(true)} className="flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-extrabold text-slate-500"><span className="h-5 w-5"><Icon name="more"/></span><span>Mais</span></button>
      </nav>

      {showActions ? <Sheet title="Criar no Orçaly" subtitle="Ações rápidas para continuar o fluxo." onClose={() => setShowActions(false)}>{quickActions.map((action) => <Link key={action.label} href={action.href} onClick={() => setShowActions(false)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-200 hover:bg-blue-50/40"><span><strong className="block text-sm text-slate-800">{action.label}</strong><small className="mt-0.5 block text-xs font-medium text-slate-400">{action.description}</small></span><span className="text-slate-300">→</span></Link>)}</Sheet> : null}

      {showMore ? <div className="lg:hidden"><Sheet title="Navegação" subtitle={`${config.label} · encontre o restante sem poluir o painel.`} onClose={() => setShowMore(false)}>{smartGroups.map((group) => <section key={group.id} className="mb-4 last:mb-0"><p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">{group.label}</p><div className="grid gap-1">{group.items.map((item) => <Link key={`${group.id}-${item.href}`} href={item.href} onClick={() => setShowMore(false)} className={`rounded-xl px-3 py-2.5 ${activeFor(pathname, item.href) ? 'bg-blue-50 text-[#0b3b78]' : 'text-slate-700 hover:bg-slate-50'}`}><strong className="block text-sm">{item.label}</strong><small className="block truncate text-[11px] font-medium opacity-60">{item.description}</small></Link>)}</div></section>)}</Sheet></div> : null}

      <style jsx global>{`@keyframes orcaly-nav-in { from { opacity:0; transform:translateY(-3px) } to { opacity:1; transform:none } } @media (prefers-reduced-motion: reduce) { [class*='orcaly-nav'] { animation:none !important; transition:none !important } }`}</style>
    </>
  )
}

function NavSection({ label, items, pathname, favorites, onFavorite }: { label: string; items: Array<{ id: string; label: string; href: string; description: string; icon?: string }>; pathname: string; favorites: string[]; onFavorite: (href: string) => void }) {
  if (!items.length) return null
  return <section className="mb-4"><p className="mb-1.5 px-3 text-[9px] font-extrabold uppercase tracking-[.15em] text-slate-400">{label}</p><div className="grid gap-1">{items.map((item) => <NavRow key={`${item.id}-${item.href}`} item={item} pathname={pathname} favorite={favorites.includes(item.href)} onFavorite={onFavorite}/>)}</div></section>
}

function NavRow({ item, pathname, favorite, onFavorite }: { item: { id: string; label: string; href: string; description: string; icon?: string }; pathname: string; favorite: boolean; onFavorite: (href: string) => void }) {
  const active = activeFor(pathname, item.href)
  return <div className={`group flex items-center gap-1 rounded-xl transition ${active ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'}`}><Link href={item.href} aria-current={active ? 'page' : undefined} className="min-w-0 flex-1 px-3 py-2.5"><span className={`block truncate text-[13px] font-extrabold ${active ? 'text-[#0b3b78]' : 'text-slate-700'}`}>{item.label}</span><span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{item.description}</span></Link><button type="button" onClick={() => onFavorite(item.href)} className={`mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${favorite ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100'}`} aria-label={favorite ? `Remover ${item.label} dos favoritos` : `Favoritar ${item.label}`} title={favorite ? 'Remover favorito' : 'Favoritar'}><span className="h-3.5 w-3.5"><Icon name="star"/></span></button></div>
}

function MobileLink({ href, label, icon, pathname }: { href: string; label: string; icon: 'today' | 'orders' | 'customers'; pathname: string }) {
  const active = activeFor(pathname, href)
  return <Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-extrabold transition ${active ? 'text-[#0b3b78]' : 'text-slate-500'}`}><span className={`h-5 w-5 ${active ? 'scale-105' : ''}`}><Icon name={icon}/></span><span className="truncate">{label}</span></Link>
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[130] bg-[#03132d]/45 backdrop-blur-[2px] lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} role="presentation"><section role="dialog" aria-modal="true" aria-label={title} className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[1.6rem] bg-[#f8fafc] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-24px_70px_rgba(3,19,45,.24)] motion-safe:animate-[orcaly-sheet-in_200ms_ease-out_both]"><div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300"/><header className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold tracking-[-.03em] text-[#10233f]">{title}</h3><p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-500 shadow-sm" aria-label="Fechar">×</button></header><div className="grid gap-2">{children}</div></section><style jsx global>{`@keyframes orcaly-sheet-in { from { transform:translateY(18px); opacity:.65 } to { transform:none; opacity:1 } }`}</style></div>
}
