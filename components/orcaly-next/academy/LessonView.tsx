import Link from 'next/link'
import type { AcademyContentItem, AcademyLibraryState, AcademyTrack } from '@/lib/orcaly-next/academy/types'
import { trackItemViews } from '@/lib/orcaly-next/academy/tracks'
import { readHref } from '@/lib/orcaly-next/academy/library'
import ReaderView from './ReaderView'
import styles from './academy.module.css'

/**
 * A lesson inside a track: position ("Lição 2 de 4"), previous/next unit and the reader.
 * Next is a link only when it is unlocked and available; otherwise the reason is shown.
 */
export default function LessonView({ item, state, now, track, appTheme }: { item: AcademyContentItem; state: AcademyLibraryState; now: string; track: AcademyTrack | null; appTheme?: 'light' | 'dark' }) {
  if (!track) return <ReaderView item={item} state={state} now={now} appTheme={appTheme} />
  const views = trackItemViews(track, state.items, state.progress.filter((p) => p.userId === state.userId), now)
  const index = views.findIndex((view) => view.item.contentId === item.id)
  if (index < 0) return <ReaderView item={item} state={state} now={now} appTheme={appTheme} />
  const prev = views[index - 1]
  const next = views[index + 1]
  const nextOpen = next?.content && !next.locked && (next.availability === 'AVAILABLE' || next.availability === 'EXTERNAL_ONLY')
  const before = (
    <nav className={styles.lessonNav} aria-label="Navegação da trilha">
      <span className={styles.lessonMeta}>{`Item ${index + 1} de ${views.length} · ${track.title}`}</span>
      <span className={styles.actions}>
        {prev?.content ? <Link href={readHref(prev.content.id) ?? '#'}>{`← Anterior: ${prev.content.title}`}</Link> : null}
        {next?.content ? (nextOpen
          ? <Link href={readHref(next.content.id) ?? '#'}>{`Próximo: ${next.content.title} →`}</Link>
          : <span className={styles.lessonMeta}>{next.locked ? `Próximo bloqueado até concluir os pré-requisitos: ${next.content.title}` : `Próximo indisponível: ${next.content.title}`}</span>) : null}
      </span>
    </nav>
  )
  return <ReaderView item={item} state={state} now={now} track={track} before={before} appTheme={appTheme} />
}
