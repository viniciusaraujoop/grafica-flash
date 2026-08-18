'use client'

// ORCALY_DASHBOARD_VISUAL_V3

/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getBusinessTypeConfig, normalizeBusinessType } from '@/lib/business-types'
import { getCompanyLocalSitePath, getCompanyPublicUrl } from '@/lib/company-url'
import { getOrderStatusVisual, isOrderPaid } from '@/lib/order-status'

type Company = {
  id: string
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_status?: string | null
  assinatura_plano?: string | null
  assinatura_expira_em?: string | null
  plano?: string | null
  site_publico_ativo?: boolean | null
  site_headline?: string | null
}

type OrderRow = {
  id: string
  nome?: string | null
  produto?: string | null
  status?: string | null
  payment_status?: string | null
  paid_at?: string | null
  valor_total?: number | string | null
  total?: number | string | null
  total_amount?: number | string | null
  preco_estimado?: number | string | null
  created_at?: string | null
}

type ProductRow = {
  id: string
  nome?: string | null
  ativo?: boolean | null
  available?: boolean | null
  imagem_url?: string | null
  image_urls?: string[] | null
  created_at?: string | null
}

type ProposalRow = {
  id: string
  status?: string | null
  valor_total?: number | string | null
  created_at?: string | null
}

type DashboardData = {
  orders: OrderRow[]
  products: ProductRow[]
  proposals: ProposalRow[]
}

type IconName =
  | 'revenue'
  | 'orders'
  | 'attention'
  | 'products'
  | 'storefront'
  | 'customers'
  | 'finance'
  | 'arrow'
  | 'external'
  | 'copy'
  | 'check'

const initialData: DashboardData = {
  orders: [],
  products: [],
  proposals: [],
}

