export type SiteTemplateId =
  | 'services-premium'
  | 'graphic-premium'
  | 'food-premium'
  | 'beauty-premium'
  | 'barber-premium'
  | 'technical-premium'
  | 'store-premium'
  | 'auto-premium'
  | 'events-premium'
  | 'custom-products-premium'

export type SiteSectionId =
  | 'hero'
  | 'benefits'
  | 'catalog'
  | 'highlights'
  | 'delivery'
  | 'uploadInfo'
  | 'process'
  | 'gallery'
  | 'testimonials'
  | 'professionals'
  | 'warranty'
  | 'faq'
  | 'contact'

export type SiteSectionConfig = {
  id: SiteSectionId
  enabled: boolean
  order: number
}

export type SiteTemplate = {
  templateId: SiteTemplateId
  businessType: string
  label: string
  headline: string
  subheadline: string
  ctaLabel: string
  aboutTitle: string
  aboutText: string
  benefits: Array<{ title: string; text: string }>
  faq: Array<{ question: string; answer: string }>
  sections: SiteSectionConfig[]
  suggestedColors: {
    primary: string
    accent: string
    theme: string
  }
  catalogLabel: string
  productLabel: string
  visualStyle: string
  previewItems: string[]
  features: Array<{ title: string; text: string }>
  paymentMethods: string[]
  deliveryOptions: string[]
}

export const defaultSiteSections: SiteSectionConfig[] = [
  { id: 'hero', enabled: true, order: 1 },
  { id: 'benefits', enabled: true, order: 2 },
  { id: 'catalog', enabled: true, order: 3 },
  { id: 'gallery', enabled: true, order: 4 },
  { id: 'testimonials', enabled: true, order: 5 },
  { id: 'faq', enabled: true, order: 6 },
  { id: 'contact', enabled: true, order: 7 },
]

const commonFaq = [
  { question: 'Como faço uma solicitação?', answer: 'Escolha um item, confira as informações e chame a empresa pelo WhatsApp.' },
  { question: 'Posso tirar dúvidas antes de fechar?', answer: 'Sim. O atendimento continua pelo WhatsApp para combinar detalhes, prazos e condições.' },
  { question: 'As informações podem mudar?', answer: 'Sim. Valores, disponibilidade e prazos podem ser confirmados pela empresa no atendimento.' },
]

const commonBenefits = [
  { title: 'Atendimento organizado', text: 'Suas informações chegam com mais clareza para a empresa.' },
  { title: 'Contato rápido', text: 'O WhatsApp fica integrado ao fluxo de pedido ou orçamento.' },
  { title: 'Página profissional', text: 'Produtos, serviços e informações em uma experiência moderna.' },
]

function sections(ids: SiteSectionId[]): SiteSectionConfig[] {
  return ids.map((id, index) => ({ id, enabled: true, order: index + 1 }))
}

export function normalizeSiteBusinessType(value: unknown) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const aliases: Record<string, string> = {
    servicos: 'services',
    servicos_gerais: 'services',
    services: 'services',
    service: 'services',
    grafica: 'graphic',
    gráfica: 'graphic',
    graphic: 'graphic',
    personalizado: 'custom_products',
    personalizados: 'custom_products',
    custom_products: 'custom_products',
    alimenticio: 'food',
    alimentício: 'food',
    food: 'food',
    restaurante: 'food',
    lanchonete: 'food',
    beleza: 'beauty',
    estetica: 'beauty',
    estética: 'beauty',
    beauty: 'beauty',
    barbearia: 'barber',
    barber: 'barber',
    assistencia: 'technical_assistance',
    assistência: 'technical_assistance',
    assistencia_tecnica: 'technical_assistance',
    technical_assistance: 'technical_assistance',
    loja: 'store',
    comercio: 'store',
    comércio: 'store',
    store: 'store',
    oficina: 'auto',
    automotivo: 'auto',
    auto: 'auto',
    eventos: 'events',
    events: 'events',
  }

  return aliases[raw] || raw || 'services'
}

