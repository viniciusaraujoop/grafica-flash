import Link from 'next/link'
import type { AcademyTrack } from '@/lib/orcaly-next/academy/types'
import type { TrackItemView } from '@/lib/orcaly-next/academy/tracks'
import { nextTrackItem, trackProgress } from '@/lib/orcaly-next/academy/tracks'
import { trackHref } from '@/lib/orcaly-next/academy/library'
import { formatDuration } from '@/lib/orcaly-next/academy/core'
import { StatusPill } from '../foundation/primitives'
import TrackProgress from './TrackProgress'
import styles from './academy.module.css'

export default function TrackCard({ track, views, enrolled, headingLevel = 3 }: { track: AcademyTrack; views: readonly TrackItemView[]; enrolled: boolean; headingLevel?: 2 | 3 | 4 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const href = trackHref(track.id)
  const next = nextTrackItem(views)
  return (
    <article className={styles.card} data-track={track.id}>
      <div className={styles.cardTop}>
        <span className={styles.cardType}>{`Trilha · ${views.length} ${views.length === 1 ? 'item' : 'itens'}`}</span>
        <StatusPill tone={enrolled ? 'accent' : 'neutral'}>{enrolled ? 'Inscrito' : 'Não inscrito'}</StatusPill>
      </div>
      <Heading className={styles.cardTitle}>{href ? <Link href={href}>{track.title}</Link> : track.title}</Heading>
      <p className={styles.cardSubtitle}>{track.description}</p>
      <ul className={styles.meta}><li>{track.estimatedMinutes.kind === 'KNOWN' ? `Estimativa: ${formatDuration(track.estimatedMinutes, 'minutes')}` : 'Estimativa não informada'}</li></ul>
      {enrolled ? <TrackProgress summary={trackProgress(views)} /> : null}
      {enrolled && next?.content ? <p className={styles.progressNote}>{`Próxima unidade: ${next.content.title}`}</p> : null}
    </article>
  )
}