function numberValue(value?: number | string | null) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusNormalized(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function statusContains(value: string | null | undefined, terms: string[]) {
  const normalized = statusNormalized(value)
  return terms.some((term) => normalized.includes(term))
}

function isPending(value?: string | null) {
  return statusContains(value, ['recebido', 'pendente', 'aguardando', 'analise', 'novo'])
}

function isProgress(value?: string | null) {
  return statusContains(value, ['andamento', 'preparo', 'producao', 'execucao', 'manutencao', 'separacao'])
}

function publicSlug(company: Company | null) {
  return company?.subdomain_slug || company?.slug || ''
}

function publicUrl(company: Company | null) {
  return getCompanyPublicUrl(publicSlug(company))
}

function localSitePath(company: Company | null) {
  return getCompanyLocalSitePath(publicSlug(company))
}

function productHasImage(product: ProductRow) {
  return Boolean(
    product.imagem_url ||
      (Array.isArray(product.image_urls) && product.image_urls.some(Boolean)),
  )
}

async function loadOrders(companyId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, nome, produto, status, payment_status, paid_at, valor_total, total, total_amount, preco_estimado, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(120)

  if (error) return []
  return (data || []) as OrderRow[]
}

async function loadProducts(companyId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id, nome, ativo, available, imagem_url, image_urls, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return []
  return (data || []) as ProductRow[]
}

async function loadProposals(companyId: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, status, valor_total, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(120)

  if (error) return []
  return (data || []) as ProposalRow[]
}

function DashboardIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName
  className?: string
}) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (name === 'revenue') {
    return (
      <svg {...common}>
        <path d="M5 7.5h11.5a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5h10" />
        <path d="M12 4v16" />
      </svg>
    )
  }

  if (name === 'orders') {
    return (
      <svg {...common}>
        <path d="M7 3.75h10v16.5H7z" />
        <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
      </svg>
    )
  }

  if (name === 'attention') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v5.25M12 16.4h.01" />
      </svg>
    )
  }

  if (name === 'products') {
    return (
      <svg {...common}>
        <path d="m4.5 8 7.5-4 7.5 4-7.5 4z" />
        <path d="M4.5 8v8l7.5 4 7.5-4V8M12 12v8" />
      </svg>
    )
  }

  if (name === 'storefront') {
    return (
      <svg {...common}>
        <path d="M4 10.5v9h16v-9" />
        <path d="M3 10.5 5.4 5h13.2l2.4 5.5" />
        <path d="M3 10.5c0 1.4 1 2.5 2.3 2.5s2.4-1.1 2.4-2.5c0 1.4 1 2.5 2.3 2.5s2.4-1.1 2.4-2.5c0 1.4 1 2.5 2.3 2.5s2.4-1.1 2.4-2.5c0 1.4 1 2.5 2.3 2.5s2.4-1.1 2.4-2.5" />
      </svg>
    )
  }

  if (name === 'customers') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 19c.6-3 2.4-4.7 5.5-4.7s4.9 1.7 5.5 4.7M15.5 6.5a2.7 2.7 0 0 1 0 5.2M16.2 14.4c2.4.4 3.8 1.9 4.3 4.6" />
      </svg>
    )
  }

  if (name === 'finance') {
    return (
      <svg {...common}>
        <path d="M4 7.5h16v10H4z" />
        <path d="M8 7.5v-2h8v2M7 12h2M15 12h2" />
        <circle cx="12" cy="12.5" r="2.2" />
      </svg>
    )
  }

  if (name === 'external') {
    return (
      <svg {...common}>
        <path d="M14 5h5v5M19 5l-8 8" />
        <path d="M19 13.5V19H5V5h5.5" />
      </svg>
    )
  }

  if (name === 'copy') {
    return (
      <svg {...common}>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5H5v11h3" />
      </svg>
    )
  }

  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="m5.5 12 4 4 9-9" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function enterStyle(delay: number): CSSProperties {
  return { animationDelay: `${delay}ms` }
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
  delay = 0,
}: {
  label: string
  value: string | number
  detail: string
  icon: IconName
  tone?: 'blue' | 'green' | 'amber' | 'purple'
  delay?: number
}) {
  const styles = {
    blue: {
      icon: 'bg-blue-50 text-blue-700 ring-blue-100',
      accent: 'from-blue-500 to-cyan-400',
    },
    green: {
      icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      accent: 'from-emerald-500 to-teal-400',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-700 ring-amber-100',
      accent: 'from-amber-500 to-orange-400',
    },
    purple: {
      icon: 'bg-violet-50 text-violet-700 ring-violet-100',
      accent: 'from-violet-500 to-fuchsia-400',
    },
  }

  return (
    <article
      style={enterStyle(delay)}
      className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white p-4 shadow-[0_10px_28px_rgba(15,42,77,0.055)] transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,42,77,0.1)] sm:rounded-[1.55rem] sm:p-5 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
    >
      <span
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${styles[tone].accent} opacity-70 transition-opacity group-hover:opacity-100`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.11em] text-slate-400 sm:text-xs">
            {label}
          </p>
          <p className="mt-2 break-words text-[clamp(1.35rem,5.4vw,2rem)] font-black leading-none tracking-[-0.055em] text-[#10213d]">
            {value}
          </p>
          <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-4 text-slate-400 sm:text-xs">
            {detail}
          </p>
        </div>

        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 transition duration-200 group-hover:scale-105 sm:h-11 sm:w-11 sm:rounded-2xl ${styles[tone].icon}`}
        >
          <DashboardIcon name={icon} className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </span>
      </div>
    </article>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  href,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: string
  href?: string
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#356cae]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`${eyebrow ? 'mt-1' : ''} text-lg font-black tracking-[-0.035em] text-[#10213d] sm:text-xl`}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs font-bold leading-5 text-slate-400 sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>

      {action && href ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-black text-[#174e93] transition hover:bg-blue-50 sm:text-sm"
        >
          {action}
          <DashboardIcon
            name="arrow"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  )
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) {
    return (
      <div className="mt-4 grid min-h-48 place-items-center rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center sm:min-h-56">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#356cae] shadow-sm ring-1 ring-slate-200">
            <DashboardIcon name="orders" className="h-6 w-6" />
          </span>
          <p className="mt-3 font-black text-[#10213d]">Nenhum pedido ainda</p>
          <p className="mt-1 text-sm font-bold text-slate-400">
            Os pedidos recebidos aparecerão aqui.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 grid gap-2">
      {orders.slice(0, 6).map((order) => {
        const visual = getOrderStatusVisual(order.status, order.payment_status, order.paid_at)
        const value = numberValue(order.total_amount || order.total || order.valor_total || order.preco_estimado)

        return (
          <Link
            key={order.id}
            href={`/painel/pedidos/${order.id}`}
            className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-xl border border-transparent bg-slate-50/65 px-3.5 py-3.5 transition duration-200 hover:border-blue-100 hover:bg-white hover:shadow-[0_8px_22px_rgba(15,42,77,0.06)] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#10213d] transition-colors group-hover:text-[#174e93] sm:text-base">
                {order.nome || 'Pedido recebido'}
              </p>
              <p className="mt-1 truncate text-xs font-bold text-slate-400 sm:text-sm">
                {order.produto || 'Solicitação'} · {formatDate(order.created_at)}
              </p>
            </div>

            <span
              className={`w-fit self-start rounded-full px-2.5 py-1 text-[10px] font-black ring-1 sm:self-center sm:px-3 sm:text-xs ${visual.className}`}
            >
              {visual.label}
            </span>

            <p className="col-span-2 text-sm font-black text-[#10213d] sm:col-span-1 sm:min-w-[92px] sm:text-right">
              {value > 0 ? money(value) : 'A definir'}
            </p>
          </Link>
        )
      })}
    </div>
  )
}

