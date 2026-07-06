/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Mode = 'overview' | 'config' | 'sales'

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateBR(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return date.toLocaleString('pt-BR')
}

function friendlyStatus(status?: string | null) {
  const raw = String(status || 'pending').toLowerCase()
  if (raw === 'paid' || raw === 'approved') return 'Pago'
  if (raw === 'pending') return 'Pendente'
  if (raw === 'in_process') return 'Em análise'
  if (raw === 'failed' || raw === 'rejected') return 'Recusado'
  if (raw === 'canceled' || raw === 'cancelled') return 'Cancelado'
  if (raw === 'refunded') return 'Estornado'
  if (raw === 'connected') return 'Conectado'
  if (raw === 'error') return 'Erro'
  return raw || 'Pendente'
}

function statusBadge(status?: string | null) {
  const raw = String(status || 'pending').toLowerCase()
  const cls = raw === 'paid' || raw === 'approved' || raw === 'connected'
    ? 'bg-emerald-50 text-emerald-700'
    : raw === 'pending' || raw === 'in_process'
      ? 'bg-amber-50 text-amber-700'
      : raw === 'error' || raw === 'failed' || raw === 'rejected' || raw === 'canceled' || raw === 'cancelled'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${cls}`}>{friendlyStatus(raw)}</span>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 break-words text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{detail}</p>
    </div>
  )
}

function paymentKind(row: any) {
  if (row.provider === 'mercado_pago') return 'Pix/cartão online'
  if (row.provider_status) return friendlyStatus(row.provider_status)
  return 'Pagamento online'
}

export default function MarketplacePaymentsPanel({ mode }: { mode: Mode }) {
  const [token, setToken] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token || ''
    setToken(accessToken)
    return accessToken
  }

  async function load() {
    setLoading(true)
    setError('')
    const accessToken = token || await getToken()
    if (!accessToken) {
      setError('Você precisa estar logado.')
      setLoading(false)
      return
    }

    const [settingsResponse, salesResponse] = await Promise.all([
      fetch('/api/marketplace/payments/settings', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
      fetch('/api/marketplace/payments/sales', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
    ])

    const settingsPayload = await settingsResponse.json().catch(() => ({}))
    const salesPayload = await salesResponse.json().catch(() => ({}))

    if (!settingsResponse.ok) {
      setError(settingsPayload.error || 'Erro ao carregar configuração de pagamento.')
    } else {
      setSettings(settingsPayload)
    }

    if (salesResponse.ok) setSales(salesPayload.payments || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function connectMercadoPago() {
    setConnecting(true)
    setError('')
    const accessToken = token || await getToken()
    const response = await fetch('/api/marketplace/payments/mercado-pago/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Erro ao conectar Mercado Pago.')
      setConnecting(false)
      return
    }
    window.location.href = payload.url
  }

  async function disconnectMercadoPago() {
    const ok = window.confirm('Desconectar Mercado Pago desta empresa?')
    if (!ok) return
    const accessToken = token || await getToken()
    const response = await fetch('/api/marketplace/payments/mercado-pago/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Erro ao desconectar Mercado Pago.')
      return
    }
    setMessage('Mercado Pago desconectado.')
    await load()
  }

  const stats = settings?.stats || {}
  const setting = settings?.setting
  const connected = Boolean(setting?.is_active && setting?.onboarding_status === 'connected')
  const commissionPercentage = Number(settings?.commission_rule?.percentage || settings?.commission_rule?.commission_percentage || 0)

  const filteredSales = useMemo(() => sales, [sales])

  if (loading) {
    return <main className="min-h-screen bg-[#f8fbff] p-6"><div className="rounded-[2rem] border border-blue-100 bg-white p-8 font-black text-[#071b3a] shadow-xl">Carregando pagamentos...</div></main>
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8fbff] p-4 text-[#071b3a] sm:p-6">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex min-w-0 flex-col gap-4 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recebimentos online</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.055em]">💳 Pagamentos</h1>
            <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
              Acompanhe os pagamentos online dos pedidos feitos pelo seu site. Pix e cartão passam pelo Mercado Pago; Pix manual, dinheiro e cartão na entrega ficam em Formas de pagamento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/painel/pagamentos" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-black text-[#05245c]">Resumo</Link>
            <Link href="/painel/pagamentos/configuracao" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-black text-[#05245c]">Configurar integração</Link>
            <Link href="/painel/pagamentos/vendas" className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-black text-[#05245c]">Vendas online</Link>
          </div>
        </div>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        {mode === 'overview' ? (
          <>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Total vendido online" value={money(stats.paid_amount)} detail="Pagamentos aprovados" />
              <Metric label="Pagamentos aprovados" value={String(stats.paid_count || 0)} detail="Pedidos confirmados" />
              <Metric label="Pagamentos pendentes" value={String(stats.pending_count || 0)} detail="Aguardando confirmação" />
              <Metric label="Pagamentos com erro" value={String(stats.failed_count || 0)} detail="Recusados ou cancelados" />
              <Metric label="Taxa da plataforma" value={money(stats.commission_amount)} detail="Somente vendas online pagas" />
            </div>
            <IntegrationCard connected={connected} setting={setting} commissionPercentage={commissionPercentage} connect={connectMercadoPago} disconnect={disconnectMercadoPago} connecting={connecting} />
            <SalesTable rows={filteredSales.slice(0, 8)} />
          </>
        ) : null}

        {mode === 'config' ? <IntegrationCard connected={connected} setting={setting} commissionPercentage={commissionPercentage} connect={connectMercadoPago} disconnect={disconnectMercadoPago} connecting={connecting} expanded /> : null}
        {mode === 'sales' ? <SalesTable rows={filteredSales} /> : null}
      </section>
    </main>
  )
}

function IntegrationCard({ connected, setting, commissionPercentage, connect, disconnect, connecting, expanded = false }: { connected: boolean; setting: any; commissionPercentage: number; connect: () => void; disconnect: () => void; connecting: boolean; expanded?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mercado Pago</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{connected ? 'Mercado Pago conectado' : 'Conecte sua conta Mercado Pago'}</h2>
          <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
            {connected
              ? 'Sua loja já pode receber Pix e cartão online pelo checkout do site. O Orçaly registra o status automaticamente quando o Mercado Pago confirma o pagamento.'
              : 'Ative Pix e cartão no checkout do seu site. Se não conectar, a loja continua usando as formas manuais cadastradas.'}
          </p>
        </div>
        {statusBadge(connected ? 'connected' : setting?.onboarding_status || 'pending')}
      </div>

      {expanded ? (
        <div className="grid gap-4 border-y border-blue-50 bg-[#f8fbff] p-6 lg:grid-cols-3">
          <div className="rounded-[1.3rem] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Como funciona</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">Quando uma venda for paga pelo site, o Mercado Pago processa o pagamento e o Orçaly atualiza pedido, pagamento e entrega.</p>
          </div>
          <div className="rounded-[1.3rem] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Taxa por venda online</p>
            <p className="mt-2 text-2xl font-black text-[#05245c]">{commissionPercentage ? `${commissionPercentage}%` : 'Regra da plataforma'}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">Aplicada apenas quando o cliente paga online.</p>
          </div>
          <div className="rounded-[1.3rem] bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Segurança</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">Tokens e dados técnicos ficam protegidos no servidor. Esta tela mostra só o status da conexão.</p>
          </div>
          {setting?.last_error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 lg:col-span-3">Último erro informado pela integração: {setting.last_error}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-6 sm:flex-row">
        <button onClick={connect} disabled={connecting} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">{connecting ? 'Abrindo Mercado Pago...' : connected ? 'Reconectar Mercado Pago' : 'Conectar Mercado Pago'}</button>
        {connected ? <button onClick={disconnect} className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 font-black text-red-700">Desconectar</button> : null}
        <Link href="/painel/formas-pagamento" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">Formas manuais</Link>
      </div>
    </div>
  )
}

function SalesTable({ rows }: { rows: any[] }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="border-b border-blue-50 p-5">
        <h2 className="text-2xl font-black tracking-[-0.04em]">Vendas online</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">Pedidos pagos, pendentes ou com erro no checkout online.</p>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[880px] w-full text-left text-sm">
          <thead className="bg-[#f8fbff] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            <tr><th className="px-5 py-4">Pedido</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Valor</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Forma</th><th className="px-5 py-4">Data</th><th className="px-5 py-4">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {rows.length ? rows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-4 font-black text-[#05245c]">{row.order_id ? <Link href={`/painel/pedidos/${row.order_id}`}>#{String(row.order_id).slice(0, 8)}</Link> : '-'}</td>
                <td className="px-5 py-4 font-bold text-slate-600">{row.payer_name || row.payer_phone || 'Cliente do site'}</td>
                <td className="px-5 py-4 font-bold text-slate-600">{money(row.amount)}</td>
                <td className="px-5 py-4">{statusBadge(row.status || row.provider_status)}</td>
                <td className="px-5 py-4 font-bold text-slate-600">{paymentKind(row)}</td>
                <td className="px-5 py-4 font-bold text-slate-600">{dateBR(row.paid_at || row.created_at)}</td>
                <td className="px-5 py-4">{row.checkout_url && row.status !== 'paid' ? <a href={row.checkout_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#05245c] px-3 py-2 text-xs font-black text-white">Abrir pagamento</a> : row.order_id ? <Link href={`/painel/pedidos/${row.order_id}`} className="rounded-xl border border-blue-100 px-3 py-2 text-xs font-black text-[#05245c]">Ver pedido</Link> : '-'}</td>
              </tr>
            )) : <tr><td colSpan={7} className="px-5 py-10 text-center font-bold text-slate-500">Nenhuma venda online ainda.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {rows.length ? rows.map((row) => (
          <article key={row.id} className="rounded-[1.4rem] border border-blue-100 bg-[#f8fbff] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-[#05245c]">{row.order_id ? `Pedido #${String(row.order_id).slice(0, 8)}` : 'Venda online'}</p>
              {statusBadge(row.status || row.provider_status)}
            </div>
            <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600">
              <p>Cliente: {row.payer_name || row.payer_phone || 'Cliente do site'}</p>
              <p>Valor: {money(row.amount)}</p>
              <p>Forma: {paymentKind(row)}</p>
              <p>Data: {dateBR(row.paid_at || row.created_at)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {row.checkout_url && row.status !== 'paid' ? <a href={row.checkout_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#05245c] px-3 py-2 text-xs font-black text-white">Abrir pagamento</a> : null}
              {row.order_id ? <Link href={`/painel/pedidos/${row.order_id}`} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c]">Ver pedido</Link> : null}
            </div>
          </article>
        )) : <div className="rounded-[1.4rem] bg-[#f8fbff] p-8 text-center font-bold text-slate-500">Nenhuma venda online ainda.</div>}
      </div>
    </div>
  )
}
