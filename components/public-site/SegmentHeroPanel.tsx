'use client'

import type { PublicSiteCompany } from '@/components/public-site/PublicSiteRenderer'
import { normalizeCatalogBusinessType, type CatalogBusinessType } from '@/lib/catalog-labels'

type SegmentCopy = {
  eyebrow: string
  title: string
  text: string
  icon: string
  heroMetrics: string[]
  flow: string[]
  checkoutLabel: string
  supportLabel: string
}

const segmentCopy: Record<CatalogBusinessType, SegmentCopy> = {
  food: {
    eyebrow: 'Cardápio digital',
    title: 'Escolha, monte o carrinho e finalize pelo site.',
    text: 'Pedido com adicionais, cupom, entrega ou retirada, forma de pagamento e registro direto no painel da loja.',
    icon: '🍔',
    heroMetrics: ['Carrinho', 'Cupom', 'Entrega/retirada'],
    flow: ['Escolha itens', 'Aplique cupom', 'Finalize pedido'],
    checkoutLabel: 'Checkout de pedidos',
    supportLabel: 'WhatsApp como apoio',
  },
  store: {
    eyebrow: 'Vitrine de produtos',
    title: 'Produtos com carrinho, cupom e pedido estruturado.',
    text: 'O cliente escolhe produtos, informa dados, aplica cupom e envia o pedido para o painel sem depender só do WhatsApp.',
    icon: '🛍️',
    heroMetrics: ['Produtos', 'Pedido real', 'Pagamento'],
    flow: ['Adicionar produtos', 'Aplicar cupom', 'Enviar pedido'],
    checkoutLabel: 'Carrinho simples',
    supportLabel: 'Dúvidas no WhatsApp',
  },
  graphic: {
    eyebrow: 'Orçamento gráfico',
    title: 'Solicitações com medidas, quantidade e briefing claro.',
    text: 'Ideal para gráfica e personalizados: o cliente envia dados do material e o pedido vira orçamento no painel.',
    icon: '🎨',
    heroMetrics: ['Medidas', 'Quantidade', 'Proposta'],
    flow: ['Escolher item', 'Informar detalhes', 'Solicitar orçamento'],
    checkoutLabel: 'Orçamento estruturado',
    supportLabel: 'Arte e dúvidas no WhatsApp',
  },
  custom_products: {
    eyebrow: 'Personalizados',
    title: 'Produtos sob medida com briefing organizado.',
    text: 'O cliente descreve a ideia, informa quantidade, prazo e referências para a empresa responder com proposta.',
    icon: '🎁',
    heroMetrics: ['Ideia', 'Quantidade', 'Prazo'],
    flow: ['Escolher opção', 'Descrever pedido', 'Solicitar proposta'],
    checkoutLabel: 'Pedido personalizado',
    supportLabel: 'Referências no WhatsApp',
  },
  beauty: {
    eyebrow: 'Serviços e agenda',
    title: 'Serviços com solicitação de atendimento mais elegante.',
    text: 'Cliente escolhe o serviço, informa preferência de data/horário e envia uma solicitação clara para o painel.',
    icon: '💇',
    heroMetrics: ['Serviços', 'Horário desejado', 'Cupom'],
    flow: ['Escolher serviço', 'Informar horário', 'Solicitar atendimento'],
    checkoutLabel: 'Solicitação/agendamento',
    supportLabel: 'Confirmação no WhatsApp',
  },
  barber: {
    eyebrow: 'Barbearia',
    title: 'Cortes, barba e combos com solicitação rápida.',
    text: 'Uma página com serviços, pacotes e pedido de horário para organizar atendimento sem perder o WhatsApp.',
    icon: '💈',
    heroMetrics: ['Cortes', 'Combos', 'Horário'],
    flow: ['Selecionar serviço', 'Preferência de horário', 'Confirmar solicitação'],
    checkoutLabel: 'Agendamento rápido',
    supportLabel: 'Confirmação no WhatsApp',
  },
  technical_assistance: {
    eyebrow: 'Assistência técnica',
    title: 'Diagnóstico e orçamento técnico sem conversa perdida.',
    text: 'Cliente informa aparelho, defeito, urgência e observações para a equipe analisar no painel.',
    icon: '🛠️',
    heroMetrics: ['Aparelho', 'Defeito', 'Análise'],
    flow: ['Escolher serviço', 'Descrever defeito', 'Solicitar análise'],
    checkoutLabel: 'Diagnóstico estruturado',
    supportLabel: 'Fotos pelo WhatsApp',
  },
  auto: {
    eyebrow: 'Oficina e auto',
    title: 'Orçamentos automotivos com dados do veículo.',
    text: 'Cliente descreve problema, informa veículo e solicita diagnóstico com dados suficientes para atendimento.',
    icon: '🚗',
    heroMetrics: ['Veículo', 'Diagnóstico', 'Orçamento'],
    flow: ['Selecionar serviço', 'Dados do veículo', 'Solicitar orçamento'],
    checkoutLabel: 'Análise técnica',
    supportLabel: 'Fotos no WhatsApp',
  },
  events: {
    eyebrow: 'Eventos',
    title: 'Pacotes, datas e propostas em um fluxo organizado.',
    text: 'Cliente escolhe pacote, informa data, número de pessoas e detalhes para receber proposta da empresa.',
    icon: '🎉',
    heroMetrics: ['Pacotes', 'Data', 'Proposta'],
    flow: ['Escolher pacote', 'Informar data', 'Solicitar proposta'],
    checkoutLabel: 'Proposta de evento',
    supportLabel: 'Detalhes no WhatsApp',
  },
  services: {
    eyebrow: 'Serviços profissionais',
    title: 'Solicitações e propostas com briefing objetivo.',
    text: 'Cliente escolhe serviço, informa necessidade, prazo e local para a empresa responder pelo painel.',
    icon: '🧰',
    heroMetrics: ['Briefing', 'Prazo', 'Proposta'],
    flow: ['Escolher serviço', 'Descrever necessidade', 'Enviar solicitação'],
    checkoutLabel: 'Proposta estruturada',
    supportLabel: 'WhatsApp como apoio',
  },
}

