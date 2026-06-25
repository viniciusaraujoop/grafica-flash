export type SiteTemplateId =
  | 'grafica'
  | 'alimenticio'
  | 'imobiliaria'
  | 'personalizados'
  | 'assistencia'
  | 'barbearia'
  | 'estetica'
  | 'oficina'
  | 'loja'
  | 'servicos'
  | 'vidracaria'
  | 'serralheria'
  | 'moveis'
  | 'eventos'

export type SiteTemplate = {
  id: SiteTemplateId
  nome: string
  segmento: string
  descricao: string
  arte: string
  paleta: {
    primary: string
    accent: string
    background: string
    text: string
    card: string
  }
  conteudo: {
    badge: string
    headline: string
    subheadline: string
    cta: string
    secondaryCta: string
    aboutTitle: string
    aboutText: string
    servicesTitle: string
    contactTitle: string
    whatsappMessage: string
    promoTitle: string
    promoText: string
  }
  features: Array<{ titulo: string; texto: string }>
  benefits: Array<{ titulo: string; texto: string }>
  faq: Array<{ pergunta: string; resposta: string }>
  testimonials: Array<{ nome: string; texto: string }>
  gallery: Array<{ titulo: string; texto: string; tipo: string }>
  paymentMethods: string[]
  deliveryOptions: string[]
  keywords: string[]
}

