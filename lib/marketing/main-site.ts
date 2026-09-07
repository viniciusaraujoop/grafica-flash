export type MarketingPlan = {
  id: 'essencial' | 'profissional' | 'premium'
  key: 'basico' | 'intermediario' | 'premium'
  name: string
  price: number
  audience: string
  outcome: string
  description: string
  highlights: string[]
  featured?: boolean
}

export type MarketingSolution = {
  slug: string
  businessType:
    | 'graphic'
    | 'food'
    | 'technical_assistance'
    | 'store'
    | 'barber'
    | 'services'
    | 'events'
  label: string
  shortLabel: string
  eyebrow: string
  headline: string
  description: string
  workflow: string[]
  features: string[]
  publicExperience: string[]
  accent: 'blue' | 'cyan' | 'amber' | 'violet' | 'emerald'
}

export const marketingPlans: MarketingPlan[] = [
  {
    id: 'essencial',
    key: 'basico',
    name: 'Básico',
    price: 49.9,
    audience: 'Para colocar sua empresa no digital com uma operação mais organizada.',
    outcome: 'Presença digital + pedidos + clientes no mesmo lugar.',
    description: 'A base para sair do improviso sem transformar a rotina em outro projeto de tecnologia.',
    highlights: ['Página pública', 'Pedidos e clientes', 'Catálogo essencial', 'Identidade da empresa'],
  },
  {
    id: 'profissional',
    key: 'intermediario',
    name: 'Intermediário',
    price: 99.9,
    audience: 'Para empresas que já vendem e precisam acompanhar melhor a operação.',
    outcome: 'Mais controle comercial do contato à entrega.',
    description: 'Amplia a visão comercial com catálogo completo, propostas, follow-up e relatórios operacionais.',
    highlights: ['Tudo do Básico', 'Catálogo completo', 'Propostas e follow-up', 'Relatórios operacionais'],
    featured: true,
  },
  {
    id: 'premium',
    key: 'premium',
    name: 'Premium',
    price: 149.9,
    audience: 'Para empresas que precisam de automação e mais recursos para crescer.',
    outcome: 'Operação mais completa para recuperar oportunidades e ganhar escala.',
    description: 'Adiciona recursos avançados e automações sem criar um segundo sistema para a equipe administrar.',
    highlights: ['Tudo do Intermediário', 'Automações', 'Recuperação de oportunidades', 'Recursos avançados'],
  },
]

