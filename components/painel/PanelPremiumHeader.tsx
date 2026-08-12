'use client'

import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
  catalogo: 'Catalogo',
  clientes: 'Clientes',
  crm: 'CRM',
  'follow-up': 'Follow-up',
  propostas: 'Propostas',
  cupons: 'Cupons',
  financeiro: 'Financeiro',
  pagamentos: 'Pagamentos',
  entregas: 'Entregas',
  'taxas-entrega': 'Taxas de entrega',
  horarios: 'Horarios',
  site: 'Minha Vitrine',
  configuracoes: 'Configuracoes',
  assinatura: 'Assinatura',
  agenda: 'Agenda',
  estoque: 'Estoque',
  relatorios: 'Relatorios',
  profissionais: 'Profissionais',
  veiculos: 'Veiculos',
  aparelhos: 'Aparelhos',
  eventos: 'Eventos',
  contratos: 'Contratos',
  solicitacoes: 'Solicitacoes',
  tarefas: 'Tarefas',
  whatsapp: 'WhatsApp',
}

const pageDescriptions: Record<string, string> = {
  '/painel': 'Edite a vitrine publica, o catálogo e a experiência que seus clientes acessam.',
  '/painel/inicio': 'Acompanhe a operação e acesse rapidamente as áreas mais importantes do negócio.',
  '/painel/pedidos': 'Organize pedidos, prioridades, clientes e mudancas de status.',
  '/painel/produtos': 'Gerencie produtos, servicos, precos, imagens e disponibilidade.',
  '/painel/catalogo': 'Controle como seus produtos e servicos aparecem para o cliente.',
  '/painel/clientes': 'Centralize contatos, historico e oportunidades comerciais.',
  '/painel/crm': 'Acompanhe oportunidades e avance cada negociacao com clareza.',
  '/painel/follow-up': 'Mantenha retornos e contatos importantes sob controle.',
  '/painel/propostas': 'Crie, acompanhe e organize propostas comerciais.',
  '/painel/cupons': 'Gerencie campanhas e beneficios sem perder margem.',
  '/painel/financeiro': 'Acompanhe entradas, saidas, vencimentos e saldo operacional.',
  '/painel/pagamentos': 'Veja recebimentos, taxas, descontos e valores liquidos.',
  '/painel/entregas': 'Monitore a operacao de entrega do preparo ate a conclusao.',
  '/painel/taxas-entrega': 'Defina regioes, valores, prazos e pedidos minimos.',
  '/painel/horarios': 'Configure os horarios reais de atendimento da empresa.',
  '/painel/site': 'Edite site, catálogo, cardápio, identidade e publicação em uma única vitrine.',
  '/painel/configuracoes': 'Ajuste dados, preferencias e identidade da empresa.',
  '/painel/assinatura': 'Acompanhe plano, periodo de acesso, cobranca e recursos contratados.',
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
    graphic: 'Grafica',
    grafica: 'Grafica',
    custom_products: 'Personalizados',
    auto: 'Auto e oficina',
    oficina: 'Auto e oficina',
    automotive: 'Auto e oficina',
    technical_assistance: 'Assistencia tecnica',
    assistencia: 'Assistencia tecnica',
    beauty: 'Beauty',
    barber: 'Barbearia',
    barbearia: 'Barbearia',
    events: 'Eventos',
    eventos: 'Eventos',
    store: 'Loja',
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
  const description = pageDescriptions[pathname] || 'Gerencie esta area com clareza, contexto e menos ruido visual.'
  const publicSlug = company.subdomain_slug || company.slug || ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
  const publicUrl = publicSlug ? `https://${publicSlug}.${rootDomain}` : ''
  const parts = pathname.split('/').filter(Boolean).slice(1)

  async function logout() {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <header className="panel-adaptive-header">
      <div className="panel-adaptive-header-copy min-w-0">
        <nav className="panel-adaptive-breadcrumb" aria-label="Navegacao estrutural">
          <Link href="/painel/site">Minha Vitrine</Link>
          {parts.map((part, index) => (
            <span key={`${part}-${index}`}>
              <span aria-hidden="true">/</span>
              <span>{routeLabels[part] || part.replace(/-/g, ' ')}</span>
            </span>
          ))}
        </nav>

        <div className="panel-adaptive-title-row">
          <div className="min-w-0">
            <span className="panel-adaptive-kicker">Central de gestao</span>
            <h1>{title}</h1>
          </div>
          <span className="panel-adaptive-segment-badge">
            {normalizeSegment(company.business_type || company.site_template)}
          </span>
          {company.is_founder === true &&
          typeof company.founder_number === 'number' ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
              Founder #{String(company.founder_number).padStart(2, '0')}
            </span>
          ) : null}
        </div>

        <p>{description}</p>
      </div>

      <div className="panel-adaptive-header-actions">
        <div className="panel-adaptive-company-card" title={company.nome || 'Empresa Orcaly'}>
          {company.logo_url ? (
            <span className="panel-adaptive-company-logo">
              <img src={company.logo_url} alt="" />
            </span>
          ) : (
            <span className="panel-adaptive-company-logo panel-adaptive-company-initial" aria-hidden="true">
              {(company.nome || 'O').slice(0, 1)}
            </span>
          )}

          <span className="min-w-0">
            <strong>{company.nome || 'Empresa Orcaly'}</strong>
            <small>{normalizePlan(company.assinatura_plano || company.plano)}</small>
          </span>
        </div>

        {publicUrl ? (
          <Link href={publicUrl} target="_blank" rel="noreferrer" className="panel-adaptive-open-site">
            Abrir site
            <span aria-hidden="true">&#8599;</span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex min-h-[2.9rem] items-center justify-center rounded-[0.95rem] border border-red-100 bg-white px-4 py-3 text-xs font-black text-red-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-50"
          aria-label="Sair da conta"
          title="Sair da conta"
        >
          Sair
        </button>
      </div>
    </header>
  )
}