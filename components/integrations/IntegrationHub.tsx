'use client'

import { useMemo, useState } from 'react'
import GoogleCalendarSettings from '@/components/integrations/GoogleCalendarSettings'
import type { IntegrationHubItem } from '@/lib/integrations/hub'
import type { IntegrationCategory, IntegrationStatus } from '@/lib/integrations/core/types'

const categoryLabels: Record<IntegrationCategory, string> = {
  communication: 'Comunicação', google: 'Google', fiscal: 'Fiscal', financial: 'Financeiro', logistics: 'Logística', sales: 'Vendas', marketplaces: 'Marketplaces', automation: 'Automação', files: 'Arquivos', productivity: 'Produtividade',
}

const statusLabel: Record<IntegrationStatus, string> = {
  NOT_CONFIGURED: 'Não configurado', CONNECTING: 'Conectando', CONNECTED: 'Conectado', DEGRADED: 'Degradado', ERROR: 'Erro', REAUTH_REQUIRED: 'Reautenticar', ACCESS_REQUIRED: 'Acesso necessário', DISCONNECTED: 'Desconectado',
}

function statusClass(status: IntegrationStatus) {
  if (status === 'CONNECTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'DEGRADED' || status === 'REAUTH_REQUIRED') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'ERROR') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'ACCESS_REQUIRED') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function formatDate(value?: string | null) {
  if (!value) return 'Ainda não sincronizado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function IntegrationHub({ items, permissions }: {
  items: IntegrationHubItem[]
  permissions: { manage: boolean; sync: boolean; disconnect: boolean }
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | IntegrationCategory>('all')
  const [selected, setSelected] = useState<IntegrationHubItem | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const categories = useMemo(() => [...new Set(items.map((item) => item.provider.category))], [items])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => {
      if (category !== 'all' && item.provider.category !== category) return false
      if (!term) return true
      return `${item.provider.name} ${item.provider.description} ${item.provider.capabilities.join(' ')}`.toLowerCase().includes(term)
    })
  }, [items, query, category])

  async function sync(item: IntegrationHubItem) {
    setBusy(item.provider.key)
    setNotice(null)
    try {
      const response = await fetch(`/api/integrations/${item.provider.key}/sync`, { method: 'POST' })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível iniciar a sincronização.')
      setNotice('Sincronização colocada na fila com segurança.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao sincronizar.')
    } finally {
      setBusy(null)
    }
  }

  async function disconnect(item: IntegrationHubItem) {
    if (!window.confirm(`Desconectar ${item.provider.name}?`)) return
    setBusy(item.provider.key)
    setNotice(null)
    try {
      const response = await fetch(`/api/integrations/${item.provider.key}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível desconectar.')
      setNotice('Integração desconectada. Atualize a página para refletir o novo estado.')
      setSelected(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao desconectar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pb-24 lg:pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-[#061a36] via-[#0b3b78] to-[#1776cf] p-6 text-white shadow-[0_28px_80px_rgba(6,26,54,.16)] sm:p-8 lg:p-10">
        <p className="text-[11px] font-black uppercase tracking-[.18em] text-cyan-200">Ecossistema Orçaly</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-.045em] sm:text-4xl lg:text-5xl">Integrações</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">Conecte o Orçaly às ferramentas que sua empresa já usa. Cada conexão mantém permissões, saúde, sincronização e credenciais isoladas por empresa.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Metric label="Disponíveis no catálogo" value={String(items.length)} />
          <Metric label="Conectadas" value={String(items.filter((item) => item.connection?.status === 'CONNECTED').length)} />
          <Metric label="Precisam de atenção" value={String(items.filter((item) => ['DEGRADED','ERROR','REAUTH_REQUIRED'].includes(item.connection?.status || '')).length)} />
        </div>
      </section>

      {notice ? <div role="status" className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0b3b78]">{notice}</div> : null}

      <section className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative block"><span className="sr-only">Buscar integração</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ferramenta ou capacidade" className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50" /></label>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorias de integrações"><FilterButton active={category === 'all'} onClick={() => setCategory('all')}>Todas</FilterButton>{categories.map((value) => <FilterButton key={value} active={category === value} onClick={() => setCategory(value)}>{categoryLabels[value]}</FilterButton>)}</div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const status = item.connection?.status || item.health.status
          return <article key={item.provider.key} className="group flex min-h-[300px] flex-col rounded-[1.55rem] border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,43,79,.05)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_45px_rgba(15,43,79,.09)]">
            <div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef5ff] text-base font-black text-[#0b3b78]" aria-hidden="true">{item.provider.name.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] ${statusClass(status)}`}>{statusLabel[status]}</span></div>
            <div className="mt-4"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-[#071b3a]">{item.provider.name}</h2>{item.recommended ? <span className="rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-cyan-700">Recomendado</span> : null}</div><p className="mt-2 text-sm leading-6 text-slate-500">{item.provider.description}</p></div>
            <div className="mt-4 flex flex-wrap gap-1.5">{item.provider.capabilities.slice(0, 3).map((capability) => <span key={capability} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">{capability}</span>)}</div>
            <div className="mt-auto pt-5"><p className="mb-3 text-[11px] font-semibold text-slate-400">{item.connection ? `Última sync: ${formatDate(item.connection.lastSyncAt)}` : item.health.message}</p><div className="flex gap-2">{item.rolloutEnabled && permissions.manage && (!item.connection || ['NOT_CONFIGURED','DISCONNECTED','REAUTH_REQUIRED'].includes(status)) ? <a href={`/api/integrations/${item.provider.key}/connect`} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#0b3b78] px-3 text-sm font-black text-white transition hover:bg-[#082f62]">{status === 'REAUTH_REQUIRED' ? 'Reautenticar' : 'Conectar'}</a> : <button type="button" onClick={() => setSelected(item)} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:text-[#0b3b78]">Ver detalhes</button>}{!item.rolloutEnabled ? <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 text-[10px] font-black uppercase tracking-wide text-slate-400">Rollout fechado</span> : null}</div></div>
          </article>
        })}
      </section>

      {!filtered.length ? <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-black text-slate-700">Nenhuma integração encontrada</h2><p className="mt-2 text-sm text-slate-500">Tente outro termo ou categoria.</p></div> : null}

      {selected ? <div className="fixed inset-0 z-[140] bg-[#03132d]/45 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }} role="presentation"><aside role="dialog" aria-modal="true" aria-labelledby="integration-detail-title" className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-[#f8fafc] p-5 shadow-[-24px_0_80px_rgba(3,19,45,.2)] sm:p-7 motion-safe:animate-[integration-drawer-in_180ms_ease-out_both]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Detalhes da integração</p><h2 id="integration-detail-title" className="mt-2 text-2xl font-black text-[#071b3a]">{selected.provider.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-xl text-slate-500">×</button></div>
        <Detail label="Status" value={statusLabel[selected.connection?.status || selected.health.status]} />
        <Detail label="Conta conectada" value={selected.connection?.externalAccountName || selected.connection?.displayName || 'Nenhuma conta conectada'} />
        <Detail label="Última sincronização" value={formatDate(selected.connection?.lastSyncAt)} />
        <Detail label="Último sucesso" value={formatDate(selected.connection?.lastSuccessAt)} />
        <Detail label="Saúde" value={selected.health.message} />
        {selected.connection?.lastErrorCode ? <Detail label="Último erro" value={selected.connection.lastErrorCode} /> : null}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Capacidades</p><div className="mt-3 flex flex-wrap gap-2">{selected.provider.capabilities.map((capability) => <span key={capability} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-[#0b3b78]">{capability}</span>)}</div></section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Configuração externa</p><p className="mt-2 text-sm leading-6 text-slate-600">{selected.provider.externalRequirement || 'Nenhuma exigência externa adicional.'}</p></section>
        {selected.provider.key === 'google_calendar' && selected.connection && ['CONNECTED','DEGRADED'].includes(selected.connection.status) ? <GoogleCalendarSettings canManage={permissions.manage} /> : null}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {selected.rolloutEnabled && selected.connection && ['CONNECTED','DEGRADED'].includes(selected.connection.status) && permissions.sync ? <button type="button" disabled={busy === selected.provider.key} onClick={() => sync(selected)} className="min-h-12 rounded-xl bg-[#0b3b78] px-4 text-sm font-black text-white disabled:opacity-50">{busy === selected.provider.key ? 'Enfileirando…' : 'Sincronizar agora'}</button> : null}
          {selected.rolloutEnabled && selected.connection && permissions.disconnect ? <button type="button" disabled={busy === selected.provider.key} onClick={() => disconnect(selected)} className="min-h-12 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 disabled:opacity-50">Desconectar</button> : null}
        </div>
      </aside></div> : null}
      <style jsx global>{`@keyframes integration-drawer-in{from{opacity:.5;transform:translateX(22px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){[class*='integration-drawer']{animation:none!important;transition:none!important}}`}</style>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur-sm"><strong className="text-2xl font-black">{value}</strong><span className="mt-1 block text-xs font-bold text-blue-100">{label}</span></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition ${active ? 'bg-[#0b3b78] text-white' : 'bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-[#0b3b78]'}`}>{children}</button> }
function Detail({ label, value }: { label: string; value: string }) { return <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 text-sm font-bold text-slate-700">{value}</p></div> }
