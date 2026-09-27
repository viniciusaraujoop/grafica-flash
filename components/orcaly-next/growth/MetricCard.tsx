import type { MetricKey, MetricValue } from '@/lib/orcaly-next/growth/types'
import { DERIVED_FORMULAS, formatMetric, isDerived, metricDefinition } from '@/lib/orcaly-next/growth/metrics'
import { PROVENANCE_COPY } from '@/lib/orcaly-next/growth/copy'
import styles from './growth.module.css'

/** One metric with its provenance. UNKNOWN shows the reason, never a zero. */
export default function MetricCard({ metricKey, value }: { metricKey: MetricKey; value: MetricValue }) {
  const definition = metricDefinition(metricKey)
  const unknown = value.provenance === 'UNKNOWN'
  return (
    <dl className={`${styles.metricCard} ${unknown ? styles.metricUnknown : ''}`} data-provenance={value.provenance}>
      <dt>{definition.label}</dt>
      <dd>{formatMetric(metricKey, value)}</dd>
      <dd className={styles.provenance}>
        {PROVENANCE_COPY[value.provenance]}
        {unknown ? ` — ${value.reason}` : isDerived(metricKey) ? ` · ${DERIVED_FORMULAS[metricKey].description}` : ''}
      </dd>
    </dl>
  )
}
