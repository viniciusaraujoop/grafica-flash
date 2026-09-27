/**
 * Deterministic suggestion engine. No AI: every suggestion names the explicit rule that produced it.
 * Same input → same suggestions in the same order.
 */

import type { GrowthExperiment, GrowthLearning, GrowthResult } from './types'
import { parseIsoDate } from './experiment'

export type SuggestionSeverity = 'attention' | 'next'

export type Suggestion = {
  ruleId: string
  /** The rule, in words, shown to the user ("Por que estou vendo isso?"). */
  rule: string
  title: string
  action: string
  severity: SuggestionSeverity
  experimentId: string
}

type Context = { experiment: GrowthExperiment; result: GrowthResult | null; learnings: readonly GrowthLearning[]; receiptCount: number; today: string }
type Rule = { id: string; priority: number; rule: string; severity: SuggestionSeverity; when: (context: Context) => boolean; title: string; action: string }

const DAY = 86_400_000
const PAUSED_REVIEW_DAYS = 14

function daysBetween(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null
  const from = parseIsoDate(fromIso.slice(0, 10))
  const to = parseIsoDate(toIso)
  return from === null || to === null ? null : Math.floor((to - from) / DAY)
}

export const RULES: readonly Rule[] = [
  { id: 'R01_NO_HYPOTHESIS', priority: 10, severity: 'attention', rule: 'Rascunho sem hipótese.', title: 'Escrever a hipótese', action: 'Declare o que você espera que aconteça e por quê.', when: ({ experiment }) => experiment.status === 'DRAFT' && !experiment.hypothesis },
  { id: 'R02_NO_CRITERIA', priority: 20, severity: 'attention', rule: 'Hipótese sem critério de sucesso declarado.', title: 'Definir o critério de sucesso', action: 'Informe a variação mínima, a amostra por braço e a duração antes de iniciar.', when: ({ experiment }) => Boolean(experiment.hypothesis) && !experiment.hypothesis?.successCriteria && ['DRAFT', 'READY'].includes(experiment.status) },
  { id: 'R03_NO_WINDOW', priority: 25, severity: 'attention', rule: 'Hipótese sem janela de observação.', title: 'Definir a janela de observação', action: 'Escolha data de início e fim compatíveis com a duração mínima.', when: ({ experiment }) => Boolean(experiment.hypothesis) && !experiment.hypothesis?.observationWindow && ['DRAFT', 'READY'].includes(experiment.status) },
  { id: 'R04_NO_BASELINE', priority: 30, severity: 'next', rule: 'Hipótese sem baseline da métrica primária.', title: 'Registrar a baseline', action: 'Informe o valor atual da métrica primária e de qual período ele vem.', when: ({ experiment }) => Boolean(experiment.hypothesis) && !experiment.hypothesis?.baseline && ['DRAFT', 'READY'].includes(experiment.status) },
  { id: 'R05_NO_ARMS', priority: 35, severity: 'attention', rule: 'Teste com controle exige um controle e ao menos uma variante.', title: 'Configurar controle e variantes', action: 'Adicione o controle e a variante que será comparada.', when: ({ experiment }) => !experiment.singleArm && ['DRAFT', 'READY'].includes(experiment.status) && (!experiment.variants.some((v) => v.role === 'control') || !experiment.variants.some((v) => v.role === 'variant')) },
  { id: 'R06_WINDOW_EXPIRED', priority: 40, severity: 'attention', rule: 'Experimento em andamento após o fim da janela declarada.', title: 'Revisar experimento expirado', action: 'Registre as últimas observações e conclua ou invalide.', when: ({ experiment, today }) => { const end = experiment.hypothesis?.observationWindow?.end; const t = parseIsoDate(today); const e = end ? parseIsoDate(end) : null; return experiment.status === 'RUNNING' && t !== null && e !== null && t > e } },
  { id: 'R07_PAUSED_LONG', priority: 45, severity: 'attention', rule: `Pausado há mais de ${PAUSED_REVIEW_DAYS} dias.`, title: 'Decidir sobre o experimento pausado', action: 'Retome, conclua ou cancele com motivo.', when: ({ experiment, today }) => experiment.status === 'PAUSED' && (daysBetween(experiment.updatedAt, today) ?? 0) > PAUSED_REVIEW_DAYS },
  { id: 'R08_SMALL_SAMPLE', priority: 50, severity: 'next', rule: 'Resultado com dados insuficientes para o critério declarado.', title: 'Coletar mais dados', action: 'Continue registrando observações até atingir a amostra e a duração mínimas.', when: ({ experiment, result }) => ['RUNNING', 'PAUSED'].includes(experiment.status) && result?.outcome === 'INSUFFICIENT_DATA' },
  { id: 'R09_MET_NO_LEARNING', priority: 60, severity: 'next', rule: 'Experimento concluído com critério atingido e sem aprendizado registrado.', title: 'Registrar o aprendizado', action: 'Separe o fato observado, sua interpretação e a limitação.', when: ({ experiment, result, learnings }) => experiment.status === 'COMPLETED' && result?.outcome === 'MEETS_DECLARED_CRITERIA' && !learnings.length },
  { id: 'R13_MET_BEFORE_END', priority: 55, severity: 'next', rule: 'Critério atingido antes do fim da janela declarada.', title: 'Manter até o fim da janela', action: 'Concluir antes do prazo aumenta o risco de uma conclusão precipitada; continue registrando até a data final.', when: ({ experiment, result }) => experiment.status === 'RUNNING' && result?.outcome === 'MEETS_DECLARED_CRITERIA' },
  { id: 'R10_NOT_MET_NEXT_TEST', priority: 65, severity: 'next', rule: 'Critério não atingido.', title: 'Registrar aprendizado e propor o próximo teste', action: 'Documente o que não funcionou e formule uma nova hipótese.', when: ({ experiment, result }) => experiment.status === 'COMPLETED' && result?.outcome === 'DOES_NOT_MEET_DECLARED_CRITERIA' },
  { id: 'R11_COMPLETED_NO_DECISION', priority: 70, severity: 'attention', rule: 'Experimento concluído sem Decision Receipt.', title: 'Registrar a decisão', action: 'Gere o Decision Receipt com a ação tomada e o próximo passo.', when: ({ experiment, receiptCount }) => experiment.status === 'COMPLETED' && receiptCount === 0 },
  { id: 'R12_READY_TO_START', priority: 80, severity: 'next', rule: 'Pronto e com janela iniciada.', title: 'Iniciar o experimento', action: 'A janela declarada já começou; inicie para registrar observações.', when: ({ experiment, today }) => { const s = experiment.hypothesis?.observationWindow?.start; const t = parseIsoDate(today); const st = s ? parseIsoDate(s) : null; return experiment.status === 'READY' && t !== null && st !== null && t >= st } },
]

export function suggestNextSteps(context: Context): Suggestion[] {
  if (parseIsoDate(context.today) === null) return []
  return RULES
    .filter((rule) => rule.when(context))
    .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1))
    .map((rule) => ({ ruleId: rule.id, rule: rule.rule, title: rule.title, action: rule.action, severity: rule.severity, experimentId: context.experiment.id }))
}
