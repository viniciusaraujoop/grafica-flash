/**
 * DEMO / SAMPLE DATA — synthetic, for prototypes and visual QA only.
 * Every title starts with "DEMO ·", the company id is `demo-company`, and the UI
 * must render GROWTH_DEMO_LABEL. Outcomes are produced by the real evaluator,
 * not hard-coded.
 */

import type { GrowthDecision, GrowthExperiment, GrowthHypothesis, GrowthLearning, GrowthObservation, GrowthVariant } from './types'
import { METRIC_CATALOGUE } from './metrics'
import { buildDecisionReceipt, type GrowthDecisionReceipt } from './decision'
import { evaluateResult } from './results'

export const GROWTH_DEMO_LABEL = 'DEMO / SAMPLE DATA — dados fictícios de demonstração. Não representam nenhuma empresa ou cliente real.'
export const GROWTH_DEMO_TODAY = '2026-09-27'
export const isGrowthDemo = true as const

const COMPANY = 'demo-company'
const n = (value: number | string) => BigInt(value)

function arms(prefix: string, control: string, variant: string): GrowthVariant[] {
  return [
    { id: `${prefix}-a`, label: 'A · Controle', role: 'control', description: control },
    { id: `${prefix}-b`, label: 'B · Variante', role: 'variant', description: variant },
  ]
}

function hypothesis(partial: Partial<GrowthHypothesis> & Pick<GrowthHypothesis, 'id' | 'statement' | 'primaryMetric' | 'expectedDirection'>): GrowthHypothesis {
  return { baseline: null, successCriteria: null, minimumDurationDays: 14, observationWindow: null, assumptions: [], risks: [], source: 'Demonstração', provenance: 'DECLARED', ...partial }
}

function experiment(partial: Partial<GrowthExperiment> & Pick<GrowthExperiment, 'id' | 'title' | 'status'>): GrowthExperiment {
  return { companyId: COMPANY, hypothesis: null, variants: [], singleArm: false, metrics: [], startedAt: null, endedAt: null, version: 1, updatedAt: `${GROWTH_DEMO_TODAY}T09:00:00-03:00`, statusReason: null, ...partial }
}

const m = (...keys: Array<keyof typeof METRIC_CATALOGUE>) => keys.map((key) => METRIC_CATALOGUE[key])