export const marketingSolutions: MarketingSolution[] = [
  {
    slug: 'graficas',
    businessType: 'graphic',
    label: 'Gráficas e personalizados',
    shortLabel: 'Gráficas',
    eyebrow: 'Orçamento, arte e produção',
    headline: 'Da solicitação de orçamento à arte aprovada, com menos retrabalho.',
    description: 'O cliente envia medidas, quantidades, referências e arquivos. A equipe organiza proposta, aprovação e produção no mesmo fluxo.',
    workflow: ['Orçamento', 'Arte', 'Aprovação', 'Produção', 'Entrega'],
    features: ['Upload de arte', 'Medidas e quantidades', 'Propostas', 'Aprovação de arte', 'Produção'],
    publicExperience: ['Catálogo', 'Pedido de orçamento', 'Envio de arquivos', 'Acompanhamento'],
    accent: 'blue',
  },
  {
    slug: 'restaurantes',
    businessType: 'food',
    label: 'Restaurantes e delivery',
    shortLabel: 'Food',
    eyebrow: 'Cardápio, pedido e entrega',
    headline: 'Cardápio digital na frente. Operação organizada por trás.',
    description: 'Produtos, adicionais, carrinho, retirada ou entrega e acompanhamento do pedido em uma experiência feita para negócios de alimentação.',
    workflow: ['Cardápio', 'Pedido', 'Confirmação', 'Preparo', 'Entrega'],
    features: ['Cardápio digital', 'Carrinho', 'Adicionais', 'Entrega ou retirada', 'Pedidos'],
    publicExperience: ['Fotos e categorias', 'Carrinho', 'Forma de entrega', 'Pagamento quando disponível'],
    accent: 'emerald',
  },
  {
    slug: 'assistencia-tecnica',
    businessType: 'technical_assistance',
    label: 'Assistência técnica',
    shortLabel: 'Assistência',
    eyebrow: 'Aparelho, diagnóstico e reparo',
    headline: 'Cada aparelho acompanhado desde a entrada até a entrega.',
    description: 'Registre defeito, modelo, fotos, diagnóstico, proposta e andamento sem perder o histórico do cliente.',
    workflow: ['Entrada', 'Diagnóstico', 'Aprovação', 'Reparo', 'Pronto'],
    features: ['Fotos', 'Defeito e modelo', 'Diagnóstico', 'Proposta', 'Status'],
    publicExperience: ['Solicitação técnica', 'Envio de fotos', 'Acompanhamento', 'Contato'],
    accent: 'amber',
  },
  {
    slug: 'lojas',
    businessType: 'store',
    label: 'Lojas e comércio',
    shortLabel: 'Lojas',
    eyebrow: 'Catálogo, carrinho e pedido',
    headline: 'Uma vitrine digital que conversa com a operação da loja.',
    description: 'Produtos, imagens, variações, catálogo e pedidos em uma presença digital pronta para compartilhar no WhatsApp, Instagram e anúncios.',
    workflow: ['Catálogo', 'Produto', 'Carrinho', 'Pedido', 'Acompanhamento'],
    features: ['Catálogo', 'Fotos e vídeos', 'Variações', 'Pedidos', 'Clientes'],
    publicExperience: ['Busca', 'Categorias', 'Produto detalhado', 'Carrinho'],
    accent: 'cyan',
  },
  {
    slug: 'barbearias',
    businessType: 'barber',
    label: 'Barbearias',
    shortLabel: 'Barbearias',
    eyebrow: 'Serviços, profissionais e horários',
    headline: 'Apresente serviços e leve o cliente ao próximo passo sem atrito.',
    description: 'Organize cortes, barba, combos, profissionais e contato em uma página profissional preparada para atendimento local.',
    workflow: ['Serviço', 'Profissional', 'Horário', 'Confirmação'],
    features: ['Serviços', 'Profissionais', 'Horários', 'Combos', 'WhatsApp'],
    publicExperience: ['Serviços', 'Valores', 'Equipe', 'Contato'],
    accent: 'violet',
  },
  {
    slug: 'servicos',
    businessType: 'services',
    label: 'Empresas de serviços',
    shortLabel: 'Serviços',
    eyebrow: 'Lead, proposta e execução',
    headline: 'Do primeiro contato à execução, com o histórico no mesmo lugar.',
    description: 'Centralize solicitações, propostas, prazos, tarefas, follow-up e histórico para não depender de conversa perdida ou memória da equipe.',
    workflow: ['Lead', 'Análise', 'Proposta', 'Aprovação', 'Execução'],
    features: ['Solicitações', 'CRM', 'Propostas', 'Follow-up', 'Tarefas'],
    publicExperience: ['Serviços', 'Solicitação', 'Contato', 'Acompanhamento'],
    accent: 'blue',
  },
  {
    slug: 'eventos',
    businessType: 'events',
    label: 'Eventos e locações',
    shortLabel: 'Eventos',
    eyebrow: 'Pacotes, disponibilidade e execução',
    headline: 'Organize solicitações, pacotes e execução sem espalhar a operação.',
    description: 'Uma estrutura para apresentar serviços e pacotes, receber solicitações e acompanhar o trabalho até a conclusão.',
    workflow: ['Solicitação', 'Pacote', 'Proposta', 'Preparação', 'Evento'],
    features: ['Pacotes', 'Solicitações', 'Propostas', 'Equipe', 'Tarefas'],
    publicExperience: ['Pacotes', 'Datas', 'Contato', 'Solicitação'],
    accent: 'violet',
  },
]

