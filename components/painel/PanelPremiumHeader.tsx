'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import styles from './PanelChromeV3.module.css'

export type PanelPremiumCompany = {
  id?: string | null
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
  assinatura_status?: string | null
  is_founder?: boolean | null
  founder_number?: number | null
  founder_price_cents?: number | null
  founder_trial_ends_at?: string | null
  founder_price_ends_at?: string | null
  founder_welcome_seen_at?: string | null
}

const routeLabels: Record<string, string> = {
  painel: 'Minha Vitrine',
  inicio: 'Visão geral',
  pedidos: 'Pedidos',
  produtos: 'Produtos',
  catalogo: 'Catálogo',
  clientes: 'Clientes',
  crm: 'CRM',
  'follow-up': 'Follow-up',
  propostas: 'Propostas',
  cupons: 'Cupons',
  financeiro: 'Financeiro',
  pagamentos: 'Pagamentos',
  entregas: 'Entregas',
  'taxas-entrega': 'Taxas de entrega',
  horarios: 'Horários',
  site: 'Minha Vitrine',
  configuracoes: 'Configurações',
  assinatura: 'Assinatura',
  agenda: 'Agenda',
  estoque: 'Estoque',
  relatorios: 'Relatórios',
  profissionais: 'Profissionais',
  veiculos: 'Veículos',
  aparelhos: 'Aparelhos',
  eventos: 'Eventos',
  contratos: 'Contratos',
  solicitacoes: 'Solicitações',
  tarefas: 'Tarefas',
  whatsapp: 'WhatsApp',
}

const pageDescriptions: Record<string, string> = {
  '/painel': 'Edite a vitrine pública, o catálogo e a experiência que seus clientes acessam.',
  '/painel/inicio': 'Acompanhe a operação e acesse rapidamente as áreas mais importantes do negócio.',
  '/painel/pedidos': 'Organize pedidos, prioridades, clientes e mudanças de status.',
  '/painel/produtos': 'Gerencie produtos, serviços, preços, imagens e disponibilidade.',
  '/painel/catalogo': 'Controle como seus produtos e serviços aparecem para o cliente.',
  '/painel/clientes': 'Centralize contatos, histórico e oportunidades comerciais.',
  '/painel/crm': 'Acompanhe oportunidades e avance cada negociação com clareza.',
  '/painel/follow-up': 'Mantenha retornos e contatos importantes sob controle.',
  '/painel/propostas': 'Crie, acompanhe e organize propostas comerciais.',
  '/painel/cupons': 'Gerencie campanhas e benefícios sem perder margem.',
  '/painel/financeiro': 'Acompanhe entradas, saídas, vencimentos e saldo operacional.',
  '/painel/pagamentos': 'Veja recebimentos, taxas, descontos e valores líquidos.',
  '/painel/entregas': 'Monitore a operação de entrega do preparo até a conclusão.',
  '/painel/taxas-entrega': 'Defina regiões, valores, prazos e pedidos mínimos.',
  '/painel/horarios': 'Configure os horários reais de atendimento da empresa.',
  '/painel/site': 'Edite site, catálogo, cardápio, identidade e publicação em uma única vitrine.',
  '/painel/configuracoes': 'Ajuste dados, preferências e identidade da empresa.',
  '/painel/assinatura': 'Acompanhe plano, período de acesso, cobrança e recursos contratados.',
}

function normalizePlan(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'basico' || normalized === 'essencial') return 'Essencial'
  if (normalized === 'intermediario' || normalized === 'profissional') return 'Profissional'
  if (normalized === 'premium') return 'Premium'
  return value || 'Plano ativo'
}

