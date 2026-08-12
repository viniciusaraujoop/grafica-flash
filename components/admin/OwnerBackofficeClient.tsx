/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_BACKOFFICE_V2
// ORCALY_OWNER_FINANCE_V1
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type View = 'overview' | 'subscribers' | 'partners' | 'payouts' | 'team' | 'audit'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dateBR(value: unknown) {
  if (!value) return '—'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}
function statusLabel(value: unknown) {
  const key = String(value || '')
  return ({ active: 'Ativo', trial: 'Teste grátis', overdue: 'Atrasado', canceling: 'Cancelando', inactive: 'Inativo', pending: 'Pendente', requested: 'Solicitado', approved: 'Aprovado', processing: 'Processando', paid: 'Pago', failed: 'Falhou', cancelled: 'Cancelado' } as Record<string, string>)[key] || key || 'Indefinido'
}
function Badge({ value }: { value: unknown }) {
  const key = String(value || '').toLowerCase()
  const cls = ['active', 'paid', 'approved', 'verified', 'connected'].includes(key)
    ? 'bg-emerald-50 text-emerald-700'
    : ['trial', 'pending', 'requested', 'processing'].includes(key)
      ? 'bg-amber-50 text-amber-700'
      : ['overdue', 'failed', 'cancelled', 'canceled', 'inactive'].includes(key)
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${cls}`}>{statusLabel(value)}</span>
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#071b3a]">{value}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-400">{detail}</p></article>
}
async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function OwnerBackofficeClient({ initialView = 'overview' }: { initialView?: View }) {
  const router = useRouter()
  const [view, setView] = useState<View>(initialView)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<any>(null)
  const [revealedPix, setRevealedPix] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const token = await accessToken()
    if (!token) { router.replace('/parceiros/login'); return }
    const response = await fetch('/api/admin/control-center', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if ([401, 403].includes(response.status)) { router.replace('/parceiros/login'); return }
      setError(payload.error || 'Não foi possível carregar o centro de controle.'); setLoading(false); return
    }
    setData(payload); setLoading(false)
  }, [router])

  useEffect(() => {
    let ignore = false

    void accessToken()
      .then(async (token) => {
        if (ignore) return

        if (!token) {
          router.replace('/parceiros/login')
          return
        }

        const response = await fetch(
          '/api/admin/control-center',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          },
        )

        const payload = await response
          .json()
          .catch(() => ({}))

        if (ignore) return

        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            router.replace('/parceiros/login')
            return
          }

          setError(
            payload.error ||
              'Não foi possível carregar o centro de controle.',
          )
          setLoading(false)
          return
        }

        setData(payload)
        setLoading(false)
      })
      .catch(() => {
        if (ignore) return

        setError(
          'Não foi possível carregar o centro de controle.',
        )
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [router])

  async function logout() { await supabase.auth.signOut(); router.replace('/parceiros/login') }

  async function affiliateAction(action: string, body: Record<string, unknown>, success: string) {
    const token = await accessToken()
    if (!token) return null
    const key = `${action}:${body.payoutId || body.affiliateId || ''}`
    setBusy(key); setError(''); setMessage('')
    const response = await fetch('/api/admin/affiliates', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
    const payload = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) { setError(payload.error || 'Não foi possível concluir a operação.'); return null }
    setMessage(success); return payload
  }

  async function revealPix(partner: any) {
    const result = await affiliateAction('reveal_pix', { affiliateId: partner.id }, 'Chave Pix revelada. A consulta foi registrada na auditoria.')
    if (result) setRevealedPix({ ...result, partnerName: partner.name })
  }
  async function createPayout(partner: any) {
    const result = await affiliateAction('create_payout', { affiliateId: partner.id }, 'Lote de repasse criado.')
    if (result) { await load(); setView('payouts') }
  }
  async function approvePayout(payout: any) {
    if (!window.confirm(`Aprovar ${money(payout.amount)} para ${payout.partner?.name || 'o indicador'}?`)) return
    const result = await affiliateAction('approve_payout', { payoutId: payout.id, note: 'Aprovado no centro de controle owner.' }, 'Repasse aprovado.')
    if (result) await load()
  }
  async function sendPayout(payout: any) {
    if (!window.confirm(`ENVIAR PIX de ${money(payout.amount)} para ${payout.partner?.name || 'o indicador'} agora? Esta ação movimenta dinheiro.`)) return
    const result = await affiliateAction('send_payout', { payoutId: payout.id }, 'Transferência Pix enviada para processamento.')
    if (result) await load()
  }

  const subscribers = data?.subscribers || []
  const partners = data?.partners || []
  const payouts = data?.payouts || []
  const team = data?.team || []
  const audit = data?.audit || []
  const metrics = data?.metrics || {}

  const filteredSubscribers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return subscribers.filter((row: any) => (filter === 'all' || row.state === filter) && (!q || [row.nome, row.email, row.slug, row.segmento, row.plan, row.referral?.partner?.name, row.referral?.partner?.email].some((v) => String(v || '').toLowerCase().includes(q))))
  }, [subscribers, search, filter])
  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase()
    return !q ? partners : partners.filter((row: any) => [row.name, row.email, row.whatsapp, row.code].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [partners, search])
  const pendingPayouts = payouts.filter((row: any) => ['requested', 'approved', 'processing'].includes(String(row.status)))

  const nav: Array<{ id: View; label: string; count?: number }> = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'subscribers', label: 'Assinantes', count: subscribers.length },
    { id: 'partners', label: 'Indicadores', count: partners.length },
    { id: 'payouts', label: 'Pix e repasses', count: pendingPayouts.length },
    { id: 'team', label: 'Acessos', count: team.filter((r: any) => r.role === 'support').length },
    { id: 'audit', label: 'Auditoria' },
  ]

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]"><p className="font-black">Carregando administração da plataforma...</p></main>
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#eef3f9] p-5"><div className="rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="font-black text-red-700">{error || 'Acesso não encontrado.'}</p></div></main>

  return <main className="min-h-screen bg-[#eef3f9] text-[#071b3a]">
    <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur-xl"><div className="mx-auto flex min-h-20 max-w-[1700px] items-center justify-between gap-4 px-4 py-3 sm:px-6"><div><p className="text-xl font-black text-[#05245c]">Orçaly</p><p className="text-[10px] font-black uppercase tracking-[0.17em] text-slate-400">Controle da plataforma</p></div><div className="flex flex-wrap gap-2"><Link href="/painel" className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]">Sistema principal</Link><Link href="/parceiros" className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]">Portal de parceiros</Link><button onClick={() => void load()} className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]">Atualizar</button><button onClick={() => void logout()} className="rounded-2xl bg-[#071b3a] px-4 py-3 text-xs font-black text-white">Sair</button></div></div></header>
    <div className="mx-auto grid max-w-[1700px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="h-fit rounded-[1.8rem] bg-[#071b3a] p-3 text-white shadow-xl lg:sticky lg:top-24"><div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/60">Owner exclusivo</p><p className="mt-2 text-base font-black">{data.admin?.nome}</p><p className="mt-1 break-all text-xs font-bold text-white/40">{data.admin?.email}</p></div><nav className="mt-3 grid gap-1">{nav.map((item) => <button key={item.id} onClick={() => { setView(item.id); setSelected(null); setRevealedPix(null) }} className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black ${view === item.id ? 'bg-white text-[#05245c]' : 'text-white/65 hover:bg-white/10'}`}><span>{item.label}</span>{typeof item.count === 'number' ? <span className="rounded-full bg-black/10 px-2 py-1 text-[10px]">{item.count}</span> : null}</button>)}</nav><div className="mt-3 grid gap-1 border-t border-white/10 pt-3"><Link href="/admin/financeiro" className="rounded-2xl bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-400/20">Financeiro da plataforma</Link><Link href="/admin/indicacoes" className="rounded-2xl px-4 py-3 text-sm font-black text-white/65 hover:bg-white/10">Indicações detalhadas</Link><Link href="/admin/equipe" className="rounded-2xl px-4 py-3 text-sm font-black text-white/65 hover:bg-white/10">Gerenciar suporte</Link><Link href="/admin/auditoria" className="rounded-2xl px-4 py-3 text-sm font-black text-white/65 hover:bg-white/10">Auditoria completa</Link></div></aside>
      <section className="min-w-0">
        {message ? <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">{error}</div> : null}

        {view === 'overview' ? <><section className="rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-xl sm:p-8"><p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">Administração geral</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.06em] sm:text-5xl">Assinantes, indicadores e repasses no mesmo controle.</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/55">Cobrança, acesso, origem por indicação, valores a pagar e equipe interna em um único backoffice.</p></section><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Assinantes ativos" value={String(metrics.subscribersActive || 0)} detail={`${metrics.subscribersTrial || 0} em teste · ${metrics.subscribersOverdue || 0} atrasados`} /><Metric label="MRR estimado" value={money(metrics.estimatedMrr)} detail={`${money(metrics.revenue30d)} recebido em 30 dias`} /><Metric label="Comissão disponível" value={money(metrics.commissionsAvailable)} detail={`${money(metrics.payoutsPendingAmount)} em repasses pendentes`} /><Metric label="Indicadores" value={String(metrics.partnersActive || 0)} detail={`${metrics.referralsPendingReview || 0} indicações para revisar`} /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="rounded-[1.8rem] bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Assinaturas em atenção</h2><div className="mt-4 grid gap-2">{subscribers.filter((r: any) => ['overdue', 'canceling', 'trial'].includes(r.state)).slice(0, 8).map((r: any) => <button key={r.id} onClick={() => { setSelected(r); setView('subscribers') }} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3 text-left"><div><p className="font-black">{r.nome || r.email}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.plan || 'Sem plano'} · {dateBR(r.nextBillingAt || r.trial_ends_at)}</p></div><Badge value={r.state} /></button>)}</div></section><section className="rounded-[1.8rem] bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Pix pendentes</h2><div className="mt-4 grid gap-2">{pendingPayouts.slice(0, 8).map((r: any) => <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3"><div><p className="font-black">{r.partner?.name || r.holder_name || 'Indicador'}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.pix_key_masked || r.payoutAccount?.pix_key_masked || 'Pix não informado'}</p></div><div className="text-right"><p className="font-black text-[#05245c]">{money(r.amount)}</p><Badge value={r.status} /></div></div>)}</div></section></div></> : null}

        {view === 'subscribers' ? <section><div className="rounded-[1.8rem] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h1 className="text-3xl font-black">Controle de assinaturas</h1><p className="mt-2 text-sm font-semibold text-slate-500">{filteredSubscribers.length} de {subscribers.length} contas.</p></div><div className="flex flex-wrap gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa, e-mail, indicador..." className="min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" /><select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black"><option value="all">Todos</option><option value="active">Ativos</option><option value="trial">Teste</option><option value="overdue">Atrasados</option><option value="canceling">Cancelando</option><option value="inactive">Inativos</option></select></div></div></div><div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"><div className="overflow-hidden rounded-[1.8rem] bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[950px] w-full text-left text-sm"><thead className="bg-[#f8faff] text-[10px] font-black uppercase text-slate-400"><tr><th className="px-4 py-4">Assinante</th><th className="px-4 py-4">Plano</th><th className="px-4 py-4">Situação</th><th className="px-4 py-4">Próxima cobrança</th><th className="px-4 py-4">Último pagamento</th><th className="px-4 py-4">Indicador</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSubscribers.map((r: any) => <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-blue-50/40"><td className="px-4 py-4"><p className="font-black">{r.nome || r.email}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.email || '—'}</p></td><td className="px-4 py-4 font-bold">{r.plan || '—'}</td><td className="px-4 py-4"><Badge value={r.state} /></td><td className="px-4 py-4 font-bold text-slate-500">{dateBR(r.nextBillingAt)}</td><td className="px-4 py-4 font-bold text-slate-500">{dateBR(r.lastPaidAt)}</td><td className="px-4 py-4"><p className="font-black">{r.referral?.partner?.name || 'Orgânico'}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.referral?.code || '—'}</p></td></tr>)}</tbody></table></div></div><aside className="h-fit rounded-[1.8rem] bg-white p-5 shadow-sm xl:sticky xl:top-24">{selected ? <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-slate-400">Detalhes</p><h2 className="mt-2 text-2xl font-black">{selected.nome || selected.email}</h2></div><Badge value={selected.state} /></div><div className="mt-5 grid gap-2">{[['E-mail', selected.email], ['Telefone', selected.telefone || selected.whatsapp], ['Plano', selected.plan], ['Provider', selected.subscription_provider], ['Próxima cobrança', dateBR(selected.nextBillingAt)], ['Acesso até', dateBR(selected.access_until || selected.assinatura_expira_em)], ['ID assinatura', selected.provider_subscription_id || selected.mercado_pago_subscription_id]].map(([l, v]) => <div key={String(l)} className="rounded-2xl bg-[#f8faff] p-3"><p className="text-[9px] font-black uppercase text-slate-400">{l}</p><p className="mt-1 break-all font-black">{String(v || '—')}</p></div>)}</div><div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-black text-[#05245c]">{selected.referral ? `Indicado por ${selected.referral.partner?.name || 'Indicador'}` : 'Cadastro orgânico'}</p>{selected.referral ? <p className="mt-1 text-xs font-bold text-slate-500">Código {selected.referral.code || '—'} · comissão esperada {money(selected.referral.commissionExpected)}</p> : null}</div><div className="mt-5"><p className="text-xs font-black uppercase text-slate-400">Últimos pagamentos</p><div className="mt-2 grid gap-2">{(selected.paymentHistory || []).slice(0, 5).map((p: any) => <div key={p.id} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between"><p className="font-black">{money(p.valor)}</p><Badge value={p.status} /></div><p className="mt-1 text-xs font-bold text-slate-400">{p.provider || '—'} · {dateBR(p.paid_at || p.created_at)}</p></div>)}</div></div></> : <div className="py-12 text-center"><p className="font-black">Selecione um assinante</p><p className="mt-2 text-sm font-semibold text-slate-400">Histórico e origem aparecem aqui.</p></div>}</aside></div></section> : null}

        {view === 'partners' ? <section><div className="rounded-[1.8rem] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-black">Indicadores</h1><p className="mt-2 text-sm font-semibold text-slate-500">Saldo, retenção, Pix e conversões.</p></div><div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar indicador..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"/><Link href="/admin/indicacoes" className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white">Controle detalhado</Link></div></div></div><div className="mt-4 grid gap-3">{filteredPartners.map((p: any) => <article key={p.id} className="rounded-[1.7rem] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{p.name}</h2><Badge value={p.status}/><span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-[#05245c]">{p.code}</span></div><p className="mt-2 text-sm font-bold text-slate-500">{p.email} · {p.whatsapp || 'sem WhatsApp'}</p><p className="mt-1 text-xs font-bold text-slate-400">{p.referrals} indicações · {p.qualified} clientes pagos</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-2xl bg-[#f8faff] p-3"><p className="text-[9px] font-black uppercase text-slate-400">Disponível</p><p className="mt-1 font-black text-emerald-700">{money(p.availableCommission)}</p></div><div className="rounded-2xl bg-[#f8faff] p-3"><p className="text-[9px] font-black uppercase text-slate-400">Retenção</p><p className="mt-1 font-black">{money(p.holdCommission)}</p></div><div className="rounded-2xl bg-[#f8faff] p-3"><p className="text-[9px] font-black uppercase text-slate-400">Pix</p><p className="mt-1 font-black">{p.payoutAccount?.pix_key_masked || 'Não cadastrado'}</p></div><div className="rounded-2xl bg-[#f8faff] p-3"><p className="text-[9px] font-black uppercase text-slate-400">Verificado</p><p className="mt-1 font-black">{p.payoutAccount?.is_verified ? 'Sim' : 'Não'}</p></div></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button onClick={() => void revealPix(p)} disabled={busy === `reveal_pix:${p.id}`} className="rounded-xl border border-blue-100 px-3 py-2 text-xs font-black text-[#05245c] disabled:opacity-50">Revelar Pix</button><button onClick={() => void createPayout(p)} disabled={Number(p.availableCommission || 0) <= 0 || Boolean(p.pendingPayout) || !p.payoutAccount?.is_verified || busy === `create_payout:${p.id}`} className="rounded-xl bg-[#05245c] px-3 py-2 text-xs font-black text-white disabled:opacity-35">Criar repasse</button></div></article>)}</div>{revealedPix ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b3a]/55 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl"><p className="text-xs font-black uppercase text-slate-400">Chave Pix revelada</p><h2 className="mt-2 text-2xl font-black">{revealedPix.partnerName}</h2><div className="mt-4 rounded-2xl bg-[#f8faff] p-4"><p className="text-xs font-black text-slate-400">{revealedPix.pixKeyType}</p><p className="mt-2 break-all text-lg font-black text-[#05245c]">{revealedPix.pixKey}</p><p className="mt-2 text-xs font-bold text-slate-500">{revealedPix.holderName || 'Titular não informado'} · {revealedPix.bankName || 'Banco não informado'}</p></div><div className="mt-4 flex gap-2"><button onClick={() => void navigator.clipboard?.writeText(revealedPix.pixKey)} className="flex-1 rounded-2xl bg-[#05245c] px-4 py-3 font-black text-white">Copiar</button><button onClick={() => setRevealedPix(null)} className="rounded-2xl border border-slate-200 px-4 py-3 font-black">Fechar</button></div></div></div> : null}</section> : null}

        {view === 'payouts' ? <section><div className="rounded-[1.8rem] bg-white p-5 shadow-sm"><h1 className="text-3xl font-black">Pix e repasses</h1><p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Aprovar e enviar Pix são ações exclusivas desta conta owner. O envio usa o backend já existente e fica auditado.</p></div><div className="mt-4 grid gap-3">{payouts.map((p: any) => <article key={p.id} className="rounded-[1.7rem] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-black">{p.partner?.name || p.holder_name || 'Indicador'}</h2><Badge value={p.status}/></div><p className="mt-2 text-sm font-bold text-slate-500">{p.partner?.email || '—'}</p><p className="mt-1 text-xs font-bold text-slate-400">Pix {p.pix_key_masked || p.payoutAccount?.pix_key_masked || 'não cadastrado'} · {dateBR(p.requested_at || p.created_at)}</p></div><p className="text-2xl font-black text-[#05245c]">{money(p.amount)}</p></div><div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{p.status === 'requested' ? <button onClick={() => void approvePayout(p)} disabled={busy === `approve_payout:${p.id}`} className="rounded-xl border border-blue-100 px-3 py-2 text-xs font-black text-[#05245c]">Aprovar</button> : null}{['requested','approved'].includes(p.status) ? <button onClick={() => void sendPayout(p)} disabled={!p.payoutAccount?.is_verified || busy === `send_payout:${p.id}`} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-35">Enviar Pix</button> : null}<Link href="/admin/indicacoes" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Mais opções</Link></div>{p.failure_reason ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{p.failure_reason}</p> : null}</article>)}</div></section> : null}

        {view === 'team' ? <section><div className="rounded-[1.8rem] bg-white p-5 shadow-sm"><h1 className="text-3xl font-black">Acessos de suporte</h1><p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Suporte entra pelo mesmo login de parceiros, mas cai numa área separada sem valores, Pix, repasses, auditoria ou gestão de equipe.</p><Link href="/admin/equipe" className="mt-5 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Criar ou editar acessos</Link></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{team.map((m: any) => <article key={m.id} className="rounded-[1.6rem] bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="font-black">{m.nome || m.email}</h2><p className="mt-1 break-all text-xs font-bold text-slate-400">{m.email}</p></div><Badge value={m.is_active ? 'active' : 'inactive'}/></div><p className="mt-4 text-xs font-black uppercase text-[#05245c]">{m.role}</p><p className="mt-2 text-xs font-bold text-slate-400">Último acesso: {dateBR(m.last_login_at)}</p></article>)}</div></section> : null}

        {view === 'audit' ? <section><div className="rounded-[1.8rem] bg-white p-5 shadow-sm"><h1 className="text-3xl font-black">Auditoria recente</h1><p className="mt-2 text-sm font-semibold text-slate-500">Últimas ações administrativas.</p></div><div className="mt-4 overflow-x-auto rounded-[1.8rem] bg-white shadow-sm"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-[#f8faff] text-[10px] font-black uppercase text-slate-400"><tr><th className="px-4 py-4">Data</th><th className="px-4 py-4">Usuário</th><th className="px-4 py-4">Ação</th><th className="px-4 py-4">Alvo</th></tr></thead><tbody className="divide-y divide-slate-100">{audit.map((r: any) => <tr key={r.id}><td className="px-4 py-4 font-bold text-slate-500">{dateBR(r.created_at)}</td><td className="px-4 py-4 font-black">{r.admin_email}</td><td className="px-4 py-4 font-bold">{r.action}</td><td className="px-4 py-4 font-bold text-slate-500">{r.target_label || r.target_id || r.target_type || '—'}</td></tr>)}</tbody></table></div></section> : null}
      </section>
    </div>
  </main>
}
