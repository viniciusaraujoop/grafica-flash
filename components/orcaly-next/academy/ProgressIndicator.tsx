import type { Known } from '@/lib/orcaly-next/academy/types'
import { formatBpsPercent } from '@/lib/orcaly-next/academy/core'
import styles from './academy.module.css'

/**
 * Progress in basis points. KNOWN renders text + a decorative bar; UNKNOWN and
 * NOT_APPLICABLE render text only — never "0%" for missing data.
 */
export default function ProgressIndicator({ value, label = 'Progresso' }: { value: Known<number>; label?: string }) {
  return (
    <div className={styles.progress} data-progress={value.kind}>
      <span>{label}: <strong>{formatBpsPercent(value)}</strong></span>
      {value.kind === 'KNOWN'
        ? <span className={styles.progressTrack} aria-hidden="true"><span className={styles.progressFill} style={{ width: `${value.value / 100}%` }} /></span>
        : value.kind === 'UNKNOWN' ? <span className={styles.progressNote}>{value.reason}</span> : null}
    </div>
  )
}