function ShortcutCard({
  href,
  icon,
  label,
  detail,
}: {
  href: string
  icon: IconName
  label: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[78px] min-w-0 items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-[0_10px_24px_rgba(15,42,77,0.06)]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#315f99] transition duration-200 group-hover:bg-white group-hover:text-[#174e93] group-hover:shadow-sm">
        <DashboardIcon name={icon} className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm text-[#10213d]">{label}</strong>
        <small className="mt-0.5 hidden truncate font-bold text-slate-400 sm:block xl:hidden 2xl:block">
          {detail}
        </small>
      </span>

      <DashboardIcon
        name="arrow"
        className="h-4 w-4 shrink-0 text-slate-300 transition duration-200 group-hover:translate-x-0.5 group-hover:text-[#174e93]"
      />
    </Link>
  )
}

export default function PainelInicioPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')

  const businessType = normalizeBusinessType(company?.business_type || company?.site_template)
  const businessConfig = useMemo(() => getBusinessTypeConfig(businessType), [businessType])

  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()

    const todayOrders = data.orders.filter((order) => {
      const created = new Date(order.created_at || '').getTime()
      return Number.isFinite(created) && created >= todayTime
    })

    // ORCALY_PAID_REVENUE_V1
    const paidTodayOrders = data.orders.filter((order) => {
      if (!isOrderPaid(order.payment_status, order.paid_at)) return false

      const paidDate = new Date(order.paid_at || order.created_at || '').getTime()
      return Number.isFinite(paidDate) && paidDate >= todayTime
    })

    const todayRevenue = paidTodayOrders.reduce(
      (sum, order) =>
        sum +
        numberValue(
          order.total_amount ||
            order.total ||
            order.valor_total ||
            order.preco_estimado,
        ),
      0,
    )

    const activeProducts = data.products.filter(
      (product) => product.ativo !== false && product.available !== false,
    ).length

    const pendingOrders = data.orders.filter((order) => isPending(order.status)).length
    const progressOrders = data.orders.filter((order) => isProgress(order.status)).length
    const pendingProposals = data.proposals.filter((proposal) => isPending(proposal.status)).length
    const productsWithoutImage = data.products.filter((product) => !productHasImage(product)).length

    return {
      todayOrders: todayOrders.length,
      paidTodayOrders: paidTodayOrders.length,
      todayRevenue,
      activeProducts,
      pendingOrders,
      progressOrders,
      pendingProposals,
      productsWithoutImage,
    }
  }, [data])

  const attentionItems = useMemo(
    () =>
      [
        metrics.pendingOrders > 0
          ? {
              label: `${metrics.pendingOrders} pedido(s) aguardando`,
              href: '/painel/pedidos',
              tone: 'bg-amber-50 text-amber-800 ring-amber-100',
              iconTone: 'bg-amber-100 text-amber-700',
            }
          : null,
        metrics.pendingProposals > 0
          ? {
              label: `${metrics.pendingProposals} proposta(s) pendente(s)`,
              href: '/painel/propostas',
              tone: 'bg-violet-50 text-violet-800 ring-violet-100',
              iconTone: 'bg-violet-100 text-violet-700',
            }
          : null,
        metrics.productsWithoutImage > 0
          ? {
              label: `${metrics.productsWithoutImage} item(ns) sem foto`,
              href: '/painel/produtos',
              tone: 'bg-blue-50 text-blue-800 ring-blue-100',
              iconTone: 'bg-blue-100 text-blue-700',
            }
          : null,
        !company?.logo_url
          ? {
              label: 'Adicionar logo da empresa',
              href: '/painel/site',
              tone: 'bg-slate-100 text-slate-700 ring-slate-200',
              iconTone: 'bg-white text-slate-600',
            }
          : null,
      ].filter(Boolean) as Array<{
        label: string
        href: string
        tone: string
        iconTone: string
      }>,
    [company?.logo_url, metrics],
  )

  const siteLink = publicUrl(company)
  const sitePath = localSitePath(company)

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/company/current', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.company?.id) {
        throw new Error(payload.error || 'Não foi possível carregar a empresa.')
      }

      const loadedCompany = payload.company as Company
      setCompany(loadedCompany)

      const [orders, products, proposals] = await Promise.all([
        loadOrders(loadedCompany.id),
        loadProducts(loadedCompany.id),
        loadProposals(loadedCompany.id),
      ])

      setData({ orders, products, proposals })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a visão geral.')
    }

    setLoading(false)
  }

  async function copySiteLink() {
    if (!siteLink) {
      setCopyMessage('Configure o link da sua vitrine.')
      return
    }

    try {
      await navigator.clipboard.writeText(siteLink)
      setCopyMessage('Link copiado.')
    } catch {
      setCopyMessage(siteLink)
    }

    window.setTimeout(() => setCopyMessage(''), 2200)
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  if (loading) {
    return (
      <main className="min-h-[60vh]">
        <div className="grid gap-4 motion-safe:animate-[orcaly-panel-page-enter_280ms_ease-out_both]">
          <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,42,77,0.06)] sm:p-6">
            <div className="animate-pulse">
              <div className="h-4 w-28 rounded-full bg-slate-100" />
              <div className="mt-3 h-8 w-56 max-w-[70%] rounded-xl bg-slate-100" />
              <div className="mt-5 h-11 w-full rounded-xl bg-slate-100 sm:w-80" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="h-3 w-20 rounded-full bg-slate-100" />
                <div className="mt-4 h-7 w-24 rounded-lg bg-slate-100" />
                <div className="mt-3 h-3 w-16 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
            <div className="h-80 animate-pulse rounded-[1.6rem] border border-slate-200 bg-white shadow-sm" />
            <div className="h-80 animate-pulse rounded-[1.6rem] border border-slate-200 bg-white shadow-sm" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-[#10213d]">
      <section className="mx-auto max-w-[1440px] space-y-4 sm:space-y-5">
        <header
          style={enterStyle(0)}
          className="relative overflow-hidden rounded-[1.55rem] border border-[#1b4d8b]/20 bg-[linear-gradient(135deg,#071a3a_0%,#0a377f_52%,#1764ab_100%)] p-5 text-white shadow-[0_18px_52px_rgba(6,31,72,0.2)] sm:rounded-[1.8rem] sm:p-6 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
        >
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-300/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
              {company?.logo_url ? (
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-white/70 sm:h-16 sm:w-16 sm:rounded-[1.15rem]">
                  <img
                    src={company.logo_url}
                    alt={company.nome || 'Logo'}
                    className="max-h-[76%] max-w-[76%] object-contain"
                  />
                </span>
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-xl font-black text-white ring-1 ring-white/20 backdrop-blur sm:h-16 sm:w-16 sm:rounded-[1.15rem] sm:text-2xl">
                  {(company?.nome || 'O').slice(0, 1)}
                </span>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/75 sm:text-xs">
                    {businessConfig.label}
                  </p>
                  <span className="h-1 w-1 rounded-full bg-blue-200/40" aria-hidden="true" />
                  <p className="text-[10px] font-bold text-blue-100/65 sm:text-xs">
                    Visão geral
                  </p>
                </div>
                <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.045em] sm:text-3xl lg:text-[2rem]">
                  {company?.nome || 'Sua empresa'}
                </h1>
                <p className="mt-1 hidden text-sm font-semibold text-blue-100/70 sm:block">
                  Acompanhe o que merece atenção e acesse as ações mais usadas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:min-w-[430px]">
              <Link
                href="/painel/produtos"
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-[#0a377f] shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)] sm:col-span-1"
              >
                <DashboardIcon name="products" className="h-4 w-4" />
                Novo item
              </Link>

              <Link
                href="/painel/pedidos"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/15 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-white/15"
              >
                <DashboardIcon name="orders" className="h-4 w-4" />
                Ver pedidos
              </Link>

              <a
                href={publicSlug(company) ? sitePath : '/painel/site'}
                target={publicSlug(company) ? '_blank' : undefined}
                rel={publicSlug(company) ? 'noreferrer' : undefined}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white ring-1 ring-white/15 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-white/15"
              >
                <DashboardIcon name="external" className="h-4 w-4" />
                Abrir vitrine
              </a>
            </div>
          </div>

          {error ? (
            <div className="relative mt-5 rounded-xl bg-red-400/15 px-4 py-3 text-sm font-bold text-red-50 ring-1 ring-red-200/20 backdrop-blur">
              {error}
            </div>
          ) : null}
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricCard
            label="Faturamento hoje"
            value={money(metrics.todayRevenue)}
            detail={`${metrics.paidTodayOrders} pagamento(s) confirmado(s) hoje`}
            icon="revenue"
            tone="green"
            delay={45}
          />
          <MetricCard
            label="Pedidos hoje"
            value={metrics.todayOrders}
            detail={`${metrics.progressOrders} em andamento`}
            icon="orders"
            delay={90}
          />
          <MetricCard
            label="Aguardando ação"
            value={metrics.pendingOrders}
            detail="Pedidos pendentes"
            icon="attention"
            tone="amber"
            delay={135}
          />
          <MetricCard
            label="Itens ativos"
            value={metrics.activeProducts}
            detail={`${data.products.length} cadastrados`}
            icon="products"
            tone="purple"
            delay={180}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)] xl:gap-5">
          <article
            style={enterStyle(225)}
            className="rounded-[1.45rem] border border-slate-200/90 bg-white p-4 shadow-[0_12px_34px_rgba(15,42,77,0.055)] sm:rounded-[1.7rem] sm:p-6 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
          >
            <SectionHeader
              eyebrow="Operação"
              title="Pedidos recentes"
              description="Últimas solicitações recebidas pela empresa."
              action="Ver todos"
              href="/painel/pedidos"
            />
            <OrderList orders={data.orders} />
          </article>

          <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1 xl:gap-5">
            <article
              style={enterStyle(270)}
              className="rounded-[1.45rem] border border-slate-200/90 bg-white p-4 shadow-[0_12px_34px_rgba(15,42,77,0.055)] sm:rounded-[1.7rem] sm:p-5 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
            >
              <SectionHeader
                eyebrow="Prioridades"
                title="Atenção agora"
                description="Pendências que valem um clique primeiro."
              />

              {attentionItems.length ? (
                <div className="mt-4 grid gap-2.5">
                  {attentionItems.slice(0, 4).map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`group flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-black ring-1 transition duration-200 hover:-translate-y-0.5 hover:brightness-[0.98] ${item.tone}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.iconTone}`}>
                        <DashboardIcon name="attention" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      <DashboardIcon
                        name="arrow"
                        className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <DashboardIcon name="check" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-black text-emerald-800">Tudo em ordem</p>
                    <p className="mt-0.5 text-xs font-bold text-emerald-600">
                      Nenhuma pendência principal.
                    </p>
                  </div>
                </div>
              )}
            </article>

            <article
              style={enterStyle(315)}
              className="rounded-[1.45rem] border border-slate-200/90 bg-white p-4 shadow-[0_12px_34px_rgba(15,42,77,0.055)] sm:rounded-[1.7rem] sm:p-5 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
            >
              <SectionHeader
                eyebrow="Navegação"
                title="Atalhos"
                description="Acesso direto às áreas mais usadas."
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ShortcutCard href="/painel/site" icon="storefront" label="Minha Vitrine" detail="Editar e publicar" />
                <ShortcutCard href="/painel/produtos" icon="products" label="Produtos" detail="Itens, preços e estoque" />
                <ShortcutCard href="/painel/crm" icon="customers" label="Clientes" detail="Contatos e oportunidades" />
                <ShortcutCard href="/painel/financeiro" icon="finance" label="Financeiro" detail="Entradas e saídas" />
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)] lg:gap-5">
          <article
            style={enterStyle(360)}
            className="relative overflow-hidden rounded-[1.45rem] border border-[#174e93]/15 bg-[linear-gradient(135deg,#08244e_0%,#0b3b7e_58%,#1764ab_100%)] p-5 text-white shadow-[0_16px_40px_rgba(7,35,78,0.16)] sm:rounded-[1.7rem] sm:p-6 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
          >
            <div
              className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/60 sm:text-xs">
                  Sua vitrine
                </p>
                <p className="mt-2 truncate text-lg font-black tracking-[-0.025em] sm:text-xl">
                  {siteLink || 'Link ainda não configurado'}
                </p>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-blue-100/65">
                  {company?.site_headline || 'Edite produtos, visual e informações da empresa.'}
                </p>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2">
                <Link
                  href="/painel/site"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-[#0a377f] shadow-sm transition duration-200 hover:-translate-y-0.5"
                >
                  <DashboardIcon name="storefront" className="h-4 w-4" />
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={copySiteLink}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/15 transition duration-200 hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <DashboardIcon name="copy" className="h-4 w-4" />
                  Copiar
                </button>
              </div>
            </div>

            {copyMessage ? (
              <p
                aria-live="polite"
                className="relative mt-3 inline-flex rounded-full bg-cyan-200/10 px-3 py-1.5 text-xs font-black text-cyan-50 ring-1 ring-cyan-100/15 motion-safe:animate-[orcaly-panel-page-enter_180ms_ease-out_both]"
              >
                {copyMessage}
              </p>
            ) : null}
          </article>

          <article
            style={enterStyle(405)}
            className="rounded-[1.45rem] border border-slate-200/90 bg-white p-5 shadow-[0_12px_34px_rgba(15,42,77,0.055)] sm:rounded-[1.7rem] sm:p-6 motion-safe:animate-[orcaly-panel-page-enter_420ms_ease-out_both]"
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:text-xs">
                    Plano
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    {company?.assinatura_status || 'indefinido'}
                  </span>
                </div>

                <p className="mt-3 text-xl font-black tracking-[-0.035em] text-[#10213d]">
                  {company?.assinatura_plano || company?.plano || 'Plano ativo'}
                </p>
                <p className="mt-1.5 text-sm font-bold leading-5 text-slate-400">
                  Gerencie assinatura e informações do plano.
                </p>
              </div>

              <Link
                href="/painel/assinatura"
                className="group inline-flex min-h-11 items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-[#10213d] transition duration-200 hover:bg-blue-50 hover:text-[#174e93]"
              >
                Gerenciar assinatura
                <DashboardIcon
                  name="arrow"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