function normalizeSegment(value?: string | null) {
  const normalized = String(value || 'services').toLowerCase()
  const labels: Record<string, string> = {
    food: 'Food',
    restaurante: 'Food',
    lanchonete: 'Food',
    delivery: 'Food',
    graphic: 'Gráfica',
    grafica: 'Gráfica',
    custom_products: 'Personalizados',
    auto: 'Auto e oficina',
    oficina: 'Auto e oficina',
    automotive: 'Auto e oficina',
    technical_assistance: 'Assistência técnica',
    assistencia: 'Assistência técnica',
    beauty: 'Beauty',
    barber: 'Barbearia',
    barbearia: 'Barbearia',
    events: 'Eventos',
    eventos: 'Eventos',
    store: 'Loja',
    loja: 'Loja',
    retail: 'Loja',
    services: 'Serviços',
    servicos: 'Serviços',
  }
  return labels[normalized] || 'Operação'
}

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || 'painel'
  return routeLabels[last] || last.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function HeaderIcon({ name }: { name: 'external' | 'logout' }) {
  if (name === 'logout') {
    return (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 5H5v14h5" />
        <path d="M13 8l4 4-4 4M17 12H9" />
      </svg>
    )
  }

  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5h5v5M19 5l-8 8" />
      <path d="M19 13.5V19H5V5h5.5" />
    </svg>
  )
}

export default function PanelPremiumHeader({
  company,
  pathname,
}: {
  company: PanelPremiumCompany
  pathname: string
}) {
  const title = titleFromPath(pathname)
  const description = pageDescriptions[pathname] || 'Gerencie esta área com clareza, contexto e menos ruído visual.'
  const publicSlug = company.subdomain_slug || company.slug || ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
  const publicUrl = publicSlug ? `https://${publicSlug}.${rootDomain}` : ''
  const parts = pathname.split('/').filter(Boolean).slice(1)

  async function logout() {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <header className={`panel-adaptive-header ${styles.header} ${styles.enter}`}>
      <div className="panel-adaptive-header-copy min-w-0">
        <nav className={`panel-adaptive-breadcrumb ${styles.breadcrumb}`} aria-label="Navegação estrutural">
          <Link href="/painel/site" className={styles.breadcrumbLink}>Minha Vitrine</Link>
          {parts.map((part, index) => (
            <span key={`${part}-${index}`}>
              <span aria-hidden="true">/</span>
              <span>{routeLabels[part] || part.replace(/-/g, ' ')}</span>
            </span>
          ))}
        </nav>

        <div className={`panel-adaptive-title-row ${styles.titleRow}`}>
          <div className="min-w-0">
            <span className={`panel-adaptive-kicker ${styles.kicker}`}>Central de gestão</span>
            <h1 className={styles.title}>{title}</h1>
          </div>

          <span className={`panel-adaptive-segment-badge ${styles.segmentBadge}`}>
            {normalizeSegment(company.business_type || company.site_template)}
          </span>

          {company.is_founder === true && typeof company.founder_number === 'number' ? (
            <span className={styles.founderBadge}>
              Founder #{String(company.founder_number).padStart(2, '0')}
            </span>
          ) : null}
        </div>

        <p className={styles.description}>{description}</p>
      </div>

      <div className={`panel-adaptive-header-actions ${styles.headerActions}`}>
        <div className={`panel-adaptive-company-card ${styles.companyCard}`} title={company.nome || 'Empresa Orçaly'}>
          {company.logo_url ? (
            <span className={`panel-adaptive-company-logo ${styles.companyLogo}`}>
              <img src={company.logo_url} alt="" />
            </span>
          ) : (
            <span className={`panel-adaptive-company-logo panel-adaptive-company-initial ${styles.companyLogo}`} aria-hidden="true">
              {(company.nome || 'O').slice(0, 1)}
            </span>
          )}

          <span className="min-w-0">
            <strong>{company.nome || 'Empresa Orçaly'}</strong>
            <small>{normalizePlan(company.assinatura_plano || company.plano)}</small>
          </span>
        </div>

        {publicUrl ? (
          <Link href={publicUrl} target="_blank" rel="noreferrer" className={`panel-adaptive-open-site ${styles.openSite}`}>
            <HeaderIcon name="external" />
            <span className={styles.openSiteLabel}>Abrir site</span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => void logout()}
          className={styles.logout}
          aria-label="Sair da conta"
          title="Sair da conta"
        >
          <HeaderIcon name="logout" />
          <span className={styles.logoutLabel}>Sair</span>
        </button>
      </div>
    </header>
  )
}