export const demoExperiments: readonly GrowthExperiment[] = [
  experiment({
    id: 'demo-landing-cta', title: 'DEMO · Nova chamada na página de orçamento', status: 'RUNNING', version: 4,
    startedAt: '2026-09-10T09:00:00-03:00', updatedAt: '2026-09-25T18:00:00-03:00',
    variants: arms('demo-landing-cta', 'Botão "Enviar"', 'Botão "Receber orçamento em 1 hora"'),
    metrics: m('clicks', 'conversions', 'conversion_rate'),
    hypothesis: hypothesis({
      id: 'h-landing', statement: 'Uma chamada que promete prazo de resposta aumenta a taxa de conversão de visitantes que clicam no anúncio.',
      primaryMetric: 'conversion_rate', expectedDirection: 'increase', minimumDurationDays: 14,
      observationWindow: { start: '2026-09-10', end: '2026-09-30' },
      successCriteria: { metric: 'conversion_rate', comparator: 'relative_change_at_least', thresholdBps: 1000, minSamplePerArm: 500, minimumDurationDays: 14 },
      baseline: { metric: 'conversion_rate', value: { provenance: 'CALCULATED', ratio: { numerator: n(41), denominator: n(1100) }, unit: 'percent' }, window: { start: '2026-08-10', end: '2026-08-31' }, source: 'Registro manual de agosto (demonstração)' },
      assumptions: ['Tráfego dividido de forma equivalente entre A e B.'], risks: ['Promessa de prazo pode não ser cumprida pela equipe.'],
    }),
  }),
  experiment({
    id: 'demo-free-shipping', title: 'DEMO · Frete grátis acima de um valor mínimo', status: 'COMPLETED', version: 7,
    startedAt: '2026-08-01T09:00:00-03:00', endedAt: '2026-08-29T18:00:00-03:00', updatedAt: '2026-09-02T10:00:00-03:00',
    variants: arms('demo-free-shipping', 'Frete cobrado', 'Frete grátis acima do mínimo'),
    metrics: m('spend_cents', 'conversions', 'cac', 'revenue_cents', 'roas'),
    hypothesis: hypothesis({
      id: 'h-shipping', statement: 'Frete grátis acima de um valor mínimo reduz o custo de aquisição por cliente.',
      primaryMetric: 'cac', expectedDirection: 'decrease', minimumDurationDays: 21,
      observationWindow: { start: '2026-08-01', end: '2026-08-28' },
      successCriteria: { metric: 'cac', comparator: 'relative_change_at_most', thresholdBps: -1000, minSamplePerArm: 30, minimumDurationDays: 21 },
      assumptions: ['Mesmo investimento de mídia nos dois braços.'], risks: ['Margem menor por pedido.'],
    }),
  }),
  experiment({
    id: 'demo-short-video', title: 'DEMO · Anúncio em vídeo curto', status: 'COMPLETED', version: 5,
    startedAt: '2026-08-12T09:00:00-03:00', endedAt: '2026-09-09T18:00:00-03:00', updatedAt: '2026-09-09T18:00:00-03:00',
    variants: arms('demo-short-video', 'Imagem estática', 'Vídeo de 10 segundos'),
    metrics: m('impressions', 'clicks', 'ctr', 'spend_cents', 'cpc'),
    hypothesis: hypothesis({
      id: 'h-video', statement: 'Um vídeo curto aumenta a taxa de cliques em relação à imagem estática.',
      primaryMetric: 'ctr', expectedDirection: 'increase', minimumDurationDays: 14,
      observationWindow: { start: '2026-08-12', end: '2026-09-08' },
      successCriteria: { metric: 'ctr', comparator: 'relative_change_at_least', thresholdBps: 1500, minSamplePerArm: 10000, minimumDurationDays: 14 },
    }),
  }),
  experiment({
    id: 'demo-email-time', title: 'DEMO · Horário de envio do e-mail de lembrete', status: 'PAUSED', version: 3,
    startedAt: '2026-08-25T09:00:00-03:00', updatedAt: '2026-09-05T11:00:00-03:00', statusReason: 'Ferramenta de e-mail em manutenção (demonstração).',
    variants: arms('demo-email-time', 'Envio às 9h', 'Envio às 19h'),
    metrics: m('clicks', 'leads'),
    hypothesis: hypothesis({
      id: 'h-email', statement: 'Enviar o lembrete à noite gera mais leads do que pela manhã.',
      primaryMetric: 'leads', expectedDirection: 'increase', minimumDurationDays: 14,
      observationWindow: { start: '2026-08-25', end: '2026-09-30' },
      successCriteria: { metric: 'leads', comparator: 'relative_change_at_least', thresholdBps: 1000, minSamplePerArm: 200, minimumDurationDays: 14 },
    }),
  }),
  experiment({
    id: 'demo-pricing-table', title: 'DEMO · Tabela de preços simplificada', status: 'READY', version: 2,
    variants: arms('demo-pricing-table', 'Tabela atual', 'Tabela com 3 opções'),
    metrics: m('clicks', 'leads', 'cpl'),
    hypothesis: hypothesis({
      id: 'h-pricing', statement: 'Reduzir a tabela para três opções diminui o custo por lead.',
      primaryMetric: 'cpl', expectedDirection: 'decrease', minimumDurationDays: 14,
      observationWindow: { start: '2026-09-25', end: '2026-10-15' },
      successCriteria: { metric: 'cpl', comparator: 'relative_change_at_most', thresholdBps: -800, minSamplePerArm: 50, minimumDurationDays: 14 },
      baseline: { metric: 'cpl', value: { provenance: 'CALCULATED', ratio: { numerator: n(360000), denominator: n(90) }, unit: 'cents' }, window: { start: '2026-09-01', end: '2026-09-20' }, source: 'Registro manual (demonstração)' },
    }),
  }),
  experiment({
    id: 'demo-contact-button', title: 'DEMO · Botão de contato fixo no celular', status: 'DRAFT',
    variants: arms('demo-contact-button', 'Sem botão fixo', 'Botão fixo no rodapé'),
    metrics: m('leads'),
    hypothesis: hypothesis({ id: 'h-contact', statement: 'Um botão de contato fixo no celular aumenta os leads vindos do site.', primaryMetric: 'leads', expectedDirection: 'increase' }),
  }),
  experiment({ id: 'demo-referral', title: 'DEMO · Programa de indicação para clientes', status: 'DRAFT' }),
  experiment({
    id: 'demo-coupon', title: 'DEMO · Cupom de primeira compra', status: 'INVALIDATED', version: 4,
    startedAt: '2026-09-08T09:00:00-03:00', endedAt: '2026-09-16T12:00:00-03:00', updatedAt: '2026-09-16T12:00:00-03:00',
    statusReason: 'Registro de conversões falhou entre 12 e 15/09 (demonstração).',
    variants: arms('demo-coupon', 'Sem cupom', 'Cupom de 10%'), metrics: m('conversions'),
    hypothesis: hypothesis({ id: 'h-coupon', statement: 'Um cupom na primeira compra aumenta as conversões.', primaryMetric: 'conversions', expectedDirection: 'increase', observationWindow: { start: '2026-09-08', end: '2026-09-28' }, successCriteria: { metric: 'conversions', comparator: 'relative_change_at_least', thresholdBps: 1000, minSamplePerArm: 40, minimumDurationDays: 14 } }),
  }),
]

