import type { GrowthSource } from '@/lib/orcaly-next/growth/types'
import { SOURCE_STATUS_COPY } from '@/lib/orcaly-next/growth/providers'
import { StatusPill } from '../foundation/primitives'
import styles from './growth.module.css'

/** Honest source list: only MANUAL and NOT_CONFIGURED exist in the MVP. */
export default function SourceStatus({ sources, headingLevel = 3 }: { sources: readonly GrowthSource[]; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  return (
    <ul className={styles.sources}>
      {sources.map((source) => {
        const copy = SOURCE_STATUS_COPY[source.status]
        return (
          <li key={source.id} className={styles.source} data-source-status={source.status}>
            <div className={styles.sourceHead}>
              <Heading style={{ fontSize: 'var(--ox-text-md)' }}>{source.label}</Heading>
              <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
            </div>
            <p className={styles.meta}>{copy.detail}</p>
          </li>
        )
      })}
    </ul>
  )
}
