'use client'

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { PanelBadge, PanelBreadcrumb } from '@/components/panel-ui'
import { getCompanyPublicUrl } from '@/lib/company-url'

export type PanelPremiumCompany = {
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
}

const routeLabels: Record<string, string> = {
  painel: 'Visao geral',
  pedidos: 'Pedidos',
  produtos: 'Produtos',
  catalogo: 'Catalogo',
  clientes: 'Clientes',
  crm: 'CRM',
  'follow-up': 'Follow-up',
  propostas: 'Propostas',
  cupons: 'Cupons',
  cupom: 'Cupons',
  financeiro: 'Financeiro',
  pagamentos: 'Pagamentos',
  entregas: 'Entregas',
  'taxas-entrega': 'Taxas de entrega',
  horarios: 'Horarios',
  site: 'Site',
  configuracoes: 'Configuracoes',
  assinatura: 'Assinatura',
  agenda: 'Agenda',
  estoque: 'Estoque',
  'ordens-servico': 'Ordens de servico',
  relatorios: 'Relatorios',
  profissionais: 'Profissionais',
  veiculos: 'Veiculos',
  aparelhos: 'Aparelhos',
  eventos: 'Eventos',
  contratos: 'Contratos',
  solicitacoes: 'Solicitacoes',
}

const pageDescriptions: Record<string, string> = {
  '/painel': 'Acompanhe resultados, pendencias e os proximos passos da operacao.',
  '/painel/pedidos': 'Organize pedidos, status e prioridades sem perder o contexto.',
  '/painel/produtos': 'Mantenha produtos, precos e disponibilidade sempre organizados.',
  '/painel/catalogo': 'Cuide da apresentacao comercial e do que seus clientes encontram.',
  '/painel/clientes': 'Centralize relacionamentos e historico comercial.',
  '/painel/financeiro': 'Acompanhe entradas, saidas e compromissos financeiros.',
  '/painel/pagamentos': 'Visualize recebimentos, taxas e valores liquidos.',
  '/painel/entregas': 'Acompanhe a operacao de entrega do inicio ao fim.',
  '/painel/site': 'Configure a presenca digital publica da empresa.',
  '/painel/configuracoes': 'Ajuste os dados e preferencias da empresa.',
}

function planLabel(value?: string | null) {
  if (value === 'basico') return 'Essencial'
  if (value === 'essencial') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano'
}

function segmentLabel(value?: string | null) {
  const normalized = String(value || 'services').toLowerCase()
  const labels: Record<string, string> = {
    food: 'Food',
    grafica: 'Grafica',
    graphic: 'Grafica',
    auto: 'Auto e oficina',
    automotive: 'Auto e oficina',
    assistance: 'Assistencia',
    assistencia: 'Assistencia',
    beauty: 'Beauty',
    eventos: 'Eventos',
    events: 'Eventos',
    loja: 'Loja',
    retail: 'Loja',
    services: 'Servicos',
    servicos: 'Servicos',
  }
  return labels[normalized] || 'Operacao'
}

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || 'painel'
  return routeLabels[last] || last.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export default function PanelPremiumHeader({
  company,
  pathname,
}: {
  company: PanelPremiumCompany
  pathname: string
}) {
  const title = titleFromPath(pathname)
  const description = pageDescriptions[pathname] || 'Gerencie esta area com clareza e sem perder o fluxo da operacao.'
  const publicSlug = company.subdomain_slug || company.slug || ''
  const publicUrl = publicSlug ? getCompanyPublicUrl(publicSlug) : ''
  const parts = pathname.split('/').filter(Boolean).slice(1)
  const breadcrumbItems = [
    { label: 'Painel', href: pathname === '/painel' ? undefined : '/painel' },
    ...parts.map((part, index) => ({
      label: routeLabels[part] || part.replace(/-/g, ' '),
      href: index === parts.length - 1 ? undefined : `/painel/${parts.slice(0, index + 1).join('/')}`,
    })),
  ]

  return (
    <header className="panel-premium-header">
      <div className="min-w-0 flex-1">
        <PanelBreadcrumb items={breadcrumbItems} />
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <h1>{title}</h1>
          <PanelBadge tone="blue">{segmentLabel(company.business_type || company.site_template)}</PanelBadge>
        </div>
        <p>{description}</p>
      </div>

      <div className="panel-premium-header-actions">
        <div className="panel-premium-company-pill" title={company.nome || 'Empresa Or\u00e7aly'}>
          {company.logo_url ? (
            <span className="panel-premium-company-logo">
              <img src={company.logo_url} alt="" />
            </span>
          ) : (
            <span className="panel-premium-company-logo panel-premium-company-initial" aria-hidden="true">
              {(company.nome || 'O').slice(0, 1)}
            </span>
          )}
          <span className="min-w-0">
            <strong>{company.nome || 'Empresa Or\u00e7aly'}</strong>
            <small>{planLabel(company.assinatura_plano || company.plano)}</small>
          </span>
        </div>

        {publicUrl ? (
          <Link href={publicUrl} target="_blank" rel="noreferrer" className="panel-premium-site-link">
            Abrir site
            <span aria-hidden="true">&#8599;</span>
          </Link>
        ) : null}
      </div>
    </header>
  )
}