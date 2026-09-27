import Link from 'next/link'
import type { GrowthExperiment, GrowthLearning, GrowthObservation } from '@/lib/orcaly-next/growth/types'
import type { GrowthDecisionReceipt } from '@/lib/orcaly-next/growth/decision'
import { evaluateResult } from '@/lib/orcaly-next/growth/results'
import { allowedActions } from '@/lib/orcaly-next/growth/experiment'
import { suggestNextSteps } from '@/lib/orcaly-next/growth/suggestions'
import { formatMetric, metricDefinition, sumObservations, metricValue } from '@/lib/orcaly-next/growth/metrics'
import { safeEvidenceUrl } from '@/lib/orcaly-next/growth/manual-input'
import { EXPERIMENT_STATUS_COPY, PROVENANCE_COPY, formatDate } from '@/lib/orcaly-next/growth/copy'
import { GROWTH_ROUTES } from '@/lib/orcaly-next/growth/workspace'
import { StatusPill } from '../foundation/primitives'
import DecisionReceipt from './DecisionReceipt'
import GrowthShell from './GrowthShell'
import HypothesisCard from './HypothesisCard'
import LearningLog from './LearningLog'
import MetricCard from './MetricCard'
import ResultComparison from './ResultComparison'
import SuggestionList from './SuggestionList'
import styles from './growth.module.css'

const ACTION_COPY = {
  mark_ready: 'Marcar como pronto', back_to_draft: 'Voltar para rascunho', start: 'Iniciar', pause: 'Pausar (exige motivo)', resume: 'Retomar',
  complete: 'Concluir', cancel: 'Cancelar (exige motivo)', invalidate: 'Invalidar (exige motivo)',
} as const

export default function ExperimentDetail({ experiment, observations, learnings, receipts, today, demoLabel, theme }: {
  experiment: GrowthExperiment
  observations: readonly GrowthObservation[]
  learnings: readonly GrowthLearning[]
  receipts: readonly GrowthDecisionReceipt[]
  today: string
  demoLabel?: string
  theme?: 'light' | 'dark'
}) {
  const own = observations.filter((observation) => observation.experimentId === experiment.id)
  const ownLearnings = learnings.filter((learning) => learning.experimentId === experiment.id)
  const ownReceipts = receipts.filter((receipt) => receipt.experimentId === experiment.id)
  const result = evaluateResult(experiment, own)
  const status = EXPERIMENT_STATUS_COPY[experiment.status]
  const ran = ['RUNNING', 'PAUSED', 'COMPLETED', 'INVALIDATED'].includes(experiment.status)
  const suggestions = suggestNextSteps({ experiment, result: ran ? result : null, learnings: ownLearnings, receiptCount: ownReceipts.length, today })
  const nameOf = (id: string) => experiment.variants.find((variant) => variant.id === id)?.label ?? id
  const actions = allowedActions(experiment)
  return (
    <GrowthShell current="experiments" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <Link href={GROWTH_ROUTES.experiments} className={styles.meta}>← Experimentos</Link>
        <div className={styles.cardTop} style={{ justifyContent: 'flex-start' }}><StatusPill tone={status.tone}>{status.label}</StatusPill><span className={styles.meta}>versão {experiment.version}</span></div>
        <h1>{experiment.title}</h1>
        <p className={styles.meta}>Início {formatDate(experiment.startedAt)} · Fim {formatDate(experiment.endedAt)}{experiment.statusReason ? ` · Motivo: ${experiment.statusReason}` : ''}</p>
        <p className={styles.meta}>Ações possíveis neste estado: {actions.length ? actions.map((action) => ACTION_COPY[action]).join(' · ') : 'nenhuma (estado final)'}. Salvamento ainda não configurado.</p>
      </div>

      {suggestions.length ? (
        <section className={styles.section} aria-labelledby="d-next"><div className={styles.sectionHead}><h2 id="d-next">Próximo passo</h2><p>Regras explícitas, sem IA.</p></div><SuggestionList suggestions={suggestions} experiments={[experiment]} /></section>
      ) : null}

      <div className={styles.detailGrid}>
        <div className={styles.stack}>
          <HypothesisCard experiment={experiment} />
          <ResultComparison experiment={experiment} result={result} />
          {result.arms.length ? (
            <section className={styles.panel} aria-labelledby="d-metrics">
              <h2 id="d-metrics">Métricas por braço</h2>
              {result.arms.map((arm) => (
                <div key={arm.variantId} className={styles.section} style={{ gap: 'var(--ox-space-2)' }}>
                  <h3 style={{ fontSize: 'var(--ox-text-md)' }}>{nameOf(arm.variantId)}</h3>
                  <ul className={styles.metricGrid}>{experiment.metrics.map((metric) => <li key={metric.key}><MetricCard metricKey={metric.key} value={arm.metrics[metric.key] ?? { provenance: 'UNKNOWN', reason: 'não calculada' }} /></li>)}</ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>
        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="d-arms">
            <h2 id="d-arms">{experiment.singleArm ? 'Braço (sem controle)' : 'Controle e variantes'}</h2>
            {experiment.variants.length ? <ul className={styles.list}>{experiment.variants.map((variant) => <li key={variant.id}><strong>{variant.label}</strong> — {variant.description || 'sem descrição'}</li>)}</ul> : <p className={styles.notice}>Nenhum braço configurado.</p>}
          </section>
        </div>
      </div>

      <section className={styles.panel} aria-labelledby="d-obs">
        <h2 id="d-obs">Observações registradas</h2>
        {own.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>Dados usados na avaliação, por período e braço.</caption>
              <thead><tr><th scope="col">Período</th><th scope="col">Braço</th><th scope="col">Valores</th><th scope="col">Origem</th></tr></thead>
              <tbody>
                {own.map((observation) => {
                  const totals = sumObservations([observation])
                  const keys = experiment.metrics.map((metric) => metric.key).filter((key) => metricValue(key, totals).provenance !== 'UNKNOWN' && metricValue(key, totals).provenance !== 'CALCULATED')
                  const evidence = safeEvidenceUrl(observation.evidenceUrl)
                  return (
                    <tr key={observation.id}>
                      <th scope="row">{formatDate(observation.window.start)}–{formatDate(observation.window.end)}</th>
                      <td data-label="Braço">{nameOf(observation.variantId)}</td>
                      <td data-label="Valores">{keys.map((key) => `${metricDefinition(key).label}: ${formatMetric(key, metricValue(key, totals))}`).join(' · ') || '—'}</td>
                      <td data-label="Origem">{PROVENANCE_COPY[observation.provenance]}{evidence ? <> · <a href={evidence} rel="noopener noreferrer nofollow" target="_blank">evidência</a></> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className={styles.notice}>Nenhuma observação registrada.</p>}
      </section>

      <LearningLog learnings={ownLearnings} heading="Aprendizados deste experimento" />

      <section className={styles.section} aria-labelledby="d-receipts">
        <div className={styles.sectionHead}><h2 id="d-receipts">Decisões</h2></div>
        {ownReceipts.length ? ownReceipts.map((receipt) => <DecisionReceipt key={receipt.id} receipt={receipt} headingLevel={3} />) : <p className={styles.notice}>Nenhuma decisão registrada. Decisões só podem ser registradas com Decision Receipt.</p>}
      </section>
    </GrowthShell>
  )
}
