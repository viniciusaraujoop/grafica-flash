import Link from 'next/link'
import type { Suggestion } from '@/lib/orcaly-next/growth/suggestions'
import type { GrowthExperiment } from '@/lib/orcaly-next/growth/types'
import { experimentHref } from '@/lib/orcaly-next/growth/workspace'
import styles from './growth.module.css'

/** Each suggestion shows the explicit rule that produced it ("por que estou vendo isso"). */
export default function SuggestionList({ suggestions, experiments }: { suggestions: readonly Suggestion[]; experiments: readonly GrowthExperiment[] }) {
  return (
    <ul className={styles.suggestions}>
      {suggestions.map((suggestion) => {
        const experiment = experiments.find((entry) => entry.id === suggestion.experimentId)
        const href = experimentHref(suggestion.experimentId)
        return (
          <li key={`${suggestion.experimentId}-${suggestion.ruleId}`} className={`${styles.suggestion} ${suggestion.severity === 'next' ? styles.suggestionNext : ''}`} data-rule={suggestion.ruleId}>
            <strong>{suggestion.title}</strong>
            {experiment ? <span className={styles.meta}>{href ? <Link href={href}>{experiment.title}</Link> : experiment.title}</span> : null}
            <p>{suggestion.action}</p>
            <span className={styles.rule}>Regra <code>{suggestion.ruleId}</code>: {suggestion.rule}</span>
          </li>
        )
      })}
    </ul>
  )
}
