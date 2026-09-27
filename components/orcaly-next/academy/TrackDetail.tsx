import Link from 'next/link'
import type { AcademyLibraryState, AcademyTrack } from '@/lib/orcaly-next/academy/types'
import { nextTrackItem, trackItemViews, trackProgress } from '@/lib/orcaly-next/academy/tracks'
import { CONTENT_TYPE_LABEL, PROGRESS_LABEL, durationUnit, readHref } from '@/lib/orcaly-next/academy/library'
import { AVAILABILITY_COPY, formatDuration } from '@/lib/orcaly-next/academy/core'
import { formatDateBR } from '@/lib/orcaly-next/academy/reading'
import { StateBlock, StatusPill } from '../foundation/primitives'
import TrackProgress from './TrackProgress'
import AcademyEmptyState from './AcademyEmptyState'
import styles from './academy.module.css'

/** Ordered track: position, availability, prerequisites and the next unit. Blocked items never count. */
export default function TrackDetail({ track, state, now }: { track: AcademyTrack; state: AcademyLibraryState; now: string }) {
  const mine = state.progress.filter((entry) => entry.userId === state.userId)
  const views = trackItemViews(track, state.items, mine, now)
  const summary = trackProgress(views)
  const next = nextTrackItem(views)
  const enrollment = state.enrollments.find((entry) => entry.trackId === track.id && entry.userId === state.userId)
  const titleOf = (id: string) => state.items.find((entry) => entry.id === id)?.title ?? id
  return (
    <>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Trilha</p>
        <h1>{track.title}</h1>
        <p className={styles.lead}>{track.description}</p>
        <ul className={styles.meta}>
          <li>{`${views.length} ${views.length === 1 ? 'item' : 'itens'}`}</li>
          <li>{track.estimatedMinutes.kind === 'KNOWN' ? `Estimativa: ${formatDuration(track.estimatedMinutes, 'minutes')}` : 'Estimativa não informada'}</li>
          <li>{enrollment ? `Inscrito em ${formatDateBR(enrollment.enrolledAt)}` : 'Você não está inscrito'}</li>
        </ul>
      </div>
      <section className={styles.section} aria-labelledby="trilha-progresso">
        <div className={styles.sectionHead}><h2 id="trilha-progresso">Seu progresso</h2><p>Conta apenas itens obrigatórios disponíveis.</p></div>
        {enrollment
          ? <TrackProgress summary={summary} />
          : <StateBlock kind="not-configured" title="Inscrição ainda não disponível" headingLevel={3}>Neste protótipo não há persistência: a inscrição será habilitada quando o contrato de API for implementado. Você pode ler os itens disponíveis.</StateBlock>}
      </section>
      <section className={styles.section} aria-labelledby="trilha-itens">
        <div className={styles.sectionHead}><h2 id="trilha-itens">Itens da trilha</h2><p>Em ordem. Itens bloqueados por licença aparecem, mas não contam.</p></div>
        {views.length === 0 ? <AcademyEmptyState kind="library">Esta trilha ainda não tem itens publicados.</AcademyEmptyState> : (
          <ol className={styles.trackItems} data-testid="track-items">
            {views.map((view, index) => {
              const content = view.content
              const copy = AVAILABILITY_COPY[view.availability]
              const isNext = next?.item.contentId === view.item.contentId
              const href = content && !view.locked ? readHref(content.id) : null
              const missing = view.item.prerequisites.filter((id) => mine.find((entry) => entry.contentId === id)?.status !== 'COMPLETED')
              return (
                <li key={view.item.contentId} className={`${styles.trackItem} ${isNext ? styles.trackItemNext : ''}`} data-availability={view.availability} data-locked={view.locked ? 'true' : 'false'} data-countable={view.countable ? 'true' : 'false'}>
                  <span className={styles.trackIndex} aria-hidden="true">{index + 1}</span>
                  <div className={styles.trackBody}>
                    <h3>{href ? <Link href={href}>{content?.title}</Link> : (content?.title ?? 'Conteúdo não encontrado')}</h3>
                    <ul className={styles.meta}>
                      {content ? <li>{CONTENT_TYPE_LABEL[content.type]}</li> : null}
                      {content ? <li>{formatDuration(content.duration, durationUnit(content))}</li> : null}
                      <li>{view.item.required ? 'Obrigatório' : 'Opcional'}</li>
                    </ul>
                    <div className={styles.actions}>
                      <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
                      <StatusPill tone={view.status === 'COMPLETED' ? 'success' : view.status === 'IN_PROGRESS' ? 'accent' : 'neutral'}>{PROGRESS_LABEL[view.status]}</StatusPill>
                      {isNext ? <StatusPill tone="accent">Próxima unidade</StatusPill> : null}
                    </div>
                    {view.locked ? <p className={styles.lockNote}>{`Desbloqueia após concluir: ${missing.map(titleOf).join(', ')}.`}</p> : null}
                    {view.availability === 'BLOCKED_LICENSE' && view.item.required ? <p className={styles.lockNote}>Obrigatório, mas bloqueado por licença: não conta como concluído mesmo com progresso antigo.</p> : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </>
  )
}
