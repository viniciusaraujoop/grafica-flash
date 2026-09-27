import Link from 'next/link'
import type { AcademyCategory } from '@/lib/orcaly-next/academy/types'
import type { LibraryRow } from '@/lib/orcaly-next/academy/library'
import { CONTENT_TYPE_LABEL, PROGRESS_LABEL, durationUnit, readHref } from '@/lib/orcaly-next/academy/library'
import { AVAILABILITY_COPY, formatDuration } from '@/lib/orcaly-next/academy/core'
import { StatusPill } from '../foundation/primitives'
import styles from './academy.module.css'

/** One library item. Availability and progress are always text; unknown duration says so. */
export default function LibraryCard({ row, categories, headingLevel = 3 }: { row: LibraryRow; categories: readonly AcademyCategory[]; headingLevel?: 2 | 3 | 4 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const { item, availability, status } = row
  const href = readHref(item.id)
  const copy = AVAILABILITY_COPY[availability]
  const category = item.categories.map((id) => categories.find((entry) => entry.id === id)?.label ?? id).join(', ')
  return (
    <article className={styles.card} data-availability={availability} data-content-type={item.type}>
      <div className={styles.cardTop}>
        <span className={styles.cardType}>{CONTENT_TYPE_LABEL[item.type]}</span>
        <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
      </div>
      <Heading className={styles.cardTitle}>{href ? <Link href={href}>{item.title}</Link> : item.title}</Heading>
      {item.subtitle ? <p className={styles.cardSubtitle}>{item.subtitle}</p> : null}
      <ul className={styles.meta}>
        <li>{item.author ? item.author.name : 'Autoria não informada'}</li>
        <li>{formatDuration(item.duration, durationUnit(item))}</li>
        {category ? <li>{category}</li> : null}
      </ul>
      <div className={styles.cardFoot}>
        {status === 'COMPLETED' && availability !== 'AVAILABLE' && availability !== 'EXTERNAL_ONLY'
          ? <span className={styles.badgeWrap}><StatusPill tone="neutral">Conclusão anterior · não conta</StatusPill></span>
          : <StatusPill tone={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'accent' : 'neutral'}>{PROGRESS_LABEL[status]}</StatusPill>}
      </div>
    </article>
  )
}
