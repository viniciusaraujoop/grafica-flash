import 'server-only'

import {
  findAssistantPlan,
  findAssistantSolution,
  getAssistantKnowledge,
} from '@/lib/assistant/orcaly-knowledge'
import type {
  AssistantCard,
  AssistantPlanKey,
  AssistantResult,
} from '@/lib/assistant/types'

export const ASSISTANT_TOOL_NAMES = [
  'get_plans',
  'compare_plans',
  'recommend_plan',
  'get_segment_solution',
  'search_features',
  'get_faq',
  'get_demo',
  'start_signup',
  'prepare_whatsapp_handoff',
] as const

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number]

type ToolArgs = Record<string, unknown>

function normalizeText(value: unknown, max = 200) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function money(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function planCard(id: AssistantPlanKey): AssistantCard | null {
  const plan = findAssistantPlan(id)
  if (!plan) return null

  return {
    type: 'plan',
    id: plan.id,
    name: plan.name,
    price: plan.price,
    audience: plan.audience,
    highlights: plan.highlights,
    featured: Boolean(plan.featured),
    action: {
      label: 'Criar conta',
      href: plan.signupHref,
      kind: 'primary',
    },
  }
}

export function recommendPlanDeterministic(input: {
  needs?: unknown
  workflow?: unknown
  automationNeeds?: unknown
  stage?: unknown
}) {
  const text = [input.needs, input.workflow, input.automationNeeds, input.stage]
    .map((item) => normalizeText(item, 300).toLowerCase())
    .join(' ')

  const premiumSignals = [
    'automacao',
    'automação',
    'recuperacao',
    'recuperação',
    'alto volume',
    'muito volume',
    'escala',
    'avancado',
    'avançado',
  ]

  if (premiumSignals.some((signal) => text.includes(signal))) {
    return {
      recommendedPlan: 'premium' as const,
      reasons: [
        'Você indicou necessidade de automação, escala ou recuperação comercial.',
        'Esses recursos pertencem ao nível avançado da oferta atual.',
      ],
      alternatives: ['profissional'] as AssistantPlanKey[],
    }
  }

  const professionalSignals = [
    'proposta',
    'follow-up',
    'followup',
    'relatorio',
    'relatório',
    'crm',
    'equipe',
    'organizar vendas',
    'acompanhar clientes',
    'ja vendo',
    'já vendo',
  ]

  if (professionalSignals.some((signal) => text.includes(signal))) {
    return {
      recommendedPlan: 'profissional' as const,
      reasons: [
        'Sua operação já pede acompanhamento comercial além do básico.',
        'O Intermediário adiciona propostas, follow-up e relatórios operacionais.',
      ],
      alternatives: ['essencial', 'premium'] as AssistantPlanKey[],
    }
  }

  return {
    recommendedPlan: 'essencial' as const,
    reasons: [
      'Você não indicou uma necessidade que exija recursos avançados.',
      'O Básico é o menor plano que cobre presença digital, pedidos e clientes.',
    ],
    alternatives: ['profissional'] as AssistantPlanKey[],
  }
}

export function inferSegmentFromText(value: unknown) {
  const text = normalizeText(value, 500)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const aliases: Array<[string, string]> = [
    ['grafica', 'graficas'],
    ['personalizado', 'graficas'],
    ['restaurante', 'restaurantes'],
    ['delivery', 'restaurantes'],
    ['food', 'restaurantes'],
    ['assistencia', 'assistencia-tecnica'],
    ['conserto', 'assistencia-tecnica'],
    ['loja', 'lojas'],
    ['comercio', 'lojas'],
    ['barbearia', 'barbearias'],
    ['beleza', 'barbearias'],
    ['estetica', 'barbearias'],
    ['evento', 'eventos'],
    ['servico', 'servicos'],
  ]

  return aliases.find(([needle]) => text.includes(needle))?.[1] || null
}

function getPlans(): AssistantResult {
  const knowledge = getAssistantKnowledge()
  const cards = knowledge.plans
    .map((plan) => planCard(plan.id))
    .filter((card): card is AssistantCard => Boolean(card))

  return {
    answer:
      'Hoje o Orçaly tem três níveis. O melhor não é o mais caro: é o menor plano que atende bem sua rotina.',
    suggestions: [
      'Qual plano faz sentido para mim?',
      'O que muda entre Básico e Intermediário?',
      'Tenho uma gráfica',
    ],
    cards,
    source: 'tool',
    tool: 'get_plans',
  }
}

function comparePlans(args: ToolArgs): AssistantResult {
  const knowledge = getAssistantKnowledge()
  const requested = Array.isArray(args.plans)
    ? args.plans.map((item) => findAssistantPlan(item)).filter(Boolean)
    : []
  const plans = requested.length >= 2 ? requested : knowledge.plans

  return {
    answer:
      plans.length === 2
        ? `A diferença principal entre ${plans[0]!.name} e ${plans[1]!.name} está no nível de organização e automação que sua operação precisa.`
        : 'Aqui está a comparação curta dos três planos, usando a configuração comercial atual do Orçaly.',
    suggestions: [
      'Qual plano faz sentido para mim?',
      'Quero ver para meu negócio',
    ],
    cards: [
      {
        type: 'comparison',
        title: 'Comparação de planos',
        plans: plans.map((plan) => ({
          id: plan!.id,
          name: plan!.name,
          price: plan!.price,
          highlights: plan!.highlights,
        })),
      },
    ],
    source: 'tool',
    tool: 'compare_plans',
  }
}

function recommendPlan(args: ToolArgs): AssistantResult {
  const recommendation = recommendPlanDeterministic({
    needs: args.needs,
    workflow: args.workflow,
    automationNeeds: args.automationNeeds,
    stage: args.stage,
  })
  const plan = findAssistantPlan(recommendation.recommendedPlan)!

  return {
    answer: `${plan.name} é o menor plano que faz sentido com o que você descreveu. ${recommendation.reasons.join(' ')}`,
    suggestions: [
      `O que vem no ${plan.name}?`,
      'Comparar com outro plano',
      'Quero testar',
    ],
    action: {
      label: `Criar conta no ${plan.name}`,
      href: plan.signupHref,
      kind: 'primary',
    },
    cards: [planCard(plan.id)!],
    source: 'tool',
    tool: 'recommend_plan',
    recommendedPlan: plan.id,
  }
}

function getSegmentSolution(args: ToolArgs): AssistantResult {
  const solution = findAssistantSolution(args.segment)
  if (!solution) {
    return {
      answer:
        'Consigo adaptar a explicação para gráficas, restaurantes e delivery, lojas, assistência técnica, barbearias/beleza, serviços e eventos. Qual é o seu tipo de negócio?',
      suggestions: ['Gráfica', 'Restaurante/Food', 'Loja'],
      source: 'guided',
      tool: 'get_segment_solution',
    }
  }

  return {
    answer: `${solution.label}: ${solution.description}`,
    suggestions: [
      'Qual plano faz sentido para mim?',
      'Ver demonstração',
      'Quero testar',
    ],
    cards: [
      {
        type: 'flow',
        title: solution.label,
        description: solution.headline,
        steps: solution.workflow,
        features: solution.features,
        demoHref: `/solucoes/${solution.slug}`,
      },
    ],
    action: {
      label: `Ver ${solution.shortLabel}`,
      href: `/solucoes/${solution.slug}`,
    },
    source: 'tool',
    tool: 'get_segment_solution',
    segment: solution.slug,
  }
}

function searchFeatures(args: ToolArgs): AssistantResult {
  const query = normalizeText(args.query, 120).toLowerCase()
  const knowledge = getAssistantKnowledge()
  const matches = knowledge.features.filter((feature) => {
    const haystack = [feature.title, feature.benefit, ...feature.bullets]
      .join(' ')
      .toLowerCase()
    return !query || query.split(/\s+/).some((term) => term.length > 2 && haystack.includes(term))
  })

  if (!matches.length) {
    return {
      answer: 'Não tenho esse recurso confirmado na base comercial atual do Orçaly.',
      suggestions: ['Ver recursos confirmados', 'Falar com a equipe'],
      source: 'tool',
      tool: 'search_features',
    }
  }

  return {
    answer: `Encontrei ${matches.length} recurso${matches.length === 1 ? '' : 's'} relacionado${matches.length === 1 ? '' : 's'} na base atual do Orçaly.`,
    suggestions: ['Ver para meu negócio', 'Comparar planos'],
    cards: matches.slice(0, 3).map((feature) => ({
      type: 'feature',
      title: feature.title,
      benefit: feature.benefit,
      bullets: feature.bullets,
    })),
    source: 'tool',
    tool: 'search_features',
  }
}

function getFaq(args: ToolArgs): AssistantResult {
  const query = normalizeText(args.query, 160).toLowerCase()
  const knowledge = getAssistantKnowledge()
  const match = knowledge.faq.find((item) =>
    `${item.question} ${item.answer}`.toLowerCase().includes(query),
  )

  return {
    answer: match?.answer || 'Não tenho essa informação confirmada agora. Posso encaminhar você para o contato oficial do Orçaly.',
    suggestions: match ? ['Ver para meu negócio', 'Comparar planos'] : ['Falar com a equipe'],
    action: match
      ? null
      : {
          label: 'Falar com a equipe',
          href: `mailto:${knowledge.contactEmail}`,
        },
    source: 'tool',
    tool: 'get_faq',
  }
}

function getDemo(args: ToolArgs): AssistantResult {
  const solution = findAssistantSolution(args.segment)
  const href = solution ? `/solucoes/${solution.slug}` : getAssistantKnowledge().demoHref

  return {
    answer: solution
      ? `Posso te mostrar o fluxo real que o Orçaly apresenta para ${solution.label.toLowerCase()}.`
      : 'Posso abrir uma demonstração segura do Orçaly sem usar dados reais de clientes.',
    suggestions: ['Comparar planos', 'Quero testar'],
    cards: [
      {
        type: 'demo',
        title: solution ? `Demonstração: ${solution.shortLabel}` : 'Demonstração do Orçaly',
        description: solution?.headline || 'Veja como a plataforma organiza a experiência pública e a operação.',
        href,
        segment: solution?.slug || null,
      },
    ],
    action: {
      label: 'Abrir demonstração',
      href,
      kind: 'primary',
    },
    source: 'tool',
    tool: 'get_demo',
    segment: solution?.slug || null,
  }
}

function startSignup(args: ToolArgs): AssistantResult {
  const plan = findAssistantPlan(args.plan)
  const href = plan?.signupHref || getAssistantKnowledge().signupHref

  return {
    answer: 'Posso te levar para o cadastro oficial do Orçaly. O assistente não cria uma segunda conta nem pula etapas do fluxo existente.',
    suggestions: ['Antes, comparar planos', 'Falar com alguém'],
    action: {
      label: 'Criar conta',
      href,
      kind: 'primary',
    },
    cards: [
      {
        type: 'lead_capture',
        title: 'Quer deixar sua recomendação preparada?',
        description: 'Você pode registrar seus dados para contato comercial ou seguir direto para o cadastro.',
        recommendedPlan: plan?.id || null,
        segment: normalizeText(args.segment, 60) || null,
      },
    ],
    source: 'tool',
    tool: 'start_signup',
    recommendedPlan: plan?.id || null,
    segment: normalizeText(args.segment, 60) || null,
  }
}

function prepareHandoff(args: ToolArgs): AssistantResult {
  const knowledge = getAssistantKnowledge()
  const segment = normalizeText(args.segment, 80)
  const plan = findAssistantPlan(args.plan)
  const details = [
    'Olá! Conversei com o Assistente Orçaly.',
    segment ? `Meu negócio é do segmento ${segment}.` : '',
    plan ? `Quero entender melhor o plano ${plan.name}.` : 'Quero entender melhor o Orçaly.',
  ]
    .filter(Boolean)
    .join(' ')
  const whatsappHref = knowledge.commercialWhatsapp
    ? `https://wa.me/${knowledge.commercialWhatsapp}?text=${encodeURIComponent(details)}`
    : null

  return {
    answer: whatsappHref
      ? 'Preparei um contato com contexto para você continuar pelo WhatsApp oficial configurado.'
      : 'O WhatsApp comercial ainda não está confirmado na configuração do Assistente. Para não inventar número, deixei o contato oficial por e-mail.',
    suggestions: ['Criar conta', 'Comparar planos'],
    cards: [
      {
        type: 'handoff',
        title: 'Continuar com a equipe',
        description: details,
        whatsappHref,
        emailHref: `mailto:${knowledge.contactEmail}`,
      },
    ],
    action: whatsappHref
      ? { label: 'Continuar pelo WhatsApp', href: whatsappHref, kind: 'primary' }
      : { label: 'Falar por e-mail', href: `mailto:${knowledge.contactEmail}`, kind: 'primary' },
    source: 'tool',
    tool: 'prepare_whatsapp_handoff',
    recommendedPlan: plan?.id || null,
    segment: segment || null,
  }
}

export function runAssistantTool(name: AssistantToolName, args: ToolArgs = {}): AssistantResult {
  if (!ASSISTANT_TOOL_NAMES.includes(name)) {
    throw new Error('Ferramenta do Assistente não permitida.')
  }

  switch (name) {
    case 'get_plans':
      return getPlans()
    case 'compare_plans':
      return comparePlans(args)
    case 'recommend_plan':
      return recommendPlan(args)
    case 'get_segment_solution':
      return getSegmentSolution(args)
    case 'search_features':
      return searchFeatures(args)
    case 'get_faq':
      return getFaq(args)
    case 'get_demo':
      return getDemo(args)
    case 'start_signup':
      return startSignup(args)
    case 'prepare_whatsapp_handoff':
      return prepareHandoff(args)
    default:
      throw new Error('Ferramenta do Assistente não implementada.')
  }
}

export function planPriceSummary() {
  return getAssistantKnowledge().plans
    .map((plan) => `${plan.name}: ${money(plan.price)}/mês`)
    .join(' • ')
}