export const marketingFeatures = [
  {
    key: 'site',
    title: 'Site da empresa',
    benefit: 'Seu negócio ganha um endereço profissional para apresentar produtos, serviços e receber ações do cliente.',
    bullets: ['Identidade visual', 'Catálogo ou serviços', 'WhatsApp', 'Carrinho ou orçamento conforme o segmento'],
  },
  {
    key: 'pedidos',
    title: 'Pedidos e execução',
    benefit: 'Acompanhe cada venda ou atendimento sem depender de conversa solta e anotação paralela.',
    bullets: ['Lista e Kanban', 'Status por segmento', 'Prazo', 'Responsável'],
  },
  {
    key: 'crm',
    title: 'Clientes e CRM',
    benefit: 'Saiba quem precisa de retorno e qual é a próxima ação comercial.',
    bullets: ['Leads', 'Pipeline', 'Follow-up', 'Histórico'],
  },
  {
    key: 'propostas',
    title: 'Propostas',
    benefit: 'Envie uma experiência mais profissional e acompanhe aprovação sem criar um fluxo paralelo.',
    bullets: ['Itens e condições', 'Validade', 'Aprovação', 'Timeline'],
  },
  {
    key: 'financeiro',
    title: 'Financeiro',
    benefit: 'Conecte o andamento comercial à visão de recebimentos e operação financeira disponível no plano.',
    bullets: ['Recebimentos', 'Contas', 'Pagamentos', 'Relatórios'],
  },
  {
    key: 'whatsapp',
    title: 'WhatsApp sem virar sistema de gestão',
    benefit: 'Continue conversando no canal que seus clientes já usam, mas deixe pedidos, status e histórico no Orçaly.',
    bullets: ['Contato contextual', 'Follow-up', 'Pedidos organizados', 'Links compartilháveis'],
  },
]

export const marketingFaq = [
  {
    question: 'O que é o Orçaly?',
    answer: 'O Orçaly é uma plataforma para criar a presença digital da empresa e organizar pedidos, clientes, propostas e operação em um fluxo adaptado ao tipo de negócio.',
  },
  {
    question: 'Preciso instalar alguma coisa?',
    answer: 'Não. O acesso é feito pelo navegador e as principais experiências públicas e administrativas foram construídas para funcionar em celular, tablet e computador.',
  },
  {
    question: 'Minha empresa ganha um site próprio?',
    answer: 'Sim. Durante o cadastro a empresa escolhe um endereço público no domínio do Orçaly e pode personalizar identidade, informações, produtos ou serviços pelo painel.',
  },
  {
    question: 'O Orçaly funciona no celular?',
    answer: 'Sim. O painel e as páginas públicas possuem experiências responsivas e fluxos específicos para telas menores.',
  },
  {
    question: 'Como funcionam os pagamentos online?',
    answer: 'Quando o marketplace da empresa usa pagamentos online, o processamento é realizado pela infraestrutura do Mercado Pago conforme a conta e a configuração disponíveis.',
  },
  {
    question: 'Meu cliente precisa criar uma conta?',
    answer: 'Os fluxos públicos principais, como catálogo, orçamento, proposta e acompanhamento por link, foram desenhados para evitar exigir uma conta administrativa do cliente.',
  },
  {
    question: 'Funciona para meu segmento?',
    answer: 'O Orçaly possui estruturas específicas para serviços, gráfica, food, beleza, barbearia, assistência técnica, automotivo, loja, eventos e personalizados.',
  },
]

export function marketingPlanSignupHref(planId?: MarketingPlan['id']) {
  return planId ? `/cadastro?plano=${encodeURIComponent(planId)}` : '/cadastro'
}

export function findMarketingSolution(slug: string) {
  return marketingSolutions.find((solution) => solution.slug === slug) || null
}
