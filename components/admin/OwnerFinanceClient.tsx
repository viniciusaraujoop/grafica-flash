/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_FINANCE_V1
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'

type Json = Record<string, any>

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function percent(value: unknown) {
  const parsed = Number(value || 0)
  const sign = parsed > 0 ? '+' : ''
  return `${sign}${parsed.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })}%`
}

function dateBR(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function defaultMonth() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year =
    parts.find((part) => part.type === 'year')?.value ||
    String(new Date().getFullYear())
  const month =
    parts.find((part) => part.type === 'month')?.value ||
    '01'

  return `${year}-${month}`
}

async function token() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

function Delta({
  value,
  suffix = 'vs. mês anterior',
}: {
  value: unknown
  suffix?: string
}) {
  const parsed = Number(value || 0)
  const tone =
    parsed > 0
      ? 'text-emerald-700'
      : parsed < 0
        ? 'text-red-700'
        : 'text-slate-400'

  return (
    <p className={`mt-2 text-xs font-black ${tone}`}>
      {percent(parsed)} {suffix}
    </p>
  )
}

function Metric({
  label,
  value,
  detail,
  delta,
  emphasis = false,
}: {
  label: string
  value: string
  detail: string
  delta?: unknown
  emphasis?: boolean
}) {
  return (
    <article
      className={`rounded-[1.6rem] border p-5 shadow-sm ${
        emphasis
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-white bg-white'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-3 text-3xl font-black tracking-[-0.045em] ${
          emphasis ? 'text-emerald-800' : 'text-[#071b3a]'
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
        {detail}
      </p>
      {delta !== undefined ? <Delta value={delta} /> : null}
    </article>
  )
}

export default function OwnerFinanceClient() {
  const router = useRouter()
  const [month, setMonth] = useState(defaultMonth)
  const [data, setData] = useState<Json | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const accessToken = await token()

    if (!accessToken) {
      router.replace('/parceiros/login')
      return
    }

    const response = await fetch(
      `/api/admin/finance?month=${encodeURIComponent(month)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      },
    )

    const payload = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        router.replace('/parceiros/login')
        return
      }

      setError(
        payload.error ||
          'Não foi possível carregar o financeiro.',
      )
      setLoading(false)
      return
    }

    setData(payload)
    setLoading(false)
  }, [month, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  const current = data?.current || {}
  const metrics = current.metrics || {}
  const comparison = data?.comparison || {}
  const obligations = data?.obligations || {}
  const notes = data?.accountingNotes || {}
  const daily = current.daily || []
  const subscriptions = current.subscriptionDetails || []
  const marketplace = current.marketplaceDetails || []
  const payouts = current.payoutDetails || []

  const maxDaily = useMemo(
    () =>
      Math.max(
        1,
        ...daily.map((row: Json) =>
          Math.max(
            Number(row.subscriptions || 0) +
              Number(row.marketplaceRevenue || 0),
            Math.abs(Number(row.net || 0)),
          ),
        ),
      ),
    [daily],
  )

  if (loading && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f9] text-[#071b3a]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-4 font-black">
            Conciliando financeiro...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] text-[#071b3a]">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xl font-black text-[#05245c]">
              Orçaly
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Financeiro da plataforma
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-[10px] font-black uppercase text-slate-400">
                Competência
              </span>
              <input
                type="month"
                value={month}
                onChange={(event) =>
                  setMonth(event.target.value)
                }
                className="bg-transparent text-sm font-black outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]"
            >
              Atualizar
            </button>
            <Link
              href="/admin"
              className="rounded-2xl bg-[#071b3a] px-4 py-3 text-xs font-black text-white"
            >
              Voltar ao controle
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] px-3 py-5 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-xl sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-emerald-200/70">
              Visão financeira owner-only
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.06em] sm:text-5xl">
              Quanto entrou, quanto saiu e quanto realmente ficou.
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-white/55">
              Assinaturas e taxa do Orçaly no marketplace formam a receita da plataforma. O valor total vendido pelos lojistas aparece como GMV e não é misturado ao faturamento do Orçaly.
            </p>
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {notes.netCashIsPartial ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
            O líquido deste período é parcial: existem assinaturas cujo payload não informa a tarifa do processador de forma conciliável. O painel não inventa essa taxa.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Receita bruta Orçaly"
            value={money(metrics.platformGrossRevenue)}
            detail={`${money(metrics.subscriptionGross)} em assinaturas + ${money(metrics.marketplacePlatformRevenue)} em taxas do marketplace`}
            delta={comparison.grossRevenuePercent}
          />
          <Metric
            label="Saídas conhecidas"
            value={money(metrics.knownCashOut)}
            detail={`${money(metrics.subscriptionProviderFee)} de taxas MP nas assinaturas + ${money(metrics.affiliatePayoutsPaid)} em comissões pagas`}
          />
          <Metric
            label="Líquido de caixa"
            value={money(metrics.netCash)}
            detail={`Margem de ${Number(metrics.marginPercent || 0).toLocaleString('pt-BR')}% sobre a receita bruta`}
            delta={comparison.netCashPercent}
            emphasis
          />
          <Metric
            label="Compromissos atuais"
            value={money(
              Number(obligations.pendingPayouts || 0) +
                Number(
                  obligations.outstandingAffiliateCommissions ||
                    0,
                ),
            )}
            detail={`${money(obligations.pendingPayouts)} em repasses + ${money(obligations.outstandingAffiliateCommissions)} em comissões ainda não liquidadas`}
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-[1.8rem] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Receita da plataforma
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Assinaturas
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f8faff] p-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  Bruto
                </p>
                <p className="mt-2 text-xl font-black">
                  {money(metrics.subscriptionGross)}
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-[9px] font-black uppercase text-red-400">
                  Taxa Mercado Pago
                </p>
                <p className="mt-2 text-xl font-black text-red-700">
                  {money(
                    metrics.subscriptionProviderFee,
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[9px] font-black uppercase text-emerald-500">
                  Líquido conhecido
                </p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {money(
                    metrics.subscriptionNetKnown,
                  )}
                </p>
              </div>
            </div>

            <Delta
              value={
                comparison.subscriptionGrossPercent
              }
              suffix="de receita de assinaturas vs. mês anterior"
            />
          </section>

          <section className="rounded-[1.8rem] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Marketplace
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Fluxo das vendas
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f8faff] p-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  GMV vendido
                </p>
                <p className="mt-2 text-xl font-black">
                  {money(metrics.marketplaceGmv)}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-[9px] font-black uppercase text-blue-400">
                  Receita Orçaly
                </p>
                <p className="mt-2 text-xl font-black text-[#05245c]">
                  {money(
                    metrics.marketplacePlatformRevenue,
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-[9px] font-black uppercase text-red-400">
                  Taxa MP do fluxo
                </p>
                <p className="mt-2 text-xl font-black text-red-700">
                  {money(
                    metrics.marketplaceProviderFee,
                  )}
                </p>
                <p className="mt-1 text-[10px] font-bold text-red-500">
                  custo do processamento do vendedor
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[9px] font-black uppercase text-emerald-500">
                  Líquido aos lojistas
                </p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {money(
                    metrics.marketplaceSellerNet,
                  )}
                </p>
              </div>
            </div>

            <Delta
              value={comparison.marketplaceGmvPercent}
              suffix="de GMV vs. mês anterior"
            />

            {Number(
              metrics.marketplacePlatformFeePending || 0,
            ) > 0 ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
                {money(
                  metrics.marketplacePlatformFeePending,
                )}{' '}
                de taxa da plataforma está em pagamentos pagos sem split confirmado e não entrou na receita.
              </p>
            ) : null}
          </section>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-[1.8rem] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Movimento diário
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Entrada e líquido por dia
            </h2>

            <div className="mt-5 grid gap-3">
              {daily.map((row: Json) => {
                const revenue =
                  Number(row.subscriptions || 0) +
                  Number(row.marketplaceRevenue || 0)
                const width = Math.max(
                  3,
                  Math.min(
                    100,
                    (Math.abs(revenue) / maxDaily) *
                      100,
                  ),
                )

                return (
                  <div
                    key={row.day}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black">
                        {String(row.day)
                          .split('-')
                          .reverse()
                          .join('/')}
                      </p>
                      <div className="text-right">
                        <p className="text-sm font-black">
                          {money(revenue)} entrada
                        </p>
                        <p
                          className={`text-xs font-black ${
                            Number(row.net || 0) >= 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {money(row.net)} líquido
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#05245c]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-slate-400">
                      Taxas: {money(row.providerFees)} · repasses:{' '}
                      {money(row.payouts)}
                    </p>
                  </div>
                )
              })}

              {!daily.length ? (
                <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-black text-slate-400">
                  Nenhuma movimentação conciliada neste mês.
                </p>
              ) : null}
            </div>
          </section>

          <aside className="h-fit rounded-[1.8rem] bg-white p-5 shadow-sm xl:sticky xl:top-24">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Resultado
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Caixa x competência
            </h2>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase text-emerald-500">
                  Líquido de caixa
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-800">
                  {money(metrics.netCash)}
                </p>
                <p className="mt-2 text-xs font-bold leading-5 text-emerald-700/70">
                  Deduz taxas MP de assinatura e comissões que efetivamente foram pagas no mês.
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase text-blue-400">
                  Após comissões geradas
                </p>
                <p className="mt-2 text-2xl font-black text-[#05245c]">
                  {money(
                    metrics.economicNetAfterGeneratedCommissions,
                  )}
                </p>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                  Considera como custo as comissões geradas no período, mesmo que ainda não tenham saído da conta.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 p-4">
                <p className="text-[10px] font-black uppercase text-amber-500">
                  Comissões geradas
                </p>
                <p className="mt-2 text-2xl font-black">
                  {money(
                    metrics.affiliateCommissionGenerated,
                  )}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">
              Despesas gerais da própria Orçaly, como infraestrutura, anúncios, domínio ou serviços externos, ainda não são somadas porque não existe hoje um livro-caixa administrativo da plataforma no banco.
            </p>
          </aside>
        </div>

        <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Conciliação
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Assinaturas recebidas
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Assinante</th>
                  <th className="px-4 py-4">Plano</th>
                  <th className="px-4 py-4">Bruto</th>
                  <th className="px-4 py-4">Taxa MP</th>
                  <th className="px-4 py-4">Líquido</th>
                  <th className="px-4 py-4">Conciliação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((row: Json) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 font-bold text-slate-500">
                      {dateBR(row.occurredAt)}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {row.company}
                    </td>
                    <td className="px-4 py-4 font-bold">
                      {row.plan}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {money(row.gross)}
                    </td>
                    <td className="px-4 py-4 font-bold text-red-600">
                      {money(row.providerFee)}
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-700">
                      {money(row.net)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          row.feeReconciled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {row.feeReconciled
                          ? 'Conciliada'
                          : 'Taxa pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Conciliação
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Vendas do marketplace
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Empresa</th>
                  <th className="px-4 py-4">GMV</th>
                  <th className="px-4 py-4">Taxa MP</th>
                  <th className="px-4 py-4">Orçaly</th>
                  <th className="px-4 py-4">Lojista</th>
                  <th className="px-4 py-4">Split</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketplace.map((row: Json) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 font-bold text-slate-500">
                      {dateBR(row.occurredAt)}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {row.company}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {money(row.gross)}
                    </td>
                    <td className="px-4 py-4 font-bold text-red-600">
                      {money(row.providerFee)}
                    </td>
                    <td className="px-4 py-4 font-black text-[#05245c]">
                      {money(row.platformFee)}
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-700">
                      {money(row.sellerNet)}
                    </td>
                    <td className="px-4 py-4 font-bold">
                      {row.splitStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Saídas
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Comissões pagas aos indicadores
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#f8faff] text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Indicador</th>
                  <th className="px-4 py-4">Valor</th>
                  <th className="px-4 py-4">Provider</th>
                  <th className="px-4 py-4">Referência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((row: Json) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 font-bold text-slate-500">
                      {dateBR(row.occurredAt)}
                    </td>
                    <td className="px-4 py-4 font-black">
                      {row.partner}
                    </td>
                    <td className="px-4 py-4 font-black text-red-700">
                      - {money(row.amount)}
                    </td>
                    <td className="px-4 py-4 font-bold">
                      {row.provider}
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-400">
                      {row.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