export const siteTemplates: SiteTemplate[] = [
  {
    id: 'grafica',
    nome: 'Gráfica e Comunicação Visual',
    segmento: 'Gráfica',
    descricao: 'Site com catálogo, orçamento rápido, destaque para materiais, arte e prazo.',
    arte: 'print-grid',
    paleta: { primary: '#05245c', accent: '#22c55e', background: '#f5f8ff', text: '#071b3a', card: '#ffffff' },
    conteudo: {
      badge: 'Gráfica rápida e profissional',
      headline: 'Impressos, adesivos e comunicação visual sem complicação',
      subheadline: 'Faça seu orçamento online, envie sua arte e acompanhe o pedido com praticidade.',
      cta: 'Pedir orçamento',
      secondaryCta: 'Ver catálogo',
      aboutTitle: 'Produção gráfica com atendimento próximo',
      aboutText: 'Criamos materiais impressos e personalizados para empresas, eventos e campanhas locais.',
      servicesTitle: 'Produtos gráficos mais pedidos',
      contactTitle: 'Fale com a gráfica',
      whatsappMessage: 'Olá! Vim pelo site e quero fazer um orçamento gráfico.',
      promoTitle: 'Arte + impressão em um só lugar',
      promoText: 'Envie sua ideia e receba uma proposta organizada com prazo, valores e próximos passos.',
    },
    features: [
      { titulo: 'Orçamento com medidas', texto: 'Ideal para banners, lonas, placas e adesivos por metro quadrado.' },
      { titulo: 'Upload de arte', texto: 'O cliente pode enviar a arte ou solicitar criação pelo atendimento.' },
      { titulo: 'Status de produção', texto: 'Acompanhe aprovação, produção, retirada e entrega.' },
    ],
    benefits: [
      { titulo: 'Mais pedidos organizados', texto: 'Tudo sai do WhatsApp bagunçado e entra em um fluxo claro.' },
      { titulo: 'Menos retrabalho', texto: 'Perguntas certas antes de produzir evitam erro de arte, medida e prazo.' },
      { titulo: 'Mais profissionalismo', texto: 'Propostas bonitas passam mais confiança para o cliente.' },
    ],
    faq: [
      { pergunta: 'Preciso ter arte pronta?', resposta: 'Não. Você pode enviar a arte pronta ou pedir ajuda para desenvolver.' },
      { pergunta: 'Como funciona o prazo?', resposta: 'O prazo começa após aprovação da arte e confirmação do pagamento, quando houver.' },
      { pergunta: 'Vocês fazem entrega?', resposta: 'A entrega depende da região e pode ser combinada no atendimento.' },
    ],
    testimonials: [
      { nome: 'Cliente local', texto: 'O orçamento ficou claro e consegui acompanhar tudo pelo link.' },
      { nome: 'Empresa parceira', texto: 'Facilitou muito repetir pedidos de adesivos e cartões.' },
    ],
    gallery: [
      { titulo: 'Cartões de visita', texto: 'Modelos profissionais para empresas e autônomos.', tipo: 'card' },
      { titulo: 'Banners e lonas', texto: 'Comunicação visual para fachada, evento e divulgação.', tipo: 'banner' },
      { titulo: 'Adesivos', texto: 'Rótulos, etiquetas, vitrines e comunicação interna.', tipo: 'sticker' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Retirada no balcão', 'Entrega local'],
    keywords: ['gráfica', 'impressão', 'adesivo', 'banner', 'cartão de visita'],
  },
  {
    id: 'alimenticio',
    nome: 'Ramo alimentício',
    segmento: 'Alimentício',
    descricao: 'Site para cardápio, encomendas, pedidos especiais, kits e retirada/entrega.',
    arte: 'food-warm',
    paleta: { primary: '#7c2d12', accent: '#f97316', background: '#fff7ed', text: '#431407', card: '#ffffff' },
    conteudo: {
      badge: 'Pedidos e encomendas',
      headline: 'Sabores, kits e encomendas com atendimento fácil',
      subheadline: 'Veja opções, escolha quantidades, combine retirada ou entrega e receba confirmação pelo WhatsApp.',
      cta: 'Fazer pedido',
      secondaryCta: 'Ver opções',
      aboutTitle: 'Produção feita com cuidado',
      aboutText: 'Atendemos pedidos do dia a dia, eventos, kits e encomendas com organização e carinho.',
      servicesTitle: 'Opções mais pedidas',
      contactTitle: 'Fale com a cozinha',
      whatsappMessage: 'Olá! Vim pelo site e quero fazer um pedido.',
      promoTitle: 'Encomendas sem confusão',
      promoText: 'Informe data, quantidade e preferências para receber uma proposta completa.',
    },
    features: [
      { titulo: 'Cardápio organizado', texto: 'Mostre produtos, combos, tamanhos e adicionais.' },
      { titulo: 'Data de retirada', texto: 'O cliente informa quando precisa do pedido.' },
      { titulo: 'Observações especiais', texto: 'Campos para restrição alimentar, sabor e personalização.' },
    ],
    benefits: [
      { titulo: 'Menos pedido perdido', texto: 'Tudo vira registro organizado, sem depender só da conversa.' },
      { titulo: 'Mais venda por combo', texto: 'Destaque kits, promoções e produtos adicionais.' },
      { titulo: 'Atendimento mais rápido', texto: 'O cliente já chega com as informações principais.' },
    ],
    faq: [
      { pergunta: 'Aceitam encomendas?', resposta: 'Sim. Informe a data, quantidade e detalhes do pedido.' },
      { pergunta: 'Tem entrega?', resposta: 'A entrega pode variar por região e horário.' },
      { pergunta: 'Consigo personalizar?', resposta: 'Sim, dependendo do produto e prazo disponível.' },
    ],
    testimonials: [
      { nome: 'Cliente de encomenda', texto: 'Consegui enviar tudo certinho sem ficar repetindo no WhatsApp.' },
      { nome: 'Cliente recorrente', texto: 'Agora ficou fácil repetir o pedido de toda semana.' },
    ],
    gallery: [
      { titulo: 'Combos', texto: 'Monte opções prontas para vender mais.', tipo: 'combo' },
      { titulo: 'Encomendas', texto: 'Pedidos para festas, empresas e datas especiais.', tipo: 'cake' },
      { titulo: 'Produtos do dia', texto: 'Destaque itens disponíveis para retirada rápida.', tipo: 'plate' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Retirada', 'Entrega local', 'Agendamento'],
    keywords: ['delivery', 'encomenda', 'cardápio', 'comida', 'pedido'],
  },
  {
    id: 'imobiliaria',
    nome: 'Imobiliária e corretores',
    segmento: 'Imobiliária',
    descricao: 'Site para imóveis, captação de leads, visitas e atendimento consultivo.',
    arte: 'real-estate',
    paleta: { primary: '#0f172a', accent: '#d4af37', background: '#f8fafc', text: '#0f172a', card: '#ffffff' },
    conteudo: {
      badge: 'Imóveis e atendimento consultivo',
      headline: 'Encontre o imóvel certo com atendimento direto',
      subheadline: 'Veja opções, tire dúvidas, solicite visita e fale com um especialista pelo WhatsApp.',
      cta: 'Quero atendimento',
      secondaryCta: 'Ver imóveis',
      aboutTitle: 'Compra, venda e locação com clareza',
      aboutText: 'Ajudamos clientes a encontrar imóveis de forma segura, organizada e transparente.',
      servicesTitle: 'Imóveis e serviços',
      contactTitle: 'Fale com o corretor',
      whatsappMessage: 'Olá! Vim pelo site e quero informações sobre imóveis.',
      promoTitle: 'Atendimento rápido para imóveis',
      promoText: 'Receba opções compatíveis com seu perfil e agende uma visita.',
    },
    features: [
      { titulo: 'Imóveis em destaque', texto: 'Apresente imóveis com fotos, valores e informações principais.' },
      { titulo: 'Captação de interesse', texto: 'Receba nome, WhatsApp, tipo de imóvel e região desejada.' },
      { titulo: 'Agendamento de visita', texto: 'Facilite o próximo passo para o cliente interessado.' },
    ],
    benefits: [
      { titulo: 'Mais leads qualificados', texto: 'O cliente já informa perfil, região e interesse.' },
      { titulo: 'Site mais confiável', texto: 'Visual profissional aumenta percepção de credibilidade.' },
      { titulo: 'Atendimento centralizado', texto: 'Menos conversa perdida entre anúncios e WhatsApp.' },
    ],
    faq: [
      { pergunta: 'Posso agendar visita?', resposta: 'Sim. Informe o imóvel de interesse e o melhor horário.' },
      { pergunta: 'Trabalham com financiamento?', resposta: 'Você pode consultar as condições diretamente no atendimento.' },
      { pergunta: 'Posso anunciar meu imóvel?', resposta: 'Entre em contato para avaliação e cadastro do imóvel.' },
    ],
    testimonials: [
      { nome: 'Comprador', texto: 'Consegui entender as opções antes de chamar no WhatsApp.' },
      { nome: 'Proprietário', texto: 'O atendimento foi mais organizado e rápido.' },
    ],
    gallery: [
      { titulo: 'Casas', texto: 'Imóveis residenciais para compra ou locação.', tipo: 'house' },
      { titulo: 'Apartamentos', texto: 'Opções compactas, familiares e de alto padrão.', tipo: 'building' },
      { titulo: 'Terrenos', texto: 'Áreas para construir, investir ou empreender.', tipo: 'land' },
    ],
    paymentMethods: ['Financiamento', 'À vista', 'Negociação'],
    deliveryOptions: ['Visita agendada', 'Atendimento online'],
    keywords: ['imobiliária', 'corretor', 'imóveis', 'casa', 'apartamento'],
  },
  {
    id: 'personalizados',
    nome: 'Personalizados e brindes',
    segmento: 'Personalizados',
    descricao: 'Site para camisetas, canecas, brindes, lembranças e kits.',
    arte: 'creative',
    paleta: { primary: '#581c87', accent: '#ec4899', background: '#faf5ff', text: '#2e1065', card: '#ffffff' },
    conteudo: {
      badge: 'Produtos personalizados',
      headline: 'Personalize presentes, brindes e kits do seu jeito',
      subheadline: 'Escolha produto, quantidade, arte e prazo para receber uma proposta organizada.',
      cta: 'Personalizar agora',
      secondaryCta: 'Ver ideias',
      aboutTitle: 'Personalização com atenção aos detalhes',
      aboutText: 'Transformamos ideias em produtos personalizados para empresas, eventos e presentes.',
      servicesTitle: 'Personalizados em destaque',
      contactTitle: 'Fale com a equipe',
      whatsappMessage: 'Olá! Vim pelo site e quero personalizar um produto.',
      promoTitle: 'Sua ideia pronta para produção',
      promoText: 'Envie sua referência e receba um orçamento completo.',
    },
    features: [
      { titulo: 'Briefing guiado', texto: 'Perguntas sobre cor, tamanho, arte, lado da personalização e prazo.' },
      { titulo: 'Variações por produto', texto: 'Cadastre tamanhos, cores e opções adicionais.' },
      { titulo: 'Aprovação antes de produzir', texto: 'O cliente aprova a arte antes da produção.' },
    ],
    benefits: [
      { titulo: 'Menos erro de detalhe', texto: 'Cada personalização fica registrada.' },
      { titulo: 'Mais venda consultiva', texto: 'O site ajuda o cliente a explicar o que quer.' },
      { titulo: 'Recompra fácil', texto: 'Clientes podem repetir pedidos anteriores.' },
    ],
    faq: [
      { pergunta: 'Posso enviar minha arte?', resposta: 'Sim, você pode enviar sua arte ou referência.' },
      { pergunta: 'Tem pedido mínimo?', resposta: 'Depende do produto escolhido.' },
      { pergunta: 'Fazem para empresas?', resposta: 'Sim, atendemos brindes, uniformes e kits corporativos.' },
    ],
    testimonials: [
      { nome: 'Cliente de evento', texto: 'Ficou fácil explicar os detalhes do kit.' },
      { nome: 'Empresa', texto: 'Repetimos brindes sem refazer briefing do zero.' },
    ],
    gallery: [
      { titulo: 'Camisas', texto: 'Frente, costas, nomes e numeração.', tipo: 'shirt' },
      { titulo: 'Canecas', texto: 'Presentes e kits personalizados.', tipo: 'mug' },
      { titulo: 'Brindes', texto: 'Produtos para empresas e eventos.', tipo: 'gift' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal'],
    deliveryOptions: ['Retirada', 'Entrega local', 'Envio'],
    keywords: ['personalizados', 'brindes', 'camisas', 'canecas', 'lembrancinhas'],
  },
  {
    id: 'assistencia',
    nome: 'Assistência técnica',
    segmento: 'Assistência técnica',
    descricao: 'Site para diagnóstico, reparo, orçamento e acompanhamento de aparelho.',
    arte: 'tech',
    paleta: { primary: '#0f3d5e', accent: '#06b6d4', background: '#ecfeff', text: '#083344', card: '#ffffff' },
    conteudo: {
      badge: 'Diagnóstico e reparo',
      headline: 'Conserto com orçamento claro e acompanhamento fácil',
      subheadline: 'Informe aparelho, defeito e urgência para receber uma avaliação organizada.',
      cta: 'Solicitar diagnóstico',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Assistência técnica com processo transparente',
      aboutText: 'Recebemos, diagnosticamos e atualizamos o cliente em cada etapa do reparo.',
      servicesTitle: 'Serviços técnicos',
      contactTitle: 'Fale com a assistência',
      whatsappMessage: 'Olá! Vim pelo site e preciso de assistência técnica.',
      promoTitle: 'Diagnóstico mais organizado',
      promoText: 'O cliente informa o defeito e o atendimento já começa com contexto.',
    },
    features: [
      { titulo: 'Triagem por aparelho', texto: 'Celular, notebook, videogame, computador e outros.' },
      { titulo: 'Histórico do reparo', texto: 'Registre diagnóstico, peças, prazo e observações.' },
      { titulo: 'Status para cliente', texto: 'Reduza mensagens repetidas sobre andamento.' },
    ],
    benefits: [
      { titulo: 'Mais controle', texto: 'Cada aparelho fica vinculado ao cliente.' },
      { titulo: 'Menos confusão', texto: 'Defeito, peça e garantia ficam documentados.' },
      { titulo: 'Confiança', texto: 'Orçamento claro reduz desentendimento.' },
    ],
    faq: [
      { pergunta: 'O diagnóstico é cobrado?', resposta: 'Depende da política da empresa e do tipo de aparelho.' },
      { pergunta: 'Tem garantia?', resposta: 'A garantia varia conforme serviço e peça utilizada.' },
      { pergunta: 'Quanto tempo demora?', resposta: 'O prazo depende do defeito e disponibilidade de peças.' },
    ],
    testimonials: [
      { nome: 'Cliente de reparo', texto: 'Recebi o orçamento com tudo bem explicado.' },
      { nome: 'Cliente recorrente', texto: 'Consigo acompanhar sem mandar mensagem toda hora.' },
    ],
    gallery: [
      { titulo: 'Celulares', texto: 'Tela, bateria, conector e diagnóstico.', tipo: 'phone' },
      { titulo: 'Notebooks', texto: 'Formatação, manutenção e upgrade.', tipo: 'laptop' },
      { titulo: 'Games', texto: 'Limpeza, reparos e avaliação.', tipo: 'game' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Entrega no balcão', 'Retirada combinada'],
    keywords: ['assistência técnica', 'conserto', 'celular', 'notebook', 'reparo'],
  },
  {
    id: 'barbearia',
    nome: 'Barbearia',
    segmento: 'Barbearia',
    descricao: 'Site para serviços, combos, agenda, equipe e atendimento.',
    arte: 'barber',
    paleta: { primary: '#111827', accent: '#b45309', background: '#fffbeb', text: '#111827', card: '#ffffff' },
    conteudo: {
      badge: 'Corte, barba e estilo',
      headline: 'Agende seu atendimento com praticidade',
      subheadline: 'Escolha serviço, profissional e horário para falar direto pelo WhatsApp.',
      cta: 'Agendar horário',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Barbearia com atendimento de respeito',
      aboutText: 'Cuidamos do visual com serviços para corte, barba, sobrancelha, pigmentação e combos.',
      servicesTitle: 'Serviços da barbearia',
      contactTitle: 'Agende seu horário',
      whatsappMessage: 'Olá! Vim pelo site e quero agendar um horário.',
      promoTitle: 'Combo corte + barba',
      promoText: 'Destaque seus combos e aumente o ticket médio.',
    },
    features: [
      { titulo: 'Serviços e combos', texto: 'Mostre cortes, barba, sobrancelha e pacotes.' },
      { titulo: 'Agendamento rápido', texto: 'Cliente já chega pelo WhatsApp com intenção clara.' },
      { titulo: 'Fidelização', texto: 'Facilite retorno e recompra de combos.' },
    ],
    benefits: [
      { titulo: 'Mais agenda cheia', texto: 'Botões diretos para reservar horário.' },
      { titulo: 'Visual forte', texto: 'Site com presença premium para a marca.' },
      { titulo: 'Menos pergunta repetida', texto: 'Serviços e valores ficam claros.' },
    ],
    faq: [
      { pergunta: 'Precisa agendar?', resposta: 'Recomendamos agendamento para garantir horário.' },
      { pergunta: 'Tem combo?', resposta: 'Sim, combos podem variar por profissional e dia.' },
      { pergunta: 'Atende por ordem de chegada?', resposta: 'Depende da disponibilidade da equipe.' },
    ],
    testimonials: [
      { nome: 'Cliente', texto: 'Agendei pelo site e fui atendido no horário.' },
      { nome: 'Cliente fiel', texto: 'Ficou fácil ver combos e horários.' },
    ],
    gallery: [
      { titulo: 'Cortes', texto: 'Clássico, degradê e estilos modernos.', tipo: 'cut' },
      { titulo: 'Barba', texto: 'Modelagem, hidratação e acabamento.', tipo: 'beard' },
      { titulo: 'Combos', texto: 'Pacotes para aumentar recorrência.', tipo: 'combo' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Atendimento presencial', 'Horário agendado'],
    keywords: ['barbearia', 'corte', 'barba', 'agendamento'],
  },
  {
    id: 'estetica',
    nome: 'Estética e beleza',
    segmento: 'Estética',
    descricao: 'Site para procedimentos, pacotes, avaliações e agendamento.',
    arte: 'beauty',
    paleta: { primary: '#831843', accent: '#f472b6', background: '#fdf2f8', text: '#500724', card: '#ffffff' },
    conteudo: {
      badge: 'Beleza, cuidado e autoestima',
      headline: 'Procedimentos e pacotes com atendimento personalizado',
      subheadline: 'Escolha o procedimento, tire dúvidas e solicite avaliação pelo WhatsApp.',
      cta: 'Agendar avaliação',
      secondaryCta: 'Ver procedimentos',
      aboutTitle: 'Atendimento humanizado e profissional',
      aboutText: 'Organize procedimentos, orientações, pacotes e acompanhamento de clientes.',
      servicesTitle: 'Procedimentos em destaque',
      contactTitle: 'Fale com a clínica',
      whatsappMessage: 'Olá! Vim pelo site e quero saber mais sobre procedimentos.',
      promoTitle: 'Pacotes especiais',
      promoText: 'Apresente combos e sessões com clareza e elegância.',
    },
    features: [
      { titulo: 'Avaliação guiada', texto: 'Capture necessidade, histórico e objetivo do cliente.' },
      { titulo: 'Pacotes e sessões', texto: 'Mostre opções de tratamento e recorrência.' },
      { titulo: 'Orientações claras', texto: 'Deixe dúvidas frequentes respondidas no site.' },
    ],
    benefits: [
      { titulo: 'Mais confiança', texto: 'Explicações reduzem insegurança antes do contato.' },
      { titulo: 'Atendimento qualificado', texto: 'Cliente chega sabendo o que deseja.' },
      { titulo: 'Mais pacotes vendidos', texto: 'Destaque benefícios de sessões e combos.' },
    ],
    faq: [
      { pergunta: 'Precisa avaliação?', resposta: 'Alguns procedimentos exigem avaliação prévia.' },
      { pergunta: 'Quantas sessões são necessárias?', resposta: 'Depende do procedimento e objetivo.' },
      { pergunta: 'Há contraindicações?', resposta: 'Podem existir. Informe histórico e restrições no atendimento.' },
    ],
    testimonials: [
      { nome: 'Cliente', texto: 'Consegui entender melhor o procedimento antes de agendar.' },
      { nome: 'Cliente de pacote', texto: 'O site deixou as opções muito mais claras.' },
    ],
    gallery: [
      { titulo: 'Facial', texto: 'Limpeza, revitalização e cuidados.', tipo: 'face' },
      { titulo: 'Corporal', texto: 'Massagens, drenagem e tratamentos.', tipo: 'body' },
      { titulo: 'Pacotes', texto: 'Sessões combinadas para resultados melhores.', tipo: 'package' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Parcelamento'],
    deliveryOptions: ['Atendimento agendado', 'Avaliação presencial'],
    keywords: ['estética', 'beleza', 'procedimentos', 'avaliação'],
  },
  {
    id: 'oficina',
    nome: 'Oficina automotiva',
    segmento: 'Oficina',
    descricao: 'Site para diagnóstico, serviços, peças, orçamento e acompanhamento.',
    arte: 'auto',
    paleta: { primary: '#1f2937', accent: '#ef4444', background: '#f9fafb', text: '#111827', card: '#ffffff' },
    conteudo: {
      badge: 'Serviços automotivos',
      headline: 'Diagnóstico, manutenção e orçamento sem enrolação',
      subheadline: 'Informe veículo, defeito e urgência para receber atendimento organizado.',
      cta: 'Solicitar orçamento',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Oficina com processo claro',
      aboutText: 'Organize diagnóstico, peças, mão de obra, prazos e status do veículo.',
      servicesTitle: 'Serviços mais procurados',
      contactTitle: 'Fale com a oficina',
      whatsappMessage: 'Olá! Vim pelo site e preciso de orçamento para meu veículo.',
      promoTitle: 'Revisão com orçamento claro',
      promoText: 'Evite conversa perdida e registre todos os detalhes do serviço.',
    },
    features: [
      { titulo: 'Triagem do veículo', texto: 'Modelo, ano, defeito, fotos e urgência.' },
      { titulo: 'Peças e mão de obra', texto: 'Proposta com itens separados e condições.' },
      { titulo: 'Status do serviço', texto: 'Acompanhe diagnóstico, peça, execução e entrega.' },
    ],
    benefits: [
      { titulo: 'Menos retrabalho', texto: 'Informações técnicas ficam documentadas.' },
      { titulo: 'Mais confiança', texto: 'Orçamento detalhado reduz objeções.' },
      { titulo: 'Cliente informado', texto: 'Status reduz mensagens repetidas.' },
    ],
    faq: [
      { pergunta: 'Precisa levar o veículo?', resposta: 'Para diagnóstico preciso, geralmente sim.' },
      { pergunta: 'Trabalham com peças?', resposta: 'A oficina pode orientar opções de peças conforme o serviço.' },
      { pergunta: 'Tem garantia?', resposta: 'A garantia varia conforme serviço e peça utilizada.' },
    ],
    testimonials: [
      { nome: 'Cliente', texto: 'Recebi o orçamento organizado e entendi o serviço.' },
      { nome: 'Cliente de revisão', texto: 'Ficou simples acompanhar o andamento.' },
    ],
    gallery: [
      { titulo: 'Revisão', texto: 'Manutenção preventiva e check-up.', tipo: 'car' },
      { titulo: 'Freios', texto: 'Serviços essenciais de segurança.', tipo: 'brake' },
      { titulo: 'Suspensão', texto: 'Diagnóstico e reparos especializados.', tipo: 'tool' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Atendimento na oficina', 'Retirada combinada'],
    keywords: ['oficina', 'mecânica', 'revisão', 'carro'],
  },
  {
    id: 'loja',
    nome: 'Loja local',
    segmento: 'Loja local',
    descricao: 'Site para produtos, catálogo, retirada, entrega e promoções.',
    arte: 'retail',
    paleta: { primary: '#172554', accent: '#f59e0b', background: '#eff6ff', text: '#0f172a', card: '#ffffff' },
    conteudo: {
      badge: 'Loja local online',
      headline: 'Produtos, ofertas e atendimento em um só lugar',
      subheadline: 'Mostre produtos, receba pedidos e direcione clientes para o WhatsApp.',
      cta: 'Comprar pelo WhatsApp',
      secondaryCta: 'Ver produtos',
      aboutTitle: 'Sua loja com presença digital',
      aboutText: 'Transforme catálogo, promoções e atendimento local em uma experiência simples.',
      servicesTitle: 'Produtos em destaque',
      contactTitle: 'Fale com a loja',
      whatsappMessage: 'Olá! Vim pelo site e quero saber mais sobre os produtos.',
      promoTitle: 'Promoções em destaque',
      promoText: 'Use o site para divulgar ofertas e aumentar movimento na loja.',
    },
    features: [
      { titulo: 'Catálogo simples', texto: 'Produtos, preços, fotos e categorias.' },
      { titulo: 'Pedido por WhatsApp', texto: 'Cliente escolhe e chama com contexto.' },
      { titulo: 'Promoções', texto: 'Destaque campanhas e kits.' },
    ],
    benefits: [
      { titulo: 'Mais alcance', texto: 'O cliente vê a loja antes de chamar.' },
      { titulo: 'Atendimento mais rápido', texto: 'O pedido chega organizado.' },
      { titulo: 'Venda local', texto: 'Integra balcão, vitrine, Instagram e QR Code.' },
    ],
    faq: [
      { pergunta: 'Tem entrega?', resposta: 'A entrega depende da região e disponibilidade.' },
      { pergunta: 'Posso retirar na loja?', resposta: 'Sim, combine o horário pelo atendimento.' },
      { pergunta: 'Os preços estão atualizados?', resposta: 'Confirme disponibilidade no WhatsApp antes de finalizar.' },
    ],
    testimonials: [
      { nome: 'Cliente', texto: 'Achei o produto e falei direto com a loja.' },
      { nome: 'Cliente local', texto: 'O catálogo facilitou bastante.' },
    ],
    gallery: [
      { titulo: 'Produtos', texto: 'Itens organizados por categoria.', tipo: 'bag' },
      { titulo: 'Ofertas', texto: 'Campanhas e kits promocionais.', tipo: 'sale' },
      { titulo: 'Retirada', texto: 'Compra online com retirada local.', tipo: 'store' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Retirada', 'Entrega local'],
    keywords: ['loja', 'catálogo', 'produtos', 'promoção'],
  },
  {
    id: 'servicos',
    nome: 'Prestador de serviço',
    segmento: 'Prestador de serviço',
    descricao: 'Site versátil para serviços locais, visitas técnicas e orçamentos.',
    arte: 'services',
    paleta: { primary: '#064e3b', accent: '#10b981', background: '#ecfdf5', text: '#052e2b', card: '#ffffff' },
    conteudo: {
      badge: 'Serviços sob medida',
      headline: 'Solicite orçamento com clareza e rapidez',
      subheadline: 'Descreva o serviço, envie fotos e receba uma proposta organizada.',
      cta: 'Solicitar orçamento',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Atendimento profissional para serviços locais',
      aboutText: 'Ideal para quem atende por orçamento, visita técnica, agenda e execução personalizada.',
      servicesTitle: 'Serviços disponíveis',
      contactTitle: 'Fale com a equipe',
      whatsappMessage: 'Olá! Vim pelo site e quero solicitar um orçamento.',
      promoTitle: 'Orçamento sem troca infinita de mensagens',
      promoText: 'O cliente já informa detalhes importantes antes do atendimento.',
    },
    features: [
      { titulo: 'Briefing do serviço', texto: 'Perguntas guiam o cliente e reduzem dúvidas.' },
      { titulo: 'Fotos e observações', texto: 'Receba contexto antes de precificar.' },
      { titulo: 'Visita técnica', texto: 'Organize agenda, endereço e prazo.' },
    ],
    benefits: [
      { titulo: 'Mais profissional', texto: 'Proposta clara passa segurança.' },
      { titulo: 'Menos confusão', texto: 'Escopo e observações ficam registrados.' },
      { titulo: 'Mais conversão', texto: 'O cliente entende o próximo passo.' },
    ],
    faq: [
      { pergunta: 'Precisa visita técnica?', resposta: 'Depende do tipo de serviço e das informações enviadas.' },
      { pergunta: 'Atendem minha região?', resposta: 'Informe seu bairro/cidade para confirmação.' },
      { pergunta: 'Como recebo o orçamento?', resposta: 'Você recebe pelo WhatsApp ou por link profissional.' },
    ],
    testimonials: [
      { nome: 'Cliente', texto: 'Consegui explicar o serviço com fotos e observações.' },
      { nome: 'Cliente residencial', texto: 'O orçamento ficou bem mais claro.' },
    ],
    gallery: [
      { titulo: 'Manutenção', texto: 'Serviços recorrentes e emergenciais.', tipo: 'tool' },
      { titulo: 'Instalação', texto: 'Projetos e instalações locais.', tipo: 'install' },
      { titulo: 'Visita técnica', texto: 'Avaliação antes da proposta final.', tipo: 'visit' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Dinheiro'],
    deliveryOptions: ['Visita técnica', 'Atendimento presencial', 'Atendimento online'],
    keywords: ['prestador de serviço', 'orçamento', 'serviços locais'],
  },
  {
    id: 'vidracaria',
    nome: 'Vidraçaria',
    segmento: 'Vidraçaria',
    descricao: 'Site para vidros, box, espelhos, medição e instalação.',
    arte: 'glass',
    paleta: { primary: '#075985', accent: '#38bdf8', background: '#f0f9ff', text: '#082f49', card: '#ffffff' },
    conteudo: {
      badge: 'Vidros sob medida',
      headline: 'Box, espelhos e vidros com orçamento por medida',
      subheadline: 'Envie medidas, fotos e endereço para receber uma proposta profissional.',
      cta: 'Pedir orçamento',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Soluções em vidro com acabamento profissional',
      aboutText: 'Atendemos projetos sob medida com medição, produção e instalação.',
      servicesTitle: 'Soluções em vidro',
      contactTitle: 'Fale com a vidraçaria',
      whatsappMessage: 'Olá! Vim pelo site e quero orçamento de vidro.',
      promoTitle: 'Medidas e instalação organizadas',
      promoText: 'Receba pedidos mais completos com fotos, medidas e local de instalação.',
    },
    features: [
      { titulo: 'Orçamento por medida', texto: 'Campos para largura, altura e tipo de vidro.' },
      { titulo: 'Fotos do local', texto: 'Cliente pode enviar referência para análise.' },
      { titulo: 'Instalação', texto: 'Controle prazo e etapa de instalação.' },
    ],
    benefits: [
      { titulo: 'Menos erro de medida', texto: 'Campos guiados reduzem conversa solta.' },
      { titulo: 'Mais clareza', texto: 'Tipo, espessura e instalação ficam visíveis.' },
      { titulo: 'Mais confiança', texto: 'Site técnico e visual passa segurança.' },
    ],
    faq: [
      { pergunta: 'A medida precisa ser exata?', resposta: 'A medida inicial ajuda no orçamento, mas pode ser confirmada em visita.' },
      { pergunta: 'Fazem instalação?', resposta: 'Sim, quando disponível na região.' },
      { pergunta: 'Qual prazo médio?', resposta: 'Depende do tipo de vidro e complexidade.' },
    ],
    testimonials: [{ nome: 'Cliente', texto: 'Enviei as medidas e recebi proposta bem explicada.' }],
    gallery: [
      { titulo: 'Box', texto: 'Banheiro com vidro sob medida.', tipo: 'glass' },
      { titulo: 'Espelhos', texto: 'Ambientes residenciais e comerciais.', tipo: 'mirror' },
      { titulo: 'Janelas', texto: 'Projetos com instalação.', tipo: 'window' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal'],
    deliveryOptions: ['Medição', 'Instalação', 'Retirada'],
    keywords: ['vidraçaria', 'box', 'espelho', 'vidro'],
  },
  {
    id: 'serralheria',
    nome: 'Serralheria',
    segmento: 'Serralheria',
    descricao: 'Site para portões, grades, estruturas e soldas.',
    arte: 'metal',
    paleta: { primary: '#27272a', accent: '#f97316', background: '#fafafa', text: '#18181b', card: '#ffffff' },
    conteudo: {
      badge: 'Metal, estrutura e fabricação',
      headline: 'Portões, grades e estruturas com orçamento sob medida',
      subheadline: 'Envie medidas, fotos e prazo para receber proposta clara.',
      cta: 'Solicitar orçamento',
      secondaryCta: 'Ver serviços',
      aboutTitle: 'Serralheria com fabricação organizada',
      aboutText: 'Fabricamos e instalamos soluções metálicas para casas, empresas e obras.',
      servicesTitle: 'Serviços de serralheria',
      contactTitle: 'Fale com a serralheria',
      whatsappMessage: 'Olá! Vim pelo site e preciso de orçamento de serralheria.',
      promoTitle: 'Fabricação sob medida',
      promoText: 'Controle medida, material, prazo, sinal e instalação.',
    },
    features: [
      { titulo: 'Medidas e fotos', texto: 'Receba dados antes da visita.' },
      { titulo: 'Materiais', texto: 'Organize opções de ferro, alumínio, pintura e acabamento.' },
      { titulo: 'Instalação', texto: 'Prazo e responsável por etapa.' },
    ],
    benefits: [
      { titulo: 'Orçamento mais rápido', texto: 'Cliente já manda contexto.' },
      { titulo: 'Produção controlada', texto: 'Pedido vira fila de fabricação.' },
      { titulo: 'Mais confiança', texto: 'Proposta profissional reduz negociação confusa.' },
    ],
    faq: [{ pergunta: 'Fazem visita?', resposta: 'Sim, quando necessário para confirmar medidas e instalação.' }],
    testimonials: [{ nome: 'Cliente', texto: 'O orçamento por foto e medida agilizou bastante.' }],
    gallery: [
      { titulo: 'Portões', texto: 'Projetos residenciais e comerciais.', tipo: 'gate' },
      { titulo: 'Grades', texto: 'Segurança e acabamento.', tipo: 'bars' },
      { titulo: 'Estruturas', texto: 'Coberturas e peças metálicas.', tipo: 'structure' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal'],
    deliveryOptions: ['Visita técnica', 'Instalação'],
    keywords: ['serralheria', 'portão', 'grade', 'solda'],
  },
  {
    id: 'moveis',
    nome: 'Móveis planejados',
    segmento: 'Móveis planejados',
    descricao: 'Site para ambientes, projetos, medição e proposta premium.',
    arte: 'interior',
    paleta: { primary: '#3f2a1d', accent: '#a16207', background: '#fefce8', text: '#2c1810', card: '#ffffff' },
    conteudo: {
      badge: 'Ambientes planejados',
      headline: 'Móveis sob medida para transformar seu ambiente',
      subheadline: 'Envie referências, medidas e estilo desejado para iniciar sua proposta.',
      cta: 'Solicitar projeto',
      secondaryCta: 'Ver ambientes',
      aboutTitle: 'Projetos planejados com acabamento e organização',
      aboutText: 'Atendemos ambientes residenciais e comerciais com projeto, fabricação e instalação.',
      servicesTitle: 'Ambientes planejados',
      contactTitle: 'Fale com o projetista',
      whatsappMessage: 'Olá! Vim pelo site e quero orçamento de móveis planejados.',
      promoTitle: 'Projeto com proposta profissional',
      promoText: 'Transforme referências soltas em orçamento e etapas claras.',
    },
    features: [
      { titulo: 'Briefing por ambiente', texto: 'Cozinha, quarto, sala, banheiro e comercial.' },
      { titulo: 'Referências e medidas', texto: 'Cliente envia fotos e preferências.' },
      { titulo: 'Etapas do projeto', texto: 'Medição, proposta, fabricação e instalação.' },
    ],
    benefits: [
      { titulo: 'Venda consultiva', texto: 'O cliente percebe valor antes do preço.' },
      { titulo: 'Menos retrabalho', texto: 'Referências e medidas ficam salvas.' },
      { titulo: 'Premium', texto: 'Site bonito combina com ticket maior.' },
    ],
    faq: [{ pergunta: 'Precisa medir o ambiente?', resposta: 'Sim, as medidas finais são importantes para fechar projeto e produção.' }],
    testimonials: [{ nome: 'Cliente', texto: 'Consegui mandar referências e receber proposta organizada.' }],
    gallery: [
      { titulo: 'Cozinhas', texto: 'Ambientes funcionais sob medida.', tipo: 'kitchen' },
      { titulo: 'Quartos', texto: 'Guarda-roupas e painéis.', tipo: 'bedroom' },
      { titulo: 'Comercial', texto: 'Móveis para lojas e escritórios.', tipo: 'office' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Entrada + parcelas'],
    deliveryOptions: ['Medição', 'Projeto', 'Instalação'],
    keywords: ['móveis planejados', 'marcenaria', 'cozinha planejada'],
  },
  {
    id: 'eventos',
    nome: 'Eventos e festas',
    segmento: 'Eventos',
    descricao: 'Site para decoração, buffet, aluguel, pacotes e datas disponíveis.',
    arte: 'events',
    paleta: { primary: '#4c1d95', accent: '#facc15', background: '#faf5ff', text: '#2e1065', card: '#ffffff' },
    conteudo: {
      badge: 'Eventos memoráveis',
      headline: 'Pacotes, decoração e serviços para seu evento',
      subheadline: 'Informe data, local, quantidade de pessoas e estilo para receber uma proposta.',
      cta: 'Solicitar proposta',
      secondaryCta: 'Ver pacotes',
      aboutTitle: 'Organização para eventos especiais',
      aboutText: 'Atendemos festas, empresas, casamentos, aniversários e eventos personalizados.',
      servicesTitle: 'Pacotes e serviços',
      contactTitle: 'Fale com a equipe',
      whatsappMessage: 'Olá! Vim pelo site e quero orçamento para evento.',
      promoTitle: 'Evento com proposta clara',
      promoText: 'Organize data, local, itens e condições sem perder detalhes.',
    },
    features: [
      { titulo: 'Briefing de evento', texto: 'Data, local, convidados, estilo e orçamento.' },
      { titulo: 'Pacotes', texto: 'Destaque opções prontas e serviços adicionais.' },
      { titulo: 'Checklist', texto: 'Transforme proposta em execução organizada.' },
    ],
    benefits: [
      { titulo: 'Mais conversão', texto: 'Pacotes bem explicados facilitam decisão.' },
      { titulo: 'Menos detalhe perdido', texto: 'Tudo fica registrado antes do orçamento.' },
      { titulo: 'Experiência premium', texto: 'Site bonito valoriza o serviço.' },
    ],
    faq: [{ pergunta: 'Com quanto tempo devo reservar?', resposta: 'Quanto antes, melhor para garantir data e equipe.' }],
    testimonials: [{ nome: 'Cliente', texto: 'O orçamento ficou completo e fácil de aprovar.' }],
    gallery: [
      { titulo: 'Festas', texto: 'Decoração, buffet e estrutura.', tipo: 'party' },
      { titulo: 'Corporativo', texto: 'Eventos para empresas.', tipo: 'corporate' },
      { titulo: 'Pacotes', texto: 'Opções fechadas para facilitar escolha.', tipo: 'package' },
    ],
    paymentMethods: ['Pix', 'Cartão', 'Sinal'],
    deliveryOptions: ['Montagem no local', 'Retirada', 'Equipe no evento'],
    keywords: ['eventos', 'festas', 'decoração', 'buffet'],
  },
]

export function getSiteTemplate(id?: string | null) {
  return siteTemplates.find((template) => template.id === id) || siteTemplates[0]
}

export function templateToCompanyPatch(id: string) {
  const template = getSiteTemplate(id)

  return {
    site_template: template.id,
    site_art_style: template.arte,
    site_primary_color: template.paleta.primary,
    site_accent_color: template.paleta.accent,
    site_background_color: template.paleta.background,
    site_text_color: template.paleta.text,
    site_card_color: template.paleta.card,
    site_badge_text: template.conteudo.badge,
    site_headline: template.conteudo.headline,
    site_subheadline: template.conteudo.subheadline,
    site_cta_text: template.conteudo.cta,
    site_secondary_cta_text: template.conteudo.secondaryCta,
    site_about_title: template.conteudo.aboutTitle,
    site_about_text: template.conteudo.aboutText,
    site_services_title: template.conteudo.servicesTitle,
    site_contact_title: template.conteudo.contactTitle,
    site_whatsapp_message: template.conteudo.whatsappMessage,
    site_promo_title: template.conteudo.promoTitle,
    site_promo_text: template.conteudo.promoText,
    site_features: template.features,
    site_benefits: template.benefits,
    site_faq: template.faq,
    site_testimonials: template.testimonials,
    site_gallery: template.gallery,
    site_payment_methods: template.paymentMethods,
    site_delivery_options: template.deliveryOptions,
    site_keywords: template.keywords,
    site_seo_title: template.conteudo.headline,
    site_seo_description: template.conteudo.subheadline,
    segmento: template.segmento,
    modelo_nome: template.nome,
  }
}