function obs(id: string, experimentId: string, variantId: string, start: string, end: string, values: GrowthObservation['values']): GrowthObservation {
  return { id, experimentId, variantId, window: { start, end }, sourceId: 'manual', provenance: 'DECLARED', values, evidenceUrl: null, recordedAt: `${end}T20:00:00-03:00` }
}

export const demoObservations: readonly GrowthObservation[] = [
  obs('o-cta-a1', 'demo-landing-cta', 'demo-landing-cta-a', '2026-09-10', '2026-09-17', { clicks: n(610), conversions: n(24) }),
  obs('o-cta-a2', 'demo-landing-cta', 'demo-landing-cta-a', '2026-09-18', '2026-09-24', { clicks: n(590), conversions: n(24) }),
  obs('o-cta-b1', 'demo-landing-cta', 'demo-landing-cta-b', '2026-09-10', '2026-09-17', { clicks: n(600), conversions: n(29) }),
  obs('o-cta-b2', 'demo-landing-cta', 'demo-landing-cta-b', '2026-09-18', '2026-09-24', { clicks: n(580), conversions: n(30) }),
  obs('o-ship-a', 'demo-free-shipping', 'demo-free-shipping-a', '2026-08-01', '2026-08-28', { spend_cents: n(480000), conversions: n(40), revenue_cents: n(1920000) }),
  obs('o-ship-b', 'demo-free-shipping', 'demo-free-shipping-b', '2026-08-01', '2026-08-28', { spend_cents: n(480000), conversions: n(42), revenue_cents: n(1932000) }),
  obs('o-vid-a', 'demo-short-video', 'demo-short-video-a', '2026-08-12', '2026-09-08', { impressions: n(50000), clicks: n(900), spend_cents: n(135000) }),
  obs('o-vid-b', 'demo-short-video', 'demo-short-video-b', '2026-08-12', '2026-09-08', { impressions: n(50000), clicks: n(850), spend_cents: n(135000) }),
  obs('o-mail-a', 'demo-email-time', 'demo-email-time-a', '2026-08-25', '2026-09-04', { clicks: n(140), leads: n(31) }),
  obs('o-mail-b', 'demo-email-time', 'demo-email-time-b', '2026-08-25', '2026-09-04', { clicks: n(151), leads: n(38) }),
]

const shipping = demoExperiments[1]
const shippingDecision: GrowthDecision = { id: 'd-shipping', experimentId: shipping.id, action: 'extend_test', rationale: 'Sinal na direção esperada, mas abaixo do critério; repetir com maior amostra antes de decidir.', decidedBy: 'Pessoa de demonstração', decidedAt: '2026-09-02T10:00:00-03:00' }

export const demoReceipts: readonly GrowthDecisionReceipt[] = [
  buildDecisionReceipt({ id: 'r-shipping', experiment: shipping, result: evaluateResult(shipping, demoObservations), observations: demoObservations, decision: shippingDecision, nextStep: 'Repetir por 28 dias com o dobro de investimento em ambos os braços.', createdAt: '2026-09-02T10:00:00-03:00' }),
]

export const demoLearnings: readonly GrowthLearning[] = [
  { id: 'l-ship-fact', experimentId: shipping.id, kind: 'FACT', text: 'Com o mesmo investimento, o braço com frete grátis registrou 42 conversões contra 40 do controle.', observationIds: ['o-ship-a', 'o-ship-b'], limitation: null, decisionReceiptId: null, createdAt: '2026-09-02T09:40:00-03:00' },
  { id: 'l-ship-int', experimentId: shipping.id, kind: 'INTERPRETATION', text: 'O frete grátis pode ter reduzido levemente o custo de aquisição.', observationIds: ['o-ship-a', 'o-ship-b'], limitation: 'Diferença pequena, dados declarados manualmente e sem teste estatístico.', decisionReceiptId: null, createdAt: '2026-09-02T09:50:00-03:00' },
  { id: 'l-ship-dec', experimentId: shipping.id, kind: 'DECISION', text: 'Estender o teste com amostra maior antes de adotar.', observationIds: [], limitation: null, decisionReceiptId: 'r-shipping', createdAt: '2026-09-02T10:00:00-03:00' },
]

export const demoReceiptsByExperiment: Readonly<Record<string, number>> = { [shipping.id]: 1 }
