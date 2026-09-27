/**
 * Orçaly Next — Product Landing content contracts (isolated).
 *
 * Content rules (enforced by scripts/test-orcaly-next-registry.mjs):
 *  - No customer counts, revenue, market share, ratings or testimonials.
 *  - Features are LIVE only when a route exists today; everything else is PLANNED.
 *  - Integrations listed only with a code path as evidence; otherwise omitted.
 *  - Prices are never written here. Business points to its existing plan source.
 *  - Screenshots are PLACEHOLDER until captured from a certified Preview.
 */

import type { RegistryProductId } from './product-registry'

export type FeatureStatus = 'LIVE' | 'PLANNED'
export type LandingFeature = { title: string; detail: string; status: FeatureStatus; evidence?: string }
export type LandingIntegration = { name: string; status: 'IMPLEMENTED' | 'FROZEN' | 'NOT_CONFIGURED'; evidence: string }
export type ScreenshotSlot = { id: string; caption: string; status: 'PLACEHOLDER'; captureFrom: string | null }

export type LandingContent = {
  productId: Exclude<RegistryProductId, 'one'>
  hero: { eyebrow: string; title: string; lead: string }
  valueProposition: string
  problems: readonly string[]
  features: readonly LandingFeature[]
  workflow: readonly { step: string; detail: string }[]
  screenshots: readonly ScreenshotSlot[]
  integrations: readonly LandingIntegration[]
  pricing: { status: 'PUBLISHED_ELSEWHERE'; source: string } | { status: 'NOT_PUBLISHED' }
  trial: { status: 'NOT_CONFIGURED' }
  cta: { primary: string; secondary: string }
  oneAlternative: { status: 'UNDECIDED'; copy: string }
  faq: readonly { question: string; answer: string }[]
  trust: readonly string[]
}

const ONE_UNDECIDED = { status: 'UNDECIDED' as const, copy: 'O Orçaly One reunirá produtos em uma assinatura. A composição e o preço ainda não foram publicados.' }
const TRIAL_NONE = { status: 'NOT_CONFIGURED' as const }
const NOT_PUBLISHED = { status: 'NOT_PUBLISHED' as const }
const FAQ_INDEPENDENT = { question: 'Preciso assinar outro produto Orçaly antes?', answer: 'Não. Cada produto é independente; nenhum é pré-requisito do outro.' }
const FAQ_NO_DATE = { question: 'Quando fica disponível?', answer: 'Ainda não há data publicada. Esta página descreve a proposta, não recursos contratáveis.' }
const TRUST_CONTEXT = 'Seus dados pessoais e os da sua empresa ficam em contextos separados.'
const TRUST_CONSENT = 'Nenhum dado é compartilhado entre produtos sem o seu consentimento explícito e revogável.'

function screenshots(productId: string, captureFrom: string | null, captions: readonly string[]): ScreenshotSlot[] {
  return captions.map((caption, index) => ({ id: `${productId}-shot-${index + 1}`, caption, status: 'PLACEHOLDER', captureFrom }))
}

