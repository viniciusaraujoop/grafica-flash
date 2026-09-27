import Link from 'next/link'
import type { AcademyLibraryState } from '@/lib/orcaly-next/academy/types'
import type { ContinueLearningItem, LearningSuggestion } from '@/lib/orcaly-next/academy/continue'
import { CONTENT_TYPE_LABEL, readHref } from '@/lib/orcaly-next/academy/library'
import { formatClock } from '@/lib/orcaly-next/academy/reading'
import { StatusPill } from '../foundation/primitives'
import ProgressIndicator from './ProgressIndicator'
import AcademyEmptyState from './AcademyEmptyState'
import styles from './academy.module.css'

/**
 * "Continuar": deterministic, rule-based list (not a recommendation engine).
 * Each entry shows the rule id and the reason it is here.
 */
export default function ContinueLearning({ items, state, suggestions = [], headingLevel = 3 }: { items: readonly ContinueLearningItem[]; state: AcademyLibraryState; suggestions?: readonly LearningSuggestion[]; headingLevel?: 3 | 4 }) {
  if (!items.length) return <AcademyEmptyState kind="continue" headingLevel={headingLevel} />
  const Heading = `h${headingLevel}` as 'h3' | 'h4'
  return (
    <ol className={styles.continueList} data-testid="continue-learning">
      {items.map((entry, index) => {
        const progress = state.progress.find((p) => p.contentId === entry.content.id && p.userId === state.userId)
        const position = progress?.position ?? null
        const anchor = position?.kind === 'ANCHOR' ? position.anchor : undefined
        const section = anchor ? entry.content.sections?.find((s) => s.anchor === anchor) : undefined
        const href = readHref(entry.content.id, anchor)
        const almost = suggestions.find((s) => s.ruleId === 'COMPLETE_ALMOST_FINISHED' && s.contentId === entry.content.id)
        const resume = section ? `Retomar em “${section.heading}”` : position?.kind === 'SECONDS' ? `Retomar em ${formatClock(position.seconds)}` : position?.kind === 'PAGE' ? `Retomar na página ${position.page}` : null
        return (
          <li key={`${entry.ruleId}-${entry.content.id}`} className={`${styles.continueItem} ${index === 0 ? styles.continueFirst : ''}`} data-rule={entry.ruleId}>
            <span className={styles.cardType}>{`${CONTENT_TYPE_LABEL[entry.content.type]} · ${entry.source}`}</span>
            <Heading>{href ? <Link href={href}>{entry.content.title}</Link> : entry.content.title}</Heading>
            {resume ? <p className={styles.cardSubtitle}>{resume}</p> : null}
            {progress ? <ProgressIndicator value={progress.progress} label="Leitura" /> : null}
            {almost ? <p className={styles.rule} data-rule-extra={almost.ruleId}><StatusPill tone="accent">Falta pouco</StatusPill> {almost.reason} <code>{almost.ruleId}</code></p> : null}
            <p className={styles.rule}>{entry.reason} <code>{entry.ruleId}</code></p>
          </li>
        )
      })}
    </ol>
  )
}
