import Link from 'next/link'
import type { GrowthExperiment, GrowthResult } from '@/lib/orcaly-next/growth/types'
import { EXPERIMENT_STATUS_COPY, OUTCOME_TONE, formatDate } from '@/lib/orcaly-next/growth/copy'
import { OUTCOME_LABEL, formatBps } from '@/lib/orcaly-next/growth/results'
import { metricDefinition } from '@/lib/orcaly-next/growth/metrics'
import { experimentHref } from '@/lib/orcaly-next/growth/workspace'
import { StatusPill } from '../foundation/primitives'
import styles from './growth.module.css'

/** Whole card is one link (keyboard: a single Tab stop). Status and outcome are text, not only color. */
export default function ExperimentCard({ experiment, result, headingLevel = 3 }: { experiment: GrowthExperiment; result?: GrowthResult; headingLevel?: 3 | 4 }) {
  const Heading = `h${headingLevel}` as 'h3' | 'h4'
  const status = EXPERIMENT_STATUS_COPY[experiment.status]
  const href = experimentHref(experiment.id)
  const primary = experiment.hypothesis?.primaryMetric
  const changes = result ? Object.values(result.relativeChangeBps) : []
  const showOutcome = result && ['RUNNING', 'PAUSED', 'COMPLETED', 'INVALIDATED'].includes(experiment.status)
  return (
    <article className={styles.card} data-status={experiment.status} aria-labelledby={`exp-${experiment.id}`}>
      <div className={styles.cardTop}>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
        {showOutcome ? <StatusPill tone={OUTCOME_TONE[result.outcome]}>{OUTCOME_LABEL[result.outcome]}</StatusPill> : null}
      </div>
      <Heading className={styles.cardTitle} id={`exp-${experiment.id}`}>
        {href ? <Link href={href}>{experiment.title}</Link> : experiment.title}
      </Heading>
      {primary ? <p className={styles.metric}>{metricDefinition(primary).label}{changes.length ? <> · <strong>{changes.map(formatBps).join(' / ')}</strong> vs {experiment.singleArm ? 'baseline' : 'controle'}</> : null}</p> : <p className={styles.meta}>Sem hipótese declarada</p>}
      <p className={styles.meta}>
        {experiment.hypothesis?.observationWindow ? `Janela ${formatDate(experiment.hypothesis.observationWindow.start)}–${formatDate(experiment.hypothesis.observationWindow.end)}` : 'Janela não definida'}
        {experiment.statusReason ? ` · ${experiment.statusReason}` : ''}
      </p>
    </article>
  )
}
