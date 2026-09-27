import type { GrowthExperiment, GrowthLearning } from '@/lib/orcaly-next/growth/types'
import { LEARNING_KIND_LABEL } from '@/lib/orcaly-next/growth/decision'
import { formatDate } from '@/lib/orcaly-next/growth/copy'
import { StatusPill } from '../foundation/primitives'
import GrowthEmptyState from './GrowthEmptyState'
import styles from './growth.module.css'

const TONE = { FACT: 'info', INTERPRETATION: 'accent', DECISION: 'success' } as const

/** FACT, INTERPRETATION and DECISION are labelled in text and never merged into one entry. */
export default function LearningLog({ learnings, experiments, heading = 'Aprendizados', headingLevel = 2 }: {
  learnings: readonly GrowthLearning[]
  experiments?: readonly GrowthExperiment[]
  heading?: string
  headingLevel?: 2 | 3
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const headingId = `log-${heading.normalize('NFD').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  const titleOf = (id: string) => experiments?.find((experiment) => experiment.id === id)?.title
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHead}><Heading id={headingId}>{heading}</Heading><p>Fato · Interpretação · Decisão, sempre separados.</p></div>
      {learnings.length ? (
        <ol className={styles.log}>
          {learnings.map((learning) => (
            <li key={learning.id} className={styles.entry} data-kind={learning.kind}>
              <div className={styles.entryHead}>
                <StatusPill tone={TONE[learning.kind]}>{LEARNING_KIND_LABEL[learning.kind]}</StatusPill>
                <time className={styles.meta} dateTime={learning.createdAt}>{formatDate(learning.createdAt)}</time>
                {titleOf(learning.experimentId) ? <span className={styles.meta}>{titleOf(learning.experimentId)}</span> : null}
              </div>
              <p>{learning.text}</p>
              {learning.limitation ? <p className={`${styles.limitation} ${styles.meta}`}>Limitação: {learning.limitation}</p> : null}
              {learning.kind === 'FACT' ? <p className={styles.meta}>Observações: {learning.observationIds.join(', ')}</p> : null}
              {learning.decisionReceiptId ? <p className={styles.meta}>Decision Receipt: {learning.decisionReceiptId}</p> : null}
            </li>
          ))}
        </ol>
      ) : <GrowthEmptyState kind="no-learnings" headingLevel={headingLevel === 2 ? 3 : 4} />}
    </section>
  )
}
