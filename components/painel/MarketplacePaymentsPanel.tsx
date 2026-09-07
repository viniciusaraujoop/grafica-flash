/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
type Mode = 'overview' | 'config' | 'sales' | 'fees'
type Tab = 'overview' | 'online' | 'mercado-pago' | 'taxas'
// ORCALY_MP_CAPABILITIES_PANEL_V1

const platformRates = [
  { plan: 'Essencial', percentage: 3.5, detail: 'Estrutura ideal para começar a receber pelo site.' },
  { plan: 'Profissional', percentage: 3.0, detail: 'Condição reduzida para uma operação em crescimento.' },
  { plan: 'Premium', percentage: 2.0, detail: 'A menor condição para operações com maior volume.' },
]

const paymentTabs: Array<{
  id: Tab
  label: string
  detail: string
  icon: string
  href: string
}> = [
  {
    id: 'overview',
    label: 'Visão geral',
    detail: 'Resumo da operação',
    icon: '⌂',
    href: '/painel/pagamentos?tab=overview',
  },
  {
    id: 'online',
    label: 'Recebimentos',
    detail: 'Histórico de vendas',
    icon: '↗',
    href: '/painel/pagamentos?tab=online',
  },
  {
    id: 'mercado-pago',
    label: 'Mercado Pago',
    detail: 'Conta de recebimento',
    icon: 'MP',
    href: '/painel/pagamentos?tab=mercado-pago',
  },
  {
    id: 'taxas',
    label: 'Condições do plano',
    detail: 'Percentuais vigentes',
    icon: '%',
    href: '/painel/pagamentos?tab=taxas',
  },
]

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
  if (raw === 'paid' || raw === 'approved') return 'Pagamento confirmado'
  if (raw === 'pending' || raw === 'pending_payment') return 'Aguardando pagamento'
  if (raw === 'in_process' || raw === 'processing') return 'Pagamento em análise'
  if (raw === 'failed' || raw === 'rejected') return 'Pagamento não aprovado'
  if (raw === 'canceled' || raw === 'cancelled') return 'Pagamento cancelado'
  if (raw === 'refunded') return 'Pagamento devolvido'
  if (raw === 'connected') return 'Conectado'
  if (raw === 'error') return 'Erro'
  return raw || 'Pendente'
}