export const siteTemplates: SiteTemplate[] = [
  {
    templateId: 'services-premium',
    businessType: 'services',
    label: 'Orçaly Serviços',
    headline: 'Receba orçamentos e atendimentos com mais organização.',
    subheadline: 'Mostre seus serviços, capture interessados e transforme conversas soltas em oportunidades claras.',
    ctaLabel: 'Solicitar orçamento',
    aboutTitle: 'Serviços com atendimento mais claro',
    aboutText: 'Esta empresa usa uma estrutura profissional para apresentar serviços, receber solicitações e acompanhar cada atendimento com mais organização.',
    benefits: commonBenefits,
    faq: commonFaq,
    sections: defaultSiteSections,
    suggestedColors: { primary: '#05245c', accent: '#06b6d4', theme: 'premium-blue' },
    catalogLabel: 'Serviços',
    productLabel: 'Serviço',
    visualStyle: 'SaaS premium, confiável e direto',
    previewItems: ['Consultoria', 'Instalação', 'Manutenção'],
    features: [
      { title: 'Propostas', text: 'Organize orçamento, prazo e condições.' },
      { title: 'Prazos', text: 'Deixe claro o que será feito e quando.' },
      { title: 'Acompanhamento', text: 'Cliente entende o andamento do atendimento.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'A combinar'],
    deliveryOptions: ['Atendimento local', 'Atendimento online', 'A combinar'],
  },
  {
    templateId: 'graphic-premium',
    businessType: 'graphic',
    label: 'Orçaly Gráfica',
    headline: 'Orçamentos gráficos com artes, medidas e produção organizada.',
    subheadline: 'Envie sua ideia, informe medidas, quantidades e acompanhe seu orçamento com clareza.',
    ctaLabel: 'Solicitar orçamento',
    aboutTitle: 'Produção gráfica sem bagunça',
    aboutText: 'Receba solicitações com arte, medidas, acabamentos, quantidades e prazos em uma estrutura feita para gráficas e personalizados.',
    benefits: [
      { title: 'Orçamentos mais organizados', text: 'Medidas, quantidades e acabamentos chegam mais claros.' },
      { title: 'Upload de arte', text: 'O cliente entende como enviar arquivos e referências.' },
      { title: 'Acompanhamento de produção', text: 'Fluxo preparado para análise, aprovação e produção.' },
      { title: 'Catálogo profissional', text: 'Produtos e serviços gráficos em uma vitrine premium.' },
    ],
    faq: [
      { question: 'Posso enviar minha arte?', answer: 'Sim. Você pode enviar a arte ou combinar criação e ajustes com a equipe.' },
      { question: 'O orçamento depende da medida?', answer: 'Sim. Medidas, quantidade, material e acabamento podem influenciar o valor.' },
      { question: 'Vocês fazem personalizados?', answer: 'A disponibilidade depende dos produtos cadastrados pela empresa.' },
    ],
    sections: sections(['hero', 'benefits', 'catalog', 'uploadInfo', 'process', 'gallery', 'testimonials', 'faq', 'contact']),
    suggestedColors: { primary: '#05245c', accent: '#7c3aed', theme: 'graphic-gradient' },
    catalogLabel: 'Produtos e serviços gráficos',
    productLabel: 'Serviço gráfico',
    visualStyle: 'Azul, roxo e ciano com aparência criativa e profissional',
    previewItems: ['Cartão de visita', 'Banner', 'Adesivo'],
    features: [
      { title: 'Upload de arte', text: 'Receba arquivos e referências do cliente.' },
      { title: 'Medidas e quantidades', text: 'Campos e textos pensados para orçamento gráfico.' },
      { title: 'Produção', text: 'Status e comunicação mais claros.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal de produção'],
    deliveryOptions: ['Retirada', 'Entrega local', 'Transportadora'],
  },
  {
    templateId: 'food-premium',
    businessType: 'food',
    label: 'Orçaly Food',
    headline: 'Peça online de forma rápida e prática.',
    subheadline: 'Confira nosso cardápio, escolha seus itens e envie o pedido direto pelo WhatsApp.',
    ctaLabel: 'Ver cardápio',
    aboutTitle: 'Cardápio digital para vender melhor',
    aboutText: 'Seu cliente vê produtos, fotos, preços e opções de pedido em uma página rápida e fácil de compartilhar.',
    benefits: [
      { title: 'Cardápio digital com fotos', text: 'Itens organizados, bonitos e fáceis de escolher.' },
      { title: 'Pedido pelo WhatsApp', text: 'O cliente monta a intenção de pedido e chama direto.' },
      { title: 'Entrega ou retirada', text: 'Mostre opções de retirada, entrega e pagamento.' },
      { title: 'Produtos com adicionais', text: 'Prepare adicionais e variações para vender mais.' },
    ],
    faq: [
      { question: 'Como faço meu pedido?', answer: 'Escolha os itens do cardápio e chame a empresa pelo WhatsApp para confirmar.' },
      { question: 'Vocês fazem entrega?', answer: 'Confira as opções de entrega ou retirada informadas pela empresa.' },
      { question: 'Quais formas de pagamento aceitam?', answer: 'As formas de pagamento aparecem nesta página ou são confirmadas pelo WhatsApp.' },
    ],
    sections: sections(['hero', 'benefits', 'catalog', 'highlights', 'delivery', 'gallery', 'faq', 'contact']),
    suggestedColors: { primary: '#991b1b', accent: '#f97316', theme: 'food-warm' },
    catalogLabel: 'Cardápio',
    productLabel: 'Item',
    visualStyle: 'Quente, direto e voltado para pedidos rápidos',
    previewItems: ['X-Burger', 'Pizza média', 'Refrigerante'],
    features: [
      { title: 'Cardápio', text: 'Produtos com foto, descrição e preço.' },
      { title: 'Adicionais', text: 'Mostre complementos e variações quando existirem.' },
      { title: 'WhatsApp', text: 'Fechamento rápido pelo canal principal.' },
    ],
    paymentMethods: ['Pix', 'Dinheiro', 'Cartão na entrega'],
    deliveryOptions: ['Retirada', 'Entrega', 'Consumo no local'],
  },
  {
    templateId: 'beauty-premium',
    businessType: 'beauty',
    label: 'Orçaly Beauty',
    headline: 'Cuide de você com atendimento profissional e agendamento fácil.',
    subheadline: 'Conheça nossos serviços, veja detalhes e agende seu atendimento pelo WhatsApp.',
    ctaLabel: 'Agendar atendimento',
    aboutTitle: 'Beleza com apresentação profissional',
    aboutText: 'Serviços, galeria, depoimentos e atendimento em uma página elegante para transmitir confiança.',
    benefits: [
      { title: 'Serviços bem apresentados', text: 'Mostre valores, duração e benefícios.' },
      { title: 'Agendamento simples', text: 'Leve o cliente ao WhatsApp para confirmar o horário.' },
      { title: 'Galeria e confiança', text: 'Fotos e depoimentos ajudam na decisão.' },
    ],
    faq: [
      { question: 'Como agendo meu atendimento?', answer: 'Escolha o serviço e confirme o melhor horário pelo WhatsApp.' },
      { question: 'Os valores são fixos?', answer: 'A empresa confirma valores e indicação adequada antes do atendimento.' },
      { question: 'Preciso fazer avaliação?', answer: 'Alguns serviços podem exigir avaliação prévia.' },
    ],
    sections: sections(['hero', 'benefits', 'catalog', 'gallery', 'testimonials', 'professionals', 'faq', 'contact']),
    suggestedColors: { primary: '#7e22ce', accent: '#f0abfc', theme: 'beauty-soft' },
    catalogLabel: 'Serviços',
    productLabel: 'Serviço',
    visualStyle: 'Elegante, suave e confiável',
    previewItems: ['Limpeza de pele', 'Design de sobrancelha', 'Pacote especial'],
    features: [
      { title: 'Serviços', text: 'Catálogo de atendimentos e pacotes.' },
      { title: 'Agendamento', text: 'Chamada clara para marcar horário.' },
      { title: 'Depoimentos', text: 'Prova social para aumentar confiança.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Atendimento presencial', 'Agendamento pelo WhatsApp'],
  },
  {
    templateId: 'barber-premium',
    businessType: 'barber',
    label: 'Orçaly Barber',
    headline: 'Cortes, barba e combos com agendamento simples.',
    subheadline: 'Veja serviços, escolha seu atendimento e chame no WhatsApp para marcar.',
    ctaLabel: 'Agendar horário',
    aboutTitle: 'Barbearia com presença premium',
    aboutText: 'Mostre serviços, combos, profissionais e horários em uma página moderna feita para converter visitas em agendamentos.',
    benefits: [
      { title: 'Serviços e combos', text: 'Cortes, barba e pacotes bem apresentados.' },
      { title: 'Agendamento pelo WhatsApp', text: 'Cliente chama com intenção clara.' },
      { title: 'Visual profissional', text: 'Página pronta para Instagram, QR Code e indicação.' },
    ],
    faq: commonFaq,
    sections: sections(['hero', 'benefits', 'catalog', 'gallery', 'testimonials', 'professionals', 'faq', 'contact']),
    suggestedColors: { primary: '#111827', accent: '#d97706', theme: 'barber-dark' },
    catalogLabel: 'Serviços',
    productLabel: 'Serviço',
    visualStyle: 'Escuro, premium e urbano',
    previewItems: ['Corte social', 'Barba completa', 'Combo premium'],
    features: [
      { title: 'Agenda', text: 'Fluxo pensado para marcação de horário.' },
      { title: 'Profissionais', text: 'Preparado para destacar equipe futuramente.' },
      { title: 'Combos', text: 'Venda pacotes com mais clareza.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Atendimento presencial'],
  },
  {
    templateId: 'technical-premium',
    businessType: 'technical_assistance',
    label: 'Orçaly Assistência',
    headline: 'Solicite análise técnica e acompanhe cada etapa do atendimento.',
    subheadline: 'Envie fotos, modelo, defeito apresentado e receba uma proposta organizada.',
    ctaLabel: 'Solicitar análise',
    aboutTitle: 'Assistência técnica mais organizada',
    aboutText: 'O cliente entende como solicitar análise, enviar informações e acompanhar o status técnico.',
    benefits: [
      { title: 'Solicitação com fotos', text: 'Facilite o diagnóstico inicial.' },
      { title: 'Defeito e modelo', text: 'Peça informações importantes desde o começo.' },
      { title: 'Status técnico', text: 'Fluxo preparado para análise, aprovação e reparo.' },
    ],
    faq: [
      { question: 'Preciso levar o aparelho?', answer: 'A empresa confirma pelo WhatsApp após a análise inicial.' },
      { question: 'Posso enviar fotos do defeito?', answer: 'Sim. Fotos ajudam a entender o problema antes do atendimento.' },
      { question: 'O orçamento é cobrado?', answer: 'As condições de análise são informadas pela empresa.' },
    ],
    sections: sections(['hero', 'benefits', 'catalog', 'process', 'warranty', 'faq', 'contact']),
    suggestedColors: { primary: '#1e293b', accent: '#06b6d4', theme: 'technical-clean' },
    catalogLabel: 'Serviços técnicos',
    productLabel: 'Serviço',
    visualStyle: 'Técnico, limpo e confiável',
    previewItems: ['Troca de tela', 'Notebook lento', 'Orçamento técnico'],
    features: [
      { title: 'Diagnóstico', text: 'Fluxo voltado para análise técnica.' },
      { title: 'Fotos', text: 'Cliente envia evidências do problema.' },
      { title: 'Garantia', text: 'Espaço para explicar condições e segurança.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Retirada na loja', 'Entrega combinada'],
  },
  {
    templateId: 'store-premium',
    businessType: 'store',
    label: 'Orçaly Loja',
    headline: 'Conheça nossos produtos e faça seu pedido com facilidade.',
    subheadline: 'Veja fotos, detalhes, preços e chame no WhatsApp para comprar.',
    ctaLabel: 'Ver produtos',
    aboutTitle: 'Vitrine digital para vender melhor',
    aboutText: 'Produtos, ofertas e informações em uma página profissional para compartilhar com clientes.',
    benefits: [
      { title: 'Catálogo online', text: 'Produtos organizados em uma vitrine bonita.' },
      { title: 'Fotos e vídeos', text: 'Mostre detalhes importantes antes do atendimento.' },
      { title: 'Pedido pelo WhatsApp', text: 'Cliente chega com intenção clara de compra.' },
    ],
    faq: commonFaq,
    sections: sections(['hero', 'benefits', 'catalog', 'highlights', 'gallery', 'faq', 'contact']),
    suggestedColors: { primary: '#05245c', accent: '#22c55e', theme: 'store-modern' },
    catalogLabel: 'Produtos',
    productLabel: 'Produto',
    visualStyle: 'Comercial, moderno e direto',
    previewItems: ['Produto destaque', 'Kit promocional', 'Novidade'],
    features: [
      { title: 'Produtos', text: 'Catálogo com fotos, preço e descrição.' },
      { title: 'Variações', text: 'Preparado para tamanhos, cores e opções.' },
      { title: 'Ofertas', text: 'Destaques para vender mais.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Retirada', 'Entrega local', 'Envio'],
  },
  {
    templateId: 'auto-premium',
    businessType: 'auto',
    label: 'Orçaly Auto',
    headline: 'Solicite serviços automotivos com clareza e rapidez.',
    subheadline: 'Envie dados do veículo, fotos e detalhes para receber orientação e orçamento.',
    ctaLabel: 'Solicitar orçamento',
    aboutTitle: 'Atendimento automotivo mais claro',
    aboutText: 'Organize solicitações de serviços, revisões e diagnósticos com informações úteis desde o primeiro contato.',
    benefits: commonBenefits,
    faq: commonFaq,
    sections: sections(['hero', 'benefits', 'catalog', 'process', 'gallery', 'faq', 'contact']),
    suggestedColors: { primary: '#0f172a', accent: '#ef4444', theme: 'auto-strong' },
    catalogLabel: 'Serviços automotivos',
    productLabel: 'Serviço',
    visualStyle: 'Forte, técnico e confiável',
    previewItems: ['Revisão básica', 'Troca de óleo', 'Diagnóstico'],
    features: [
      { title: 'Dados do veículo', text: 'Base para orçamento mais assertivo.' },
      { title: 'Serviços', text: 'Lista clara de manutenção e diagnóstico.' },
      { title: 'Histórico', text: 'Atendimentos ficam mais organizados.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Atendimento na oficina', 'Retirada combinada'],
  },
  {
    templateId: 'events-premium',
    businessType: 'events',
    label: 'Orçaly Eventos',
    headline: 'Solicite pacotes e serviços para seu evento.',
    subheadline: 'Informe data, local, quantidade de pessoas e detalhes para receber uma proposta organizada.',
    ctaLabel: 'Solicitar proposta',
    aboutTitle: 'Eventos com proposta mais clara',
    aboutText: 'Mostre pacotes, serviços, galeria e informações para transformar interesse em solicitação de orçamento.',
    benefits: commonBenefits,
    faq: commonFaq,
    sections: sections(['hero', 'benefits', 'catalog', 'process', 'gallery', 'testimonials', 'faq', 'contact']),
    suggestedColors: { primary: '#581c87', accent: '#f59e0b', theme: 'events-premium' },
    catalogLabel: 'Pacotes e serviços',
    productLabel: 'Pacote',
    visualStyle: 'Celebrativo, elegante e visual',
    previewItems: ['Pacote festa', 'Decoração', 'Fotografia'],
    features: [
      { title: 'Datas', text: 'Solicitação com data e local.' },
      { title: 'Pacotes', text: 'Serviços organizados para eventos.' },
      { title: 'Propostas', text: 'Orçamentos mais claros.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal de reserva'],
    deliveryOptions: ['Atendimento no local', 'Montagem', 'A combinar'],
  },
  {
    templateId: 'custom-products-premium',
    businessType: 'custom_products',
    label: 'Orçaly Personalizados',
    headline: 'Produtos personalizados com pedido organizado do começo ao fim.',
    subheadline: 'Envie detalhes, fotos, variações e referências para receber orçamento com clareza.',
    ctaLabel: 'Personalizar agora',
    aboutTitle: 'Personalizados sem perder detalhes',
    aboutText: 'Uma estrutura feita para receber pedidos sob medida com referências, variações e aprovação.',
    benefits: [
      { title: 'Detalhes do pedido', text: 'Receba medidas, variações e preferências.' },
      { title: 'Fotos e referências', text: 'Cliente envia inspiração e exemplos.' },
      { title: 'Aprovação organizada', text: 'Fluxo preparado para produção sob demanda.' },
    ],
    faq: commonFaq,
    sections: sections(['hero', 'benefits', 'catalog', 'uploadInfo', 'process', 'gallery', 'faq', 'contact']),
    suggestedColors: { primary: '#05245c', accent: '#ec4899', theme: 'custom-creative' },
    catalogLabel: 'Produtos personalizados',
    productLabel: 'Produto',
    visualStyle: 'Criativo, colorido e premium',
    previewItems: ['Caneca personalizada', 'Camiseta', 'Kit brinde'],
    features: [
      { title: 'Personalização', text: 'Detalhes e variações ficam claros.' },
      { title: 'Referências', text: 'Fotos ajudam a criar corretamente.' },
      { title: 'Produção', text: 'Status e aprovação mais organizados.' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal de produção'],
    deliveryOptions: ['Retirada', 'Entrega', 'Envio'],
  },
]

export function getSiteTemplateByBusinessType(businessType: unknown): SiteTemplate {
  const normalized = normalizeSiteBusinessType(businessType)
  return siteTemplates.find((template) => template.businessType === normalized) || siteTemplates[0]
}

export function getDefaultSiteSettingsForBusiness(businessType: unknown) {
  const template = getSiteTemplateByBusinessType(businessType)

  return {
    business_type: template.businessType,
    site_template: template.templateId,
    site_theme: template.suggestedColors.theme,
    site_primary_color: template.suggestedColors.primary,
    site_accent_color: template.suggestedColors.accent,
    site_headline: template.headline,
    site_subheadline: template.subheadline,
    site_cta_label: template.ctaLabel,
    site_cta_text: template.ctaLabel,
    site_about_title: template.aboutTitle,
    site_about_text: template.aboutText,
    site_sections: template.sections,
    site_benefits: template.benefits,
    site_faq: template.faq,
    site_features: template.features,
    site_payment_methods: template.paymentMethods,
    site_delivery_options: template.deliveryOptions,
    site_updated_at: new Date().toISOString(),
  }
}

export function normalizeSectionList(value: unknown, fallback: SiteSectionConfig[] = defaultSiteSections): SiteSectionConfig[] {
  if (!Array.isArray(value) || value.length === 0) return fallback

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item, index) => ({
      id: String(item.id || 'hero') as SiteSectionId,
      enabled: item.enabled !== false,
      order: Number(item.order || index + 1),
    }))
    .sort((a, b) => a.order - b.order)
}
