import 'server-only'

import {
  marketingFaq,
  marketingFeatures,
  marketingPlans,
  marketingPlanSignupHref,
  marketingSolutions,
  type MarketingPlan,
  type MarketingSolution,
} from '@/lib/marketing/main-site'

export type AssistantPlan = MarketingPlan & {
  signupHref: string
}

export type AssistantKnowledge = {
  plans: AssistantPlan[]
  solutions: MarketingSolution[]
  features: typeof marketingFeatures
  faq: typeof marketingFaq
  demoHref: string
  signupHref: string
  contactEmail: string
  commercialWhatsapp: string | null
}

function cleanPhone(value: string | undefined) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function getAssistantKnowledge(): AssistantKnowledge {
  return {
    plans: marketingPlans.map((plan) => ({
      ...plan,
      signupHref: marketingPlanSignupHref(plan.id),
    })),
    solutions: marketingSolutions,
    features: marketingFeatures,
    faq: marketingFaq,
    demoHref: '/parceiros/demo?preview=1',
    signupHref: '/cadastro',
    contactEmail: 'orcalybr@gmail.com',
    commercialWhatsapp: cleanPhone(process.env.ORCALY_COMMERCIAL_WHATSAPP),
  }
}

export function findAssistantPlan(value: unknown): AssistantPlan | null {
  const normalized = String(value || '').trim().toLowerCase()
  const knowledge = getAssistantKnowledge()

  return (
    knowledge.plans.find((plan) =>
      [plan.id, plan.key, plan.name.toLowerCase()].includes(normalized as never),
    ) || null
  )
}

export function findAssistantSolution(value: unknown): MarketingSolution | null {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

  const aliases: Record<string, string> = {
    grafica: 'graficas',
    graficas: 'graficas',
    personalizado: 'graficas',
    personalizados: 'graficas',
    restaurante: 'restaurantes',
    restaurantes: 'restaurantes',
    food: 'restaurantes',
    delivery: 'restaurantes',
    loja: 'lojas',
    lojas: 'lojas',
    comercio: 'lojas',
    assistencia: 'assistencia-tecnica',
    'assistencia tecnica': 'assistencia-tecnica',
    tecnica: 'assistencia-tecnica',
    barbearia: 'barbearias',
    barbearias: 'barbearias',
    beleza: 'barbearias',
    estetica: 'barbearias',
    servico: 'servicos',
    servicos: 'servicos',
    evento: 'eventos',
    eventos: 'eventos',
  }

  const slug = aliases[normalized] || normalized
  return getAssistantKnowledge().solutions.find((solution) => solution.slug === slug) || null
}

export function publicKnowledgeForPrompt() {
  const knowledge = getAssistantKnowledge()

  return {
    plans: knowledge.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      audience: plan.audience,
      outcome: plan.outcome,
      description: plan.description,
      highlights: plan.highlights,
    })),
    segments: knowledge.solutions.map((solution) => ({
      slug: solution.slug,
      label: solution.label,
      headline: solution.headline,
      description: solution.description,
      workflow: solution.workflow,
      features: solution.features,
      publicExperience: solution.publicExperience,
    })),
    features: knowledge.features,
    faq: knowledge.faq,
    routes: {
      signup: knowledge.signupHref,
      demo: knowledge.demoHref,
      contactEmail: knowledge.contactEmail,
    },
  }
}