function statusBadge(status?: string | null) {
  const raw = String(status || 'pending').toLowerCase()
  const cls = raw === 'paid' || raw === 'approved' || raw === 'connected'
    ? 'bg-emerald-50 text-emerald-700'
    : raw === 'pending' || raw === 'pending_payment' || raw === 'in_process' || raw === 'processing'
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


function paymentGross(row: any) {
  return Number(row.amount || row.total_amount || 0)
}

function paymentDiscounts(row: any) {
  return Number(row.discount_amount || 0)
    + Number(row.commission_amount || 0)
    + Number(row.provider_fee_amount || 0)
}

function paymentNet(row: any) {
  const recorded = Number(row.net_amount || 0)
  if (recorded > 0) return recorded

  return Math.max(
    0,
    paymentGross(row)
      - Number(row.commission_amount || 0)
      - Number(row.provider_fee_amount || 0),
  )
}

function paymentKind(row: any) {
  if (row.provider === 'mercado_pago') return 'Pix/cartão online'
  if (row.provider_status) return friendlyStatus(row.provider_status)
  return 'Pagamento online'
}

function tabFromMode(mode: Mode): Tab {
  if (mode === 'config') return 'mercado-pago'
  if (mode === 'sales') return 'online'
  if (mode === 'fees') return 'taxas'
  return 'overview'
}

function normalizeTab(value: string | null, fallback: Tab): Tab {
  if (value === 'formas') return 'mercado-pago'
  if (value === 'online' || value === 'mercado-pago' || value === 'taxas' || value === 'overview') return value
  if (value === 'vendas') return 'online'
  if (value === 'configuracao' || value === 'mercado_pago') return 'mercado-pago'
  if (value === 'fees' || value === 'comissao') return 'taxas'
  return fallback
}

export default function MarketplacePaymentsPanel({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const activeTab = normalizeTab(searchParams.get('tab'), tabFromMode(mode))

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
  useEffect(() => {
    const mp = searchParams.get("mp");
    const providerMessage = searchParams.get("message");

    if (mp === "connected") {
      setMessage(
        "Mercado Pago conectado. O marketplace já pode receber Pix e cartões.",
      );
      setError("");
    }

    if (mp === "error") {
      setError(
        providerMessage ||
          "Nao foi possivel concluir a conexao com o Mercado Pago.",
      );
      setMessage("");
    }
  }, [searchParams]);

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
  const connected = Boolean(
    setting?.account_connected &&
    setting?.is_active &&
    setting?.onboarding_status === 'connected' &&
    setting?.charges_enabled !== false
  )
  const commissionPercentage = Number(settings?.commission_rule?.percentage || settings?.commission_rule?.commission_percentage || 0)
  const currentPlan = String(settings?.company?.plano || 'essencial')
  const filteredSales = useMemo(() => sales, [sales])
  const paidSales = useMemo(() => sales.filter((row) => ['paid', 'approved'].includes(String(row.status || row.provider_status || '').toLowerCase())), [sales])
  const netEstimated = useMemo(() => paidSales.reduce((acc, row) => acc + paymentNet(row), 0), [paidSales])

  if (loading) {
    return <main className="min-h-screen bg-[#f8fbff] p-6"><div className="rounded-[2rem] border border-blue-100 bg-white p-8 font-black text-[#071b3a] shadow-xl">Carregando pagamentos...</div></main>
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8fbff] p-4 text-[#071b3a] sm:p-6">
      <section className="mx-auto max-w-7xl min-w-0 space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-24 h-36 w-36 rounded-full bg-emerald-100 blur-3xl" />
            <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Central da loja</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.055em]">💳 Pagamentos</h1>
                <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
                  Acompanhe seus recebimentos, consulte o histórico de vendas e gerencie a conta usada no checkout da loja.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => load()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md"
                >
                  <span aria-hidden="true">↻</span>
                  Atualizar
                </button>
                <Link
                  href="/painel/configuracoes"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-black text-[#05245c] transition hover:-translate-y-0.5 hover:bg-blue-100"
                >
                  <span aria-hidden="true">⚙</span>
                  Configurações
                </Link>
                <Link
                  href="/painel/assinatura"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
                >
                  <span aria-hidden="true">★</span>
                  Ver meu plano
                </Link>
              </div>
            </div>
          </div>
        </div>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        {/* ORCALY_PAYMENTS_EXPERIENCE_V2 */}
        <nav className="grid gap-2 rounded-[1.6rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5 sm:grid-cols-2 xl:grid-cols-4">
          {paymentTabs.map((item) => {
            const active = activeTab === item.id

            return (
              <Link
                key={item.id}
                href={item.href}
                scroll={false}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`group flex min-w-0 items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                  active
                    ? 'border-[#05245c] bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20'
                    : 'border-transparent text-slate-500 hover:border-blue-100 hover:bg-blue-50 hover:text-[#05245c]'
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black transition ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-100 text-[#05245c] group-hover:bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{item.label}</strong>
                  <small
                    className={`mt-0.5 block truncate text-xs font-bold ${
                      active ? 'text-white/65' : 'text-slate-400'
                    }`}
                  >
                    {item.detail}
                  </small>
                </span>
              </Link>
            )
          })}
        </nav>

        {activeTab === 'overview' || activeTab === 'online' ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Total confirmado" value={money(stats.paid_amount)} detail="Vendas com pagamento aprovado" />
            <Metric label="Líquido estimado" value={money(netEstimated)} detail="Após os valores registrados" />
            <Metric label="Aprovados" value={String(stats.paid_count || 0)} detail="Pagamentos confirmados" />
            <Metric label="Aguardando" value={String(stats.pending_count || 0)} detail="Pagamentos ainda pendentes" />
            <Metric label="Não concluídos" value={String(stats.failed_count || 0)} detail="Recusados ou cancelados" />
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <>
            <IntegrationCard
              connected={connected}
              setting={setting}
              commissionPercentage={commissionPercentage}
              connect={connectMercadoPago}
              disconnect={disconnectMercadoPago}
              connecting={connecting}
            />
            <SalesTable
              rows={filteredSales.slice(0, 6)}
              title="Últimos recebimentos"
              description="Acompanhe as movimentações mais recentes da sua loja."
              emptyText="Os primeiros recebimentos aparecerão aqui."
            />
          </>
        ) : null}

        {activeTab === 'online' ? (
          <SalesTable
            rows={filteredSales}
            title="Histórico de recebimentos"
            description="Consulte pagamentos confirmados, pendentes ou não concluídos."
            emptyText="Nenhum recebimento online foi registrado ainda."
          />
        ) : null}
        {activeTab === 'mercado-pago' ? <IntegrationCard connected={connected} setting={setting} commissionPercentage={commissionPercentage} connect={connectMercadoPago} disconnect={disconnectMercadoPago} connecting={connecting} expanded /> : null}
        {activeTab === 'taxas' ? <PlatformFeesCard currentPlan={currentPlan} commissionPercentage={commissionPercentage} expanded /> : null}
      </section>
    </main>
  )
}

function IntegrationCard({ connected, setting, commissionPercentage, connect, disconnect, connecting, expanded = false }: { connected: boolean; setting: any; commissionPercentage: number; connect: () => void; disconnect: () => void; connecting: boolean; expanded?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-blue-100/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Conta de recebimento
              </p>
              {statusBadge(connected ? 'connected' : setting?.onboarding_status || 'pending')}
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {connected ? 'Recebimentos online ativos' : 'Ative os pagamentos da sua loja'}
            </h2>

            <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
              {connected
                ? 'Sua conta está conectada e pronta para receber pagamentos feitos pelo site.'
                : 'Conecte uma conta Mercado Pago para disponibilizar pagamentos online no checkout da loja.'}
            </p>
          </div>

          {connected ? (
            <div className="grid shrink-0 grid-cols-3 gap-2">
              {[
                ['Pix', 'Disponível'],
                ['Cartões', 'Disponível'],
                ['Checkout', 'Ativo'],
              ].map(([label, detail]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-center"
                >
                  <p className="text-xs font-black text-emerald-700">{label}</p>
                  <p className="mt-1 text-[11px] font-bold text-emerald-600">{detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-4 border-y border-blue-50 bg-[#f8fbff] p-5 sm:p-6 lg:grid-cols-3">
          <article className="rounded-[1.4rem] border border-blue-100 bg-white p-5 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-lg font-black text-[#05245c]">
              ◈
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Formas de pagamento
            </p>
            <p className="mt-2 font-black leading-6 text-[#071b3a]">
              Pix, crédito e débito
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
              Opções disponíveis no checkout da sua loja.
            </p>
          </article>

          <article className="rounded-[1.4rem] border border-blue-100 bg-white p-5 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-lg font-black text-violet-700">
              %
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Condição do plano
            </p>
            <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#05245c]">
              {commissionPercentage ? `${commissionPercentage}%` : 'Conforme plano'}
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
              Percentual vigente para vendas online.
            </p>
          </article>

          <article className="rounded-[1.4rem] border border-blue-100 bg-white p-5 shadow-sm">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl text-lg font-black ${
              connected
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {connected ? '✓' : '!'}
            </span>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Situação da conta
            </p>
            <p className="mt-2 font-black leading-6 text-[#071b3a]">
              {connected ? 'Tudo pronto para receber' : 'Conexão necessária'}
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
              {connected
                ? 'A loja está habilitada para receber pelo site.'
                : 'Conclua a conexão para liberar o checkout online.'}
            </p>
          </article>

          {setting?.last_error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700 lg:col-span-3">
              Não foi possível concluir a última tentativa: {setting.last_error}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:p-6">
        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#05245c] to-[#0a4b9f] px-6 py-4 font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15 text-sm" aria-hidden="true">
            ↗
          </span>
          {connecting
            ? 'Abrindo conexão...'
            : connected
              ? 'Atualizar conexão'
              : 'Conectar conta Mercado Pago'}
        </button>

        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black text-slate-600 transition hover:border-red-100 hover:bg-red-50 hover:text-red-700"
          >
            <span aria-hidden="true">×</span>
            Desconectar conta
          </button>
        ) : null}
      </div>
    </section>
  )
}

function PlatformFeesCard({ currentPlan, commissionPercentage, expanded = false }: { currentPlan: string; commissionPercentage: number; expanded?: boolean }) {
  const normalizedPlan = currentPlan.toLowerCase()

  return (
    <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="border-b border-blue-50 p-6 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Condições do plano
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
          Percentual para vendas online
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
          Cada plano possui uma condição para vendas concluídas pelo site. As tarifas do meio de pagamento são apresentadas separadamente pelo provedor.
        </p>
      </div>

      <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-3">
        {platformRates.map((rate) => {
          const active =
            normalizedPlan.includes(rate.plan.toLowerCase()) ||
            Number(commissionPercentage) === rate.percentage

          return (
            <article
              key={rate.plan}
              className={`relative overflow-hidden rounded-[1.5rem] border p-5 transition ${
                active
                  ? 'border-[#05245c] bg-[#05245c] text-white shadow-xl shadow-blue-950/15'
                  : 'border-blue-100 bg-[#f8fbff] text-[#071b3a] hover:-translate-y-0.5 hover:bg-white hover:shadow-lg'
              }`}
            >
              {active ? (
                <span className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black text-white">
                  Seu plano
                </span>
              ) : null}

              <p className={`text-xs font-black uppercase tracking-[0.16em] ${
                active ? 'text-white/55' : 'text-slate-400'
              }`}>
                {rate.plan}
              </p>

              <p className="mt-5 text-4xl font-black tracking-[-0.055em]">
                {rate.percentage.toLocaleString('pt-BR')}%
              </p>

              <p className={`mt-3 text-sm font-bold leading-6 ${
                active ? 'text-white/70' : 'text-slate-500'
              }`}>
                {rate.detail}
              </p>
            </article>
          )
        })}
      </div>

      {expanded ? (
        <div className="mx-5 mb-5 flex items-start gap-3 rounded-[1.4rem] border border-emerald-100 bg-emerald-50 p-4 sm:mx-6 sm:mb-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white font-black text-emerald-700 shadow-sm">
            ✓
          </span>
          <div>
            <p className="font-black text-emerald-800">Aplicação automática</p>
            <p className="mt-1 text-sm font-bold leading-6 text-emerald-700">
              O percentual correspondente ao plano é considerado automaticamente quando uma venda online é concluída.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function SalesTable({
  rows,
  title = 'Recebimentos online',
  description = 'Acompanhe os pagamentos realizados pelo checkout da loja.',
  emptyText = 'Nenhum recebimento online ainda.',
}: {
  rows: any[]
  title?: string
  description?: string
  emptyText?: string
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
      <div className="flex flex-col gap-3 border-b border-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Movimentações
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">{title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{description}</p>
        </div>
        <Link
          href="/painel/pagamentos?tab=online"
          scroll={false}
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c] transition hover:bg-blue-100"
        >
          Ver histórico
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-[#f8fbff] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Pedido</th>
              <th className="px-5 py-4">Cliente</th>
              <th className="px-5 py-4">Valor bruto</th>
              <th className="px-5 py-4">Valor líquido</th>
              <th className="px-5 py-4">Valores registrados</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Data</th>
              <th className="px-5 py-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-blue-50/40">
                  <td className="px-5 py-4 font-black text-[#05245c]">
                    {row.order_id ? (
                      <Link href={`/painel/pedidos/${row.order_id}`}>
                        #{String(row.order_id).slice(0, 8)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-600">
                    {row.payer_name || row.payer_phone || 'Cliente do site'}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-600">
                    {money(paymentGross(row))}
                  </td>
                  <td className="px-5 py-4 font-black text-emerald-700">
                    {money(paymentNet(row))}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-600">
                    {money(paymentDiscounts(row))}
                  </td>
                  <td className="px-5 py-4">
                    {statusBadge(row.status || row.provider_status)}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-600">
                    {dateBR(row.paid_at || row.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    {row.checkout_url && row.status !== 'paid' ? (
                      <a
                        href={row.checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#05245c] px-3 py-2 text-xs font-black text-white transition hover:bg-[#031a43]"
                      >
                        Abrir pagamento
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : row.order_id ? (
                      <Link
                        href={`/painel/pedidos/${row.order_id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c] transition hover:bg-blue-50"
                      >
                        Ver pedido
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center font-bold text-slate-500">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {rows.length ? (
          rows.map((row) => (
            <article
              key={row.id}
              className="rounded-[1.4rem] border border-blue-100 bg-[#f8fbff] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[#05245c]">
                  {row.order_id
                    ? `Pedido #${String(row.order_id).slice(0, 8)}`
                    : 'Recebimento online'}
                </p>
                {statusBadge(row.status || row.provider_status)}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-black text-slate-400">Valor bruto</p>
                  <p className="mt-1 font-black text-[#071b3a]">
                    {money(paymentGross(row))}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-black text-slate-400">Líquido estimado</p>
                  <p className="mt-1 font-black text-emerald-700">
                    {money(paymentNet(row))}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-1 text-sm font-bold text-slate-600">
                <p>Cliente: {row.payer_name || row.payer_phone || 'Cliente do site'}</p>
                <p>Forma: {paymentKind(row)}</p>
                <p>Data: {dateBR(row.paid_at || row.created_at)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {row.checkout_url && row.status !== 'paid' ? (
                  <a
                    href={row.checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#05245c] px-4 py-3 text-xs font-black text-white"
                  >
                    Abrir pagamento
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                {row.order_id ? (
                  <Link
                    href={`/painel/pedidos/${row.order_id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-xs font-black text-[#05245c]"
                  >
                    Ver pedido
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[1.4rem] bg-[#f8fbff] p-8 text-center font-bold text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  )
}
