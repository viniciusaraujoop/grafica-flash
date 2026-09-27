import type { GrowthExperiment, GrowthResult } from '@/lib/orcaly-next/growth/types'
import { asRatio, formatMetric, metricDefinition } from '@/lib/orcaly-next/growth/metrics'
import { divideRounded } from '@/lib/orcaly-next/growth/exact'
import { ALLOWED_CONCLUSION, OUTCOME_LABEL, formatBps } from '@/lib/orcaly-next/growth/results'
import { criterionText } from '@/lib/orcaly-next/growth/decision'
import { OUTCOME_TONE, PROVENANCE_COPY } from '@/lib/orcaly-next/growth/copy'
import { StatusPill } from '../foundation/primitives'
import styles from './growth.module.css'

/**
 * Primary-metric comparison. Bars are decorative (aria-hidden); the table is the
 * accessible source of truth. Widths come from exact BigInt ratios.
 */
export default function ResultComparison({ experiment, result, headingLevel = 2 }: { experiment: GrowthExperiment; result: GrowthResult; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const metric = experiment.hypothesis?.successCriteria?.metric ?? experiment.hypothesis?.primaryMetric
  const label = metric ? metricDefinition(metric).label : 'Métrica primária'
  const ratios = result.arms.map((arm) => asRatio(arm.primary))
  // scale every arm to the largest value using exact cross-multiplication (per-mille)
  let max: { numerator: bigint; denominator: bigint } | null = null
  for (const ratio of ratios) if (ratio && (!max || ratio.numerator * max.denominator > max.numerator * ratio.denominator)) max = ratio
  const width = (ratio: { numerator: bigint; denominator: bigint } | null) => {
    if (!ratio || !max || max.numerator === BigInt(0)) return 0
    const permille = divideRounded(ratio.numerator * max.denominator * BigInt(1000), ratio.denominator * max.numerator)
    return permille === null ? 0 : Math.max(0, Math.min(1000, Number(permille))) / 10
  }
  const nameOf = (id: string) => experiment.variants.find((variant) => variant.id === id)?.label ?? id
  const captionId = `cmp-${experiment.id}`
  return (
    <section className={styles.panel} aria-labelledby={`${captionId}-h`}>
      <div className={styles.sectionHead}>
        <Heading id={`${captionId}-h`}>Resultado</Heading>
        <StatusPill tone={OUTCOME_TONE[result.outcome]}>{OUTCOME_LABEL[result.outcome]}</StatusPill>
      </div>
      <p><strong>{ALLOWED_CONCLUSION[result.outcome]}</strong></p>
      <p className={styles.notice}>Critério: {criterionText(experiment)}</p>
      {result.arms.length && metric ? (
        <>
          <div className={styles.bars} aria-hidden="true">
            {result.arms.map((arm, index) => (
              <div key={arm.variantId} className={styles.barRow}>
                <span>{nameOf(arm.variantId)}</span>
                <span className={styles.barTrack}><span className={`${styles.barFill} ${arm.role === 'variant' ? styles.barVariant : ''}`} style={{ width: `${width(ratios[index])}%` }} /></span>
                <span className={styles.barValue}>{formatMetric(metric, arm.primary)}</span>
              </div>
            ))}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption id={captionId}>{label} por braço, com amostra e variação relativa. Valores {result.arms.every((arm) => arm.primary.provenance !== 'MEASURED') ? 'declarados manualmente' : 'medidos'}.</caption>
              <thead><tr><th scope="col">Braço</th><th scope="col" className={styles.num}>{label}</th><th scope="col" className={styles.num}>Amostra</th><th scope="col" className={styles.num}>Variação</th><th scope="col">Origem</th></tr></thead>
              <tbody>
                {result.arms.map((arm) => (
                  <tr key={arm.variantId}>
                    <th scope="row">{nameOf(arm.variantId)}</th>
                    <td className={styles.num} data-label={label}>{formatMetric(metric, arm.primary)}</td>
                    <td className={styles.num} data-label="Amostra">{arm.sample === null ? 'Não disponível' : arm.sample.toString()}</td>
                    <td className={styles.num} data-label="Variação">{arm.role === 'control' ? 'referência' : formatBps(result.relativeChangeBps[arm.variantId] ?? null)}</td>
                    <td data-label="Origem">{PROVENANCE_COPY[arm.primary.provenance]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <div>
        <strong>Limitações</strong>
        <ul className={styles.list}>
          <li>{result.confidence.note}</li>
          {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      </div>
    </section>
  )
}
