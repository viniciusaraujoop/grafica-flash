'use client'

// ORCALY_DASHBOARD_COMPACT_V2

/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getBusinessTypeConfig, normalizeBusinessType } from '@/lib/business-types'
import { getCompanyLocalSitePath, getCompanyPublicUrl } from '@/lib/company-url'

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
  valor_total?: number | string | null
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

function statusVisual(value?: string | null) {
  if (statusContains(value, ['concluido', 'entregue', 'finalizado', 'pronto', 'atendido'])) {
    return {
      label: value || 'Concluído',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    }
  }

  if (isProgress(value)) {
    return {
      label: value || 'Em andamento',
      className: 'bg-blue-50 text-blue-700 ring-blue-100',
    }
  }

  if (statusContains(value, ['cancelado', 'reprovado'])) {
    return {
      label: value || 'Cancelado',
      className: 'bg-red-50 text-red-700 ring-red-100',
    }
  }

  return {
    label: value || 'Pendente',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
  }
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
    .select('id, nome, produto, status, valor_total, preco_estimado, created_at')
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

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
}: {
  label: string
  value: string | number
  detail: string
  icon: string
  tone?: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-violet-50 text-violet-700',
  }

  return (
    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#10213d]">{value}</p>
          <p className="mt-2 text-xs font-bold text-slate-400">{detail}</p>
        </div>

        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg ${styles[tone]}`}>
          {icon}
        </span>
      </div>
    </article>
  )
}

function SectionHeader({
  title,
  action,
  href,
}: {
  title: string
  action?: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-black tracking-[-0.035em] text-[#10213d]">{title}</h2>
      {action && href ? (
        <Link href={href} className="text-sm font-black text-[#05245c] hover:underline">
          {action}
        </Link>
      ) : null}
    </div>
  )
}

function OrderList({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) {
    return (
      <div className="grid min-h-56 place-items-center rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
        <div>
          <span className="text-3xl">📥</span>
          <p className="mt-3 font-black text-[#10213d]">Nenhum pedido ainda</p>
          <p className="mt-1 text-sm font-bold text-slate-400">Os pedidos recebidos aparecerão aqui.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 divide-y divide-slate-100">
      {orders.slice(0, 6).map((order) => {
        const visual = statusVisual(order.status)
        const value = numberValue(order.valor_total || order.preco_estimado)

        return (
          <Link
            key={order.id}
            href={`/painel/pedidos/${order.id}`}
            className="grid gap-3 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3"
          >
            <div className="min-w-0">
              <p className="truncate font-black text-[#10213d]">{order.nome || 'Pedido recebido'}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-400">
                {order.produto || 'Solicitação'} · {formatDate(order.created_at)}
              </p>
            </div>

            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${visual.className}`}>
              {visual.label}
            </span>

            <p className="font-black text-[#10213d]">{value > 0 ? money(value) : 'A definir'}</p>
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
  icon: string
  label: string
  detail: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg transition group-hover:bg-white">
        {icon}
      </span>

      <span className="min-w-0">
        <strong className="block truncate text-sm text-[#10213d]">{label}</strong>
        <small className="mt-0.5 block truncate font-bold text-slate-400">{detail}</small>
      </span>
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

    const todayRevenue = todayOrders.reduce(
      (sum, order) => sum + numberValue(order.valor_total || order.preco_estimado),
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
              tone: 'bg-amber-50 text-amber-700',
            }
          : null,
        metrics.pendingProposals > 0
          ? {
              label: `${metrics.pendingProposals} proposta(s) pendente(s)`,
              href: '/painel/propostas',
              tone: 'bg-violet-50 text-violet-700',
            }
          : null,
        metrics.productsWithoutImage > 0
          ? {
              label: `${metrics.productsWithoutImage} item(ns) sem foto`,
              href: '/painel/produtos',
              tone: 'bg-blue-50 text-blue-700',
            }
          : null,
        !company?.logo_url
          ? {
              label: 'Adicionar logo da empresa',
              href: '/painel/site',
              tone: 'bg-slate-100 text-slate-700',
            }
          : null,
      ].filter(Boolean) as Array<{ label: string; href: string; tone: string }>,
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
      <main className="grid min-h-[60vh] place-items-center">
        <div className="rounded-[1.8rem] border border-slate-200 bg-white px-10 py-8 text-center shadow-sm">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-10 w-auto" />
          <p className="mt-4 font-black text-[#10213d]">Carregando visão geral...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-[#10213d] sm:px-6">
      <section className="mx-auto max-w-[1440px] space-y-5">
        <header className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {company?.logo_url ? (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white">
                  <img
                    src={company.logo_url}
                    alt={company.nome || 'Logo'}
                    className="max-h-[76%] max-w-[76%] object-contain"
                  />
                </span>
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-xl font-black text-white">
                  {(company?.nome || 'O').slice(0, 1)}
                </span>
              )}

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {businessConfig.label}
                </p>
                <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  {company?.nome || 'Sua empresa'}
                </h1>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Link
                href="/painel/produtos"
                className="rounded-xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white transition hover:bg-[#031a43]"
              >
                Novo item
              </Link>
              <Link
                href="/painel/pedidos"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-[#10213d] transition hover:bg-slate-50"
              >
                Ver pedidos
              </Link>
              <a
                href={publicSlug(company) ? sitePath : '/painel/site'}
                target={publicSlug(company) ? '_blank' : undefined}
                rel={publicSlug(company) ? 'noreferrer' : undefined}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-[#10213d] transition hover:bg-slate-50"
              >
                Abrir vitrine
              </a>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Faturamento hoje"
            value={money(metrics.todayRevenue)}
            detail="Pedidos criados hoje"
            icon="R$"
            tone="green"
          />
          <MetricCard
            label="Pedidos hoje"
            value={metrics.todayOrders}
            detail={`${metrics.progressOrders} em andamento`}
            icon="📥"
          />
          <MetricCard
            label="Aguardando ação"
            value={metrics.pendingOrders}
            detail="Pedidos pendentes"
            icon="⏳"
            tone="amber"
          />
          <MetricCard
            label="Itens ativos"
            value={metrics.activeProducts}
            detail={`${data.products.length} cadastrados`}
            icon="📦"
            tone="purple"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeader title="Pedidos recentes" action="Ver todos" href="/painel/pedidos" />
            <OrderList orders={data.orders} />
          </article>

          <div className="grid content-start gap-5">
            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader title="Atenção agora" />

              {attentionItems.length ? (
                <div className="mt-4 grid gap-2">
                  {attentionItems.slice(0, 4).map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`rounded-xl px-4 py-3 text-sm font-black transition hover:brightness-95 ${item.tone}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-4">
                  <p className="font-black text-emerald-700">Tudo em ordem</p>
                  <p className="mt-1 text-sm font-bold text-emerald-600">Nenhuma pendência principal.</p>
                </div>
              )}
            </article>

            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <SectionHeader title="Atalhos" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <ShortcutCard href="/painel/site" icon="🌐" label="Minha Vitrine" detail="Editar e publicar" />
                <ShortcutCard href="/painel/produtos" icon="📦" label="Produtos" detail="Itens, preços e estoque" />
                <ShortcutCard href="/painel/crm" icon="👥" label="Clientes" detail="Contatos e oportunidades" />
                <ShortcutCard href="/painel/financeiro" icon="💰" label="Financeiro" detail="Entradas e saídas" />
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-[#05245c] p-5 text-white shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">Sua vitrine</p>
                <p className="mt-2 truncate text-xl font-black">{siteLink || 'Link ainda não configurado'}</p>
                <p className="mt-2 text-sm font-bold text-white/65">
                  {company?.site_headline || 'Edite produtos, visual e informações da empresa.'}
                </p>
              </div>

              <div className="grid shrink-0 gap-2 sm:grid-cols-2">
                <Link
                  href="/painel/site"
                  className="rounded-xl bg-white px-5 py-3 text-center text-sm font-black text-[#05245c]"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={copySiteLink}
                  className="rounded-xl bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Copiar link
                </button>
              </div>
            </div>

            {copyMessage ? <p className="mt-3 text-sm font-bold text-cyan-100">{copyMessage}</p> : null}
          </article>

          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Plano</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xl font-black text-[#10213d]">
                  {company?.assinatura_plano || company?.plano || 'Plano ativo'}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  Status: {company?.assinatura_status || 'indefinido'}
                </p>
              </div>

              <Link
                href="/painel/assinatura"
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-[#10213d]"
              >
                Gerenciar
              </Link>
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}
