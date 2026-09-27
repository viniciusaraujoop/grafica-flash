import type { GrowthDecisionReceipt } from '@/lib/orcaly-next/growth/decision'
import { ACTION_LABEL } from '@/lib/orcaly-next/growth/decision'
import { OUTCOME_LABEL } from '@/lib/orcaly-next/growth/results'
import { OUTCOME_TONE, formatDate } from '@/lib/orcaly-next/growth/copy'
import { StatusPill } from '../foundation/primitives'
import styles from './growth.module.css'

/** Growth Decision Receipt: observed · data · period · criterion · allowed conclusion · limitations · decision · next step. */
export default function DecisionReceipt({ receipt, headingLevel = 2 }: { receipt: GrowthDecisionReceipt; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  return (
    <section className={`${styles.panel} ${styles.receipt}`} aria-labelledby={`rcpt-${receipt.id}`} data-receipt={receipt.id}>
      <div className={styles.sectionHead}>
        <Heading id={`rcpt-${receipt.id}`}>Decision Receipt</Heading>
        <StatusPill tone={OUTCOME_TONE[receipt.outcome]}>{OUTCOME_LABEL[receipt.outcome]}</StatusPill>
      </div>
      <dl className={styles.dl}>
        <dt>O que foi observado</dt><dd><ul className={styles.list}>{receipt.observed.map((line) => <li key={line}>{line}</li>)}</ul></dd>
        <dt>Dados usados</dt><dd>{receipt.dataUsed.observationIds.length} observação(ões) · fonte(s): {receipt.dataUsed.sourceIds.join(', ') || '—'} · {receipt.dataUsed.provenance.join(', ')}</dd>
        <dt>Período</dt><dd>{receipt.period ? `${formatDate(receipt.period.start)} a ${formatDate(receipt.period.end)}` : '—'}</dd>
        <dt>Critério</dt><dd>{receipt.criterion}</dd>
        <dt>Conclusão permitida</dt><dd>{receipt.allowedConclusion}</dd>
        <dt>Decisão</dt><dd>{ACTION_LABEL[receipt.decision.action]} — {receipt.decision.rationale} <span className={styles.meta}>({receipt.decision.decidedBy}, {formatDate(receipt.createdAt)})</span></dd>
        <dt>Próximo passo</dt><dd>{receipt.nextStep}</dd>
      </dl>
      <div><strong>Limitações</strong><ul className={styles.list}>{receipt.limitations.map((line) => <li key={line}>{line}</li>)}</ul></div>
      <p className={styles.meta}>Gerado por regras determinísticas, sem IA. Id {receipt.id}.</p>
    </section>
  )
}