function getCopy(value: unknown) {
  return segmentCopy[normalizeCatalogBusinessType(value)] || segmentCopy.services
}

export function SegmentHeroPanel({
  company,
  businessType,
  primaryColor,
  accentColor,
}: {
  company: PublicSiteCompany
  businessType: string
  primaryColor: string
  accentColor: string
}) {
  const copy = getCopy(businessType)
  const onlineEnabled = company.marketplace_payment_online_enabled === true

  return (
    <div className="rounded-[2.3rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/10">
      <div className="rounded-[1.8rem] p-5 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">{copy.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{company.nome || 'Empresa'}</h2>
          </div>
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-white text-3xl" style={{ color: primaryColor }}>
            {company.logo_url ? <img src={company.logo_url} alt={company.nome || 'Logo'} className="max-h-[78%] max-w-[78%] object-contain" /> : copy.icon}
          </span>
        </div>

        <div className="mt-7 rounded-[1.5rem] bg-white/12 p-4">
          <p className="text-xl font-black leading-tight tracking-[-0.035em]">{copy.title}</p>
          <p className="mt-3 text-sm font-bold leading-6 text-white/70">{copy.text}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {copy.heroMetrics.map((item) => (
            <div key={item} className="rounded-2xl bg-white/12 p-3 text-sm font-black">{item}</div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 rounded-[1.5rem] bg-white p-4 text-[#071b3a]">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{copy.checkoutLabel}</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">Cupom no checkout</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${onlineEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {onlineEnabled ? 'Pix/cartão online ativo' : 'Pagamento manual disponível'}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {copy.flow.map((item, index) => (
              <div key={item} className="rounded-2xl bg-[#f5f8ff] p-3 text-sm font-black text-[#05245c]">
                {index + 1}. {item}
              </div>
            ))}
          </div>

          <p className="text-xs font-black text-slate-500">{copy.supportLabel}</p>
        </div>
      </div>
    </div>
  )
}

export function SegmentProcessBand({ businessType, primaryColor }: { businessType: string; primaryColor: string }) {
  const copy = getCopy(businessType)

  return (
    <div className="mx-auto mt-9 grid max-w-7xl gap-4 md:grid-cols-3">
      {copy.flow.map((item, index) => (
        <article key={item} className="rounded-[1.8rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-sm font-black text-white" style={{ background: primaryColor }}>{index + 1}</div>
          <h3 className="mt-5 text-xl font-black tracking-[-0.035em] text-[#071b3a]">{item}</h3>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
            {index === 0 ? copy.eyebrow : index === 1 ? 'Dados estruturados chegam no painel da empresa.' : 'WhatsApp fica como apoio, não como único caminho.'}
          </p>
        </article>
      ))}
    </div>
  )
}
