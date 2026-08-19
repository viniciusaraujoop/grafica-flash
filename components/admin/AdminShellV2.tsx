'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SessionPayload = {
  admin: { id: string; nome: string; email: string; role: string; area: string; mustChangePassword?: boolean }
  capabilities: Record<string, boolean>
}
type SearchItem = { kind: string; id: string; title: string; subtitle: string; href: string }

type NavItem = { href: string; label: string; permission?: string; roles?: string[] }

const primary: NavItem[] = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/empresas', label: 'Empresas', permission: 'companies.read' },
  { href: '/admin/usuarios', label: 'Usuários', permission: 'users.read' },
  { href: '/admin/metrics', label: 'Receita & métricas', permission: 'billing.read' },
  { href: '/admin/customer-success', label: 'Customer Success', permission: 'companies.read' },
  { href: '/admin/onboarding-monitor', label: 'Onboarding', permission: 'companies.read' },
  { href: '/admin/growth', label: 'Growth', permission: 'growth.read' },
  { href: '/admin/indicacoes/growth', label: 'Parceiros', permission: 'partners.read' },
  { href: '/admin/suporte', label: 'Suporte', permission: 'support.read' },
  { href: '/admin/pagamentos', label: 'Pagamentos', permission: 'billing.read' },
  { href: '/admin/system-health', label: 'Sistema', permission: 'system.read' },
  { href: '/admin/webhooks', label: 'Webhooks', permission: 'webhooks.read' },
  { href: '/admin/seguranca', label: 'Segurança', permission: 'security.read' },
]

const administration: NavItem[] = [
  { href: '/admin/equipe', label: 'Equipe Admin', permission: 'admins.read' },
  { href: '/admin/auditoria', label: 'Auditoria', permission: 'audit.read' },
  { href: '/admin/feature-flags', label: 'Feature Flags', permission: 'features.read' },
  { href: '/admin/configuracoes', label: 'Configurações', permission: 'system.manage' },
]

function allowed(item: NavItem, session: SessionPayload) {
  if (item.roles?.length && !item.roles.includes(session.admin.role)) return false
  return !item.permission || session.capabilities[item.permission] === true
}

function navActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function roleLabel(role: string) {
  return ({ owner: 'Owner', platform_admin: 'Platform Admin', finance: 'Finance', support: 'Support', security: 'Security', operations: 'Operations', viewer: 'Viewer', prospector: 'Comercial' } as Record<string, string>)[role] || role
}

export default function AdminShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [searching, setSearching] = useState(false)

  const bare = pathname === '/admin/login' || pathname === '/admin/alterar-senha'

  useEffect(() => {
    if (bare) return
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const token = data.session?.access_token
      if (!token) { router.replace('/admin/login'); return }
      const response = await fetch('/api/admin/session', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) { await supabase.auth.signOut(); router.replace('/admin/login'); return }
      const resolved = payload as SessionPayload
      if (resolved.admin?.mustChangePassword) { router.replace('/admin/alterar-senha'); return }
      setSession(resolved)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setLoading(false)
      router.replace('/admin/login')
    })
    return () => { active = false }
  }, [bare, router])

  useEffect(() => {
    if (bare) return
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setPalette((value) => !value)
      }
      if (event.key === 'Escape') setPalette(false)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [bare])

  useEffect(() => {
    if (!palette || query.trim().length < 2) {
      const timer = window.setTimeout(() => { setResults([]); setSearching(false) }, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      void supabase.auth.getSession().then(async ({ data }) => {
        const token = data.session?.access_token || ''
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        const payload = await response.json().catch(() => ({ items: [] }))
        setResults(response.ok && Array.isArray(payload.items) ? payload.items : [])
        setSearching(false)
      })
    }, 260)
    return () => window.clearTimeout(timer)
  }, [palette, query])

  const visiblePrimary = useMemo(() => session ? primary.filter((item) => allowed(item, session)) : [], [session])
  const visibleAdmin = useMemo(() => session ? administration.filter((item) => allowed(item, session)) : [], [session])

  if (bare) return children
  if (loading || !session) {
    return <main className="min-h-screen bg-[#f4f6f9] p-4"><div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[240px_1fr]"><div className="hidden h-[calc(100vh-2rem)] animate-pulse rounded-3xl bg-slate-200 lg:block motion-reduce:animate-none"/><div className="space-y-4"><div className="h-20 animate-pulse rounded-3xl bg-white motion-reduce:animate-none"/><div className="h-72 animate-pulse rounded-3xl bg-white motion-reduce:animate-none"/></div></div></main>
  }

  const nav = (items: NavItem[]) => items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex min-h-11 items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none ${navActive(pathname, item.href) ? 'bg-[#0b2e63] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0b2e63]'}`}><span>{item.label}</span><span aria-hidden className={`text-xs ${navActive(pathname, item.href) ? 'opacity-80' : 'opacity-0 group-hover:opacity-50'}`}>›</span></Link>)

  return <div className="min-h-screen bg-[#f4f6f9] text-[#14243b]">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1800px] items-center gap-3 px-3 sm:px-5">
        <button type="button" onClick={() => setMobileOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-xl lg:hidden" aria-label="Abrir navegação">☰</button>
        <Link href="/admin" className="mr-auto flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0b2e63] text-sm font-bold text-white">O</span><span><strong className="block text-sm tracking-[-.02em] text-[#0b2e63]">Orçaly Control Center</strong><small className="block text-[10px] font-medium uppercase tracking-[.12em] text-slate-400">Operações da plataforma</small></span></Link>
        <button type="button" onClick={() => setPalette(true)} className="hidden min-w-56 items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-medium text-slate-500 md:flex"><span>Buscar em toda plataforma</span><kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px]">Ctrl K</kbd></button>
        <div className="hidden text-right xl:block"><strong className="block text-xs font-semibold">{session.admin.nome}</strong><span className="text-[11px] text-slate-400">{roleLabel(session.admin.role)} · {session.admin.area}</span></div>
        <button type="button" onClick={() => void supabase.auth.signOut().then(() => router.replace('/admin/login'))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Sair</button>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1800px] gap-5 px-3 py-5 sm:px-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden h-[calc(100vh-6.5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_8px_30px_rgba(15,23,42,.04)] lg:sticky lg:top-[5.25rem] lg:block">
        <div className="px-3 pb-2 pt-2 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Control Center</div><nav className="space-y-1">{nav(visiblePrimary)}</nav>
        {visibleAdmin.length ? <><div className="mx-3 my-3 border-t border-slate-100"/><div className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[.14em] text-slate-400">Administração</div><nav className="space-y-1">{nav(visibleAdmin)}</nav></> : null}
      </aside>
      <main className="min-w-0">{children}</main>
    </div>

    {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar navegação" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setMobileOpen(false)}/><aside className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto bg-white p-4 shadow-2xl"><div className="mb-5 flex items-center justify-between"><strong className="text-[#0b2e63]">Control Center</strong><button onClick={() => setMobileOpen(false)} className="h-10 w-10 rounded-xl border border-slate-200">×</button></div><nav className="space-y-1">{nav(visiblePrimary)}</nav>{visibleAdmin.length ? <><div className="my-4 border-t border-slate-100"/><nav className="space-y-1">{nav(visibleAdmin)}</nav></> : null}</aside></div> : null}

    {palette ? <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/35 px-3 pt-[10vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Busca global"><button aria-label="Fechar busca" className="absolute inset-0" onClick={() => setPalette(false)}/><section className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="border-b border-slate-100 p-3"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empresa, usuário, pagamento, parceiro ou webhook…" className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none ring-[#0b2e63] focus:ring-2" aria-label="Buscar"/></div><div className="max-h-[55vh] overflow-y-auto p-2">{searching ? <div className="p-6 text-center text-sm text-slate-400">Buscando com limites server-side…</div> : null}{!searching && query.trim().length >= 2 && !results.length ? <div className="p-6 text-center text-sm text-slate-400">Nenhum resultado para esta busca.</div> : null}{results.map((item) => <button key={`${item.kind}:${item.id}`} type="button" onClick={() => { setPalette(false); router.push(item.href) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[9px] font-bold uppercase text-slate-500">{item.kind.slice(0, 3)}</span><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{item.title}</strong><small className="block truncate text-xs text-slate-400">{item.subtitle}</small></span></button>)}</div><div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">Esc fecha · resultados limitados por permissão</div></section></div> : null}
  </div>
}
