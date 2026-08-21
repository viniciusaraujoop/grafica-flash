export type AssistantPlanKey = 'essencial' | 'profissional' | 'premium'

export type AssistantAction = {
  label: string
  href: string
  kind?: 'primary' | 'secondary'
}

export type AssistantPlanCard = {
  type: 'plan'
  id: AssistantPlanKey
  name: string
  price: number
  audience: string
  highlights: string[]
  featured?: boolean
  action: AssistantAction
}

export type AssistantComparisonCard = {
  type: 'comparison'
  title: string
  plans: Array<{
    id: AssistantPlanKey
    name: string
    price: number
    highlights: string[]
  }>
  recommendedPlan?: AssistantPlanKey | null
  reasons?: string[]
}

export type AssistantFlowCard = {
  type: 'flow'
  title: string
  description: string
  steps: string[]
  features: string[]
  demoHref: string
}

export type AssistantFeatureCard = {
  type: 'feature'
  title: string
  benefit: string
  bullets: string[]
}

export type AssistantLeadCard = {
  type: 'lead_capture'
  title: string
  description: string
  recommendedPlan?: AssistantPlanKey | null
  segment?: string | null
}

export type AssistantHandoffCard = {
  type: 'handoff'
  title: string
  description: string
  whatsappHref?: string | null
  emailHref: string
}

export type AssistantDemoCard = {
  type: 'demo'
  title: string
  description: string
  href: string
  segment?: string | null
}

export type AssistantCard =
  | AssistantPlanCard
  | AssistantComparisonCard
  | AssistantFlowCard
  | AssistantFeatureCard
  | AssistantLeadCard
  | AssistantHandoffCard
  | AssistantDemoCard

export type AssistantResult = {
  answer: string
  suggestions: string[]
  action?: AssistantAction | null
  cards?: AssistantCard[]
  source: 'tool' | 'ai' | 'guided' | 'fallback'
  tool?: string | null
  recommendedPlan?: AssistantPlanKey | null
  segment?: string | null
  requestId?: string
}

export type AssistantPageContext = {
  pathname: string
  ref?: string
  pc?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}