export const landingContent: readonly LandingContent[] = [
  {
    productId: 'business',
    hero: { eyebrow: 'Orçaly Business', title: 'Seu negócio em movimento.', lead: 'Do primeiro contato à entrega: clientes, propostas, pedidos e financeiro na mesma operação.' },
    valueProposition: 'Uma operação conectada, adaptada ao tipo do seu negócio, com uma visão executiva do dia.',
    problems: ['Pedidos espalhados entre conversas e planilhas.', 'Pouca visibilidade do que precisa de atenção hoje.', 'Financeiro desconectado da operação.'],
    features: [
      { title: 'Pedidos e produção', detail: 'Acompanhe cada pedido até a entrega.', status: 'LIVE', evidence: 'app/painel/pedidos' },
      { title: 'Clientes e propostas', detail: 'Histórico do cliente e propostas no mesmo lugar.', status: 'LIVE', evidence: 'app/painel/clientes' },
      { title: 'Catálogo', detail: 'Produtos e serviços organizados.', status: 'LIVE', evidence: 'app/painel/catalogo' },
      { title: 'Entregas', detail: 'Central de entregas e histórico.', status: 'LIVE', evidence: 'app/painel/entregas' },
      { title: 'Financeiro', detail: 'Entradas, saídas, contas a pagar e a receber.', status: 'LIVE', evidence: 'app/painel/financeiro' },
      { title: 'Site e loja', detail: 'Presença digital da empresa.', status: 'LIVE', evidence: 'app/painel/site' },
      { title: 'Company Operating Brief', detail: 'Visão executiva do dia.', status: 'PLANNED' },
    ],
    workflow: [
      { step: 'Contato', detail: 'O cliente chega pelo site ou orçamento.' },
      { step: 'Proposta', detail: 'Você envia e acompanha a aprovação.' },
      { step: 'Pedido', detail: 'Produção e entrega com status visível.' },
      { step: 'Financeiro', detail: 'O recebimento entra no fluxo de caixa.' },
    ],
    screenshots: screenshots('business', '/painel/inicio', ['Início do painel', 'Pedidos', 'Financeiro']),
    integrations: [
      { name: 'Google Agenda', status: 'IMPLEMENTED', evidence: 'lib/integrations/google/calendar.ts' },
      { name: 'E-mail transacional (Resend)', status: 'IMPLEMENTED', evidence: 'lib/integrations/email/resend.ts' },
      { name: 'Mercado Pago', status: 'IMPLEMENTED', evidence: 'lib/mercado-pago.ts' },
      { name: 'WhatsApp', status: 'FROZEN', evidence: 'docs/execution/NEXT_CODEX_HANDOFF.md' },
    ],
    pricing: { status: 'PUBLISHED_ELSEWHERE', source: 'lib/marketing/main-site.ts#marketingPlans' },
    trial: TRIAL_NONE,
    cta: { primary: 'Conhecer os planos', secondary: 'Acessar minha conta' },
    oneAlternative: ONE_UNDECIDED,
    faq: [FAQ_INDEPENDENT, { question: 'O painel se adapta ao meu segmento?', answer: 'Sim. Módulos e navegação variam conforme o tipo de negócio configurado.' }],
    trust: [TRUST_CONTEXT, 'Permissões por membro da equipe.', TRUST_CONSENT],
  },
  {
    productId: 'wealth',
    hero: { eyebrow: 'Orçaly Wealth', title: 'Mais clareza para as escolhas que constroem seu futuro.', lead: 'Sua vida financeira, metas e patrimônio no mesmo horizonte — com o que você declarou, sem números inventados.' },
    valueProposition: 'Um espaço pessoal, calmo e explicável: cada indicador mostra fonte, período e limitação.',
    problems: ['Não saber o próprio patrimônio líquido.', 'Contas e compromissos dispersos.', 'Metas sem um plano visível.'],
    features: [
      { title: 'Briefing do dia', detail: 'Observe, entenda e aja com base nos seus registros.', status: 'LIVE', evidence: 'app/apps/wealth/briefing' },
      { title: 'Patrimônio líquido', detail: 'Ativos, passivos, liquidez e composição.', status: 'LIVE', evidence: 'app/apps/wealth/patrimonio' },
      { title: 'Carteiras', detail: 'Posições, movimentos, alocação e cenários.', status: 'LIVE', evidence: 'app/apps/wealth/carteiras' },
      { title: 'Central de dívidas', detail: 'Simulações de quitação sem executar pagamentos.', status: 'LIVE', evidence: 'app/apps/wealth/dividas' },
      { title: 'Metas e planejamento', detail: 'Metas, aportes e planos de vida como simulação.', status: 'LIVE', evidence: 'app/apps/wealth/metas' },
      { title: 'Cofre de documentos', detail: 'Armazenamento privado, sem link público.', status: 'LIVE', evidence: 'app/apps/wealth/documentos' },
      { title: 'Impostos declarados', detail: 'Organiza fatos fiscais; não calcula imposto.', status: 'LIVE', evidence: 'app/apps/wealth/impostos' },
      { title: 'Família com consentimento', detail: 'Compartilhamento explícito, por registro, revogável.', status: 'LIVE', evidence: 'app/apps/wealth/familia' },
      { title: 'Alertas', detail: 'Avisos factuais com prioridade e adiamento.', status: 'PLANNED' },
      { title: 'Ask Wealth', detail: 'Perguntas sobre seus dados, com fonte e limitações.', status: 'PLANNED' },
    ],
    workflow: [
      { step: 'Registre', detail: 'Receitas, despesas, ativos e passivos.' },
      { step: 'Entenda', detail: 'Indicadores explicados, sem pontuação arbitrária.' },
      { step: 'Planeje', detail: 'Metas e simulações com premissas visíveis.' },
    ],
    screenshots: screenshots('wealth', '/apps/wealth', ['Visão geral', 'Patrimônio', 'Calendário']),
    integrations: [
      { name: 'Cotações de mercado', status: 'NOT_CONFIGURED', evidence: 'lib/orcaly-next/product-registry.ts#wealth.externalDependencies' },
      { name: 'Open Finance', status: 'NOT_CONFIGURED', evidence: 'lib/orcaly-next/product-registry.ts#wealth.externalDependencies' },
    ],
    pricing: NOT_PUBLISHED,
    trial: TRIAL_NONE,
    cta: { primary: 'Consultar meu acesso', secondary: 'Acessar minha conta' },
    oneAlternative: ONE_UNDECIDED,
    faq: [
      FAQ_INDEPENDENT,
      { question: 'O Wealth recomenda investimentos?', answer: 'Não. Aconselhamento regulado e execução de operações não estão habilitados.' },
      { question: 'Minha empresa vê meus dados pessoais?', answer: 'Não. O Wealth usa o contexto pessoal, separado do empresarial.' },
    ],
    trust: [TRUST_CONTEXT, TRUST_CONSENT, 'Documentos em armazenamento privado, sem URL pública.'],
  },
  {
    productId: 'growth',
    hero: { eyebrow: 'Orçaly Growth · Em desenvolvimento', title: 'Entenda o que faz seu negócio crescer.', lead: 'Uma proposta de Experiment OS: hipóteses, testes e aprendizados em um só lugar.' },
    valueProposition: 'Decisões de aquisição baseadas em experimentos, com incerteza explícita.',
    problems: ['Campanhas sem hipótese clara.', 'Resultados sem comparação com um controle.', 'Aprendizados que se perdem.'],
    features: [
      { title: 'Quadro de experimentos', detail: 'Hipótese, métrica e status de cada teste.', status: 'PLANNED' },
      { title: 'Leitura de resultados', detail: 'Controle × variante com intervalo visível.', status: 'PLANNED' },
      { title: 'Diário de aprendizados', detail: 'O que funcionou e o que não funcionou.', status: 'PLANNED' },
    ],
    workflow: [{ step: 'Hipótese', detail: 'O que você acredita e como medir.' }, { step: 'Teste', detail: 'Execute com um grupo de controle.' }, { step: 'Aprenda', detail: 'Registre o resultado e a decisão.' }],
    screenshots: screenshots('growth', null, ['Quadro de experimentos']),
    integrations: [], pricing: NOT_PUBLISHED, trial: TRIAL_NONE,
    cta: { primary: 'Acompanhar novidades', secondary: 'Ver produtos disponíveis' },
    oneAlternative: ONE_UNDECIDED, faq: [FAQ_NO_DATE, FAQ_INDEPENDENT], trust: [TRUST_CONTEXT, TRUST_CONSENT],
  },
  {
    productId: 'flow',
    hero: { eyebrow: 'Orçaly Flow · Em desenvolvimento', title: 'Menos tarefas repetidas. Mais espaço para criar.', lead: 'Uma proposta de automação visual e em linguagem natural, com aprovação humana.' },
    valueProposition: 'Automatizar com segurança: permissões, histórico e aprovação antes de executar.',
    problems: ['Tarefas manuais repetidas.', 'Automações que ninguém entende depois.', 'Medo de uma automação agir sem supervisão.'],
    features: [
      { title: 'Construtor visual', detail: 'Monte fluxos conectando etapas.', status: 'PLANNED' },
      { title: 'Linguagem natural', detail: 'Descreva o fluxo e revise o rascunho.', status: 'PLANNED' },
      { title: 'Aprovação e histórico', detail: 'Nada crítico executa sem aprovação.', status: 'PLANNED' },
    ],
    workflow: [{ step: 'Descreva', detail: 'Diga o que precisa acontecer.' }, { step: 'Revise', detail: 'Ajuste o fluxo no canvas.' }, { step: 'Aprove', detail: 'Ative com permissões definidas.' }],
    screenshots: screenshots('flow', null, ['Canvas do fluxo']),
    integrations: [], pricing: NOT_PUBLISHED, trial: TRIAL_NONE,
    cta: { primary: 'Acompanhar novidades', secondary: 'Ver produtos disponíveis' },
    oneAlternative: ONE_UNDECIDED, faq: [FAQ_NO_DATE, FAQ_INDEPENDENT], trust: [TRUST_CONTEXT, TRUST_CONSENT, 'Execuções sensíveis exigirão aprovação humana.'],
  },
  {
    productId: 'academy',
    hero: { eyebrow: 'Orçaly Academy · Em desenvolvimento', title: 'Conhecimento que acompanha a sua curiosidade.', lead: 'Uma proposta de biblioteca, trilhas e leitura no seu ritmo.' },
    valueProposition: 'Aprender com continuidade, com conteúdo licenciado e notas pessoais privadas.',
    problems: ['Conteúdo disperso.', 'Dificuldade de manter constância.', 'Anotações perdidas.'],
    features: [
      { title: 'Biblioteca', detail: 'Conteúdos organizados por tema.', status: 'PLANNED' },
      { title: 'Trilhas', detail: 'Sequências de aprendizado.', status: 'PLANNED' },
      { title: 'Notas de leitura', detail: 'Suas reflexões, privadas.', status: 'PLANNED' },
    ],
    workflow: [{ step: 'Escolha', detail: 'Um tema ou trilha.' }, { step: 'Leia', detail: 'No seu ritmo.' }, { step: 'Registre', detail: 'Notas e próximos passos.' }],
    screenshots: screenshots('academy', null, ['Biblioteca']),
    integrations: [], pricing: NOT_PUBLISHED, trial: TRIAL_NONE,
    cta: { primary: 'Acompanhar novidades', secondary: 'Ver produtos disponíveis' },
    oneAlternative: ONE_UNDECIDED, faq: [FAQ_NO_DATE, FAQ_INDEPENDENT], trust: [TRUST_CONTEXT, TRUST_CONSENT],
  },
  {
    productId: 'market',
    hero: { eyebrow: 'Orçaly Market · Em desenvolvimento', title: 'Encontre a próxima possibilidade.', lead: 'Uma proposta orientada a problemas: diga o que precisa resolver e compare soluções.' },
    valueProposition: 'Do problema à solução, com transparência sobre qualquer relação comercial.',
    problems: ['Catálogos genéricos que não respondem ao seu problema.', 'Dificuldade de comparar opções.', 'Falta de transparência em indicações.'],
    features: [
      { title: 'Busca por problema', detail: 'Comece pelo que você precisa resolver.', status: 'PLANNED' },
      { title: 'Comparador', detail: 'Critérios de adequação lado a lado.', status: 'PLANNED' },
      { title: 'Transparência', detail: 'Relações comerciais sempre declaradas.', status: 'PLANNED' },
    ],
    workflow: [{ step: 'Descreva', detail: 'O problema a resolver.' }, { step: 'Compare', detail: 'Soluções adequadas.' }, { step: 'Decida', detail: 'Com critérios claros.' }],
    screenshots: screenshots('market', null, ['Busca por problema']),
    integrations: [], pricing: NOT_PUBLISHED, trial: TRIAL_NONE,
    cta: { primary: 'Acompanhar novidades', secondary: 'Ver produtos disponíveis' },
    oneAlternative: ONE_UNDECIDED, faq: [FAQ_NO_DATE, FAQ_INDEPENDENT], trust: [TRUST_CONTEXT, 'Relações comerciais com fornecedores serão sempre declaradas.'],
  },
  {
    productId: 'partners',
    hero: { eyebrow: 'Orçaly Partners', title: 'Crescer é melhor quando a gente cresce junto.', lead: 'Indicações, oportunidades e acompanhamento das suas comissões.' },
    valueProposition: 'Um portal profissional para quem distribui o Orçaly.',
    problems: ['Não saber o status de cada indicação.', 'Comissões sem extrato claro.', 'Falta de material para demonstrar.'],
    features: [
      { title: 'Portal do parceiro', detail: 'Indicações e comissões.', status: 'LIVE', evidence: 'app/parceiros/painel' },
      { title: 'Pipeline', detail: 'Oportunidades por etapa.', status: 'LIVE', evidence: 'app/parceiros/pipeline' },
      { title: 'Demonstrações', detail: 'Ambiente de demonstração para apresentar.', status: 'LIVE', evidence: 'app/parceiros/demo' },
    ],
    workflow: [{ step: 'Cadastre-se', detail: 'Crie seu perfil de parceiro.' }, { step: 'Indique', detail: 'Compartilhe seu código.' }, { step: 'Acompanhe', detail: 'Pipeline e comissões.' }],
    screenshots: screenshots('partners', '/parceiros/painel', ['Portal do parceiro']),
    integrations: [], pricing: NOT_PUBLISHED, trial: TRIAL_NONE,
    cta: { primary: 'Quero ser parceiro', secondary: 'Acessar meu portal' },
    oneAlternative: ONE_UNDECIDED,
    faq: [FAQ_INDEPENDENT, { question: 'Como as comissões são exibidas?', answer: 'Com o status de cada uma, conforme as regras do programa vigente.' }],
    trust: [TRUST_CONTEXT, 'Regras do programa publicadas nos termos de parceiros.'],
  },
]

export function getLandingContent(productId: string): LandingContent | undefined {
  return landingContent.find((content) => content.productId === productId)
}
