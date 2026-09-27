import type { GrowthExperiment } from '@/lib/orcaly-next/growth/types'
import { criterionText } from '@/lib/orcaly-next/growth/decision'
import { metricDefinition, formatMetric } from '@/lib/orcaly-next/growth/metrics'
import { DIRECTION_COPY, PROVENANCE_COPY, formatDate } from '@/lib/orcaly-next/growth/copy'
import GrowthEmptyState from './GrowthEmptyState'
import styles from './growth.module.css'

/** The hypothesis as a first-class object: statement, metric, criterion, window, assumptions, risks, source. */
export default function HypothesisCard({ experiment, headingLevel = 2 }: { experiment: GrowthExperiment; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const h = experiment.hypothesis
  if (!h) return <section className={styles.panel} aria-label="Hipótese"><Heading>Hipótese</Heading><GrowthEmptyState kind="no-hypothesis" headingLevel={headingLevel === 2 ? 3 : 4} /></section>
  return (
    <section className={styles.panel} aria-labelledby={`hyp-${experiment.id}`}>
      <Heading id={`hyp-${experiment.id}`}>Hipótese</Heading>
      <p className={styles.quote}>“{h.statement}”</p>
      <dl className={styles.dl}>
        <dt>Métrica primária</dt><dd>{metricDefinition(h.primaryMetric).label}</dd>
        <dt>Direção esperada</dt><dd>{DIRECTION_COPY[h.expectedDirection]}</dd>
        <dt>Critério</dt><dd>{h.successCriteria ? criterionText(experiment) : 'Não declarado'}</dd>
        <dt>Janela</dt><dd>{h.observationWindow ? `${formatDate(h.observationWindow.start)} a ${formatDate(h.observationWindow.end)}` : 'Não declarada'}</dd>
        <dt>Duração mínima</dt><dd>{h.minimumDurationDays} dia(s)</dd>
        <dt>Baseline</dt><dd>{h.baseline ? `${formatMetric(h.baseline.metric, h.baseline.value)} (${PROVENANCE_COPY[h.baseline.value.provenance]} · ${formatDate(h.baseline.window.start)}–${formatDate(h.baseline.window.end)} · ${h.baseline.source})` : 'Não registrada'}</dd>
        <dt>Origem</dt><dd>{h.source}</dd>
      </dl>
      {h.assumptions.length ? <div><strong>Premissas</strong><ul className={styles.list}>{h.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      {h.risks.length ? <div><strong>Riscos</strong><ul className={styles.list}>{h.risks.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    </section>
  )
}
