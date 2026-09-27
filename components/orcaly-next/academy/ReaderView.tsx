'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { AcademyBookmark, AcademyContentItem, AcademyLibraryState, AcademyProgress, AcademyTrack, ResumePosition } from '@/lib/orcaly-next/academy/types'
import { AVAILABILITY_COPY, deriveAvailability, formatBpsPercent, formatDuration } from '@/lib/orcaly-next/academy/core'
import { canComplete, completeContent, emptyProgress, updateProgress } from '@/lib/orcaly-next/academy/progress'
import { addBookmark, removeBookmark, bookmarkKey } from '@/lib/orcaly-next/academy/notes'
import { CONTENT_TYPE_LABEL, PROGRESS_LABEL, durationUnit, trackHref } from '@/lib/orcaly-next/academy/library'
import { DEFAULT_READING_PREFS, READING_WIDTH_CH, formatDateBR, type ReadingPrefs } from '@/lib/orcaly-next/academy/reading'
import { FoundationRoot, StateBlock, StatusPill, foundationStyles as f } from '../foundation/primitives'
import AcademyBlockedState from './AcademyBlockedState'
import BookmarksPanel from './BookmarksPanel'
import LicenseBadge from './LicenseBadge'
import MediaLessonPlaceholder from './MediaLessonPlaceholder'
import NotesPanel from './NotesPanel'
import ProgressIndicator from './ProgressIndicator'
import ReadingControls from './ReadingControls'
import SourceAttribution from './SourceAttribution'
import styles from './academy.module.css'

type Props = {
  item: AcademyContentItem
  state: AcademyLibraryState
  now: string
  track?: AcademyTrack | null
  /** Extra framing above the article (e.g. lesson navigation). */
  before?: ReactNode
  initialPrefs?: ReadingPrefs
  /** App theme from the shell; the reader's "Igual ao app" option follows it. */
  appTheme?: 'light' | 'dark'
}

const POLICY_TEXT = (item: AcademyContentItem): string => {
  const policy = item.completion
  if (policy.kind === 'MANUAL') return 'Conclusão manual: você marca quando terminar.'
  if (policy.kind === 'READING_THRESHOLD') return `Pode ser concluído depois de registrar pelo menos ${policy.thresholdBps / 100}% da leitura. Abrir não conclui.`
  if (policy.kind === 'PLAYBACK_THRESHOLD') return `Pode ser concluído depois de ${policy.thresholdBps / 100}% de reprodução medida. Abrir não conclui.`
  return 'Concluído quando todos os itens obrigatórios forem concluídos.'
}

/**
 * Editorial reader. Scoped typography (serif only inside the article body), bounded
 * controls, explicit progress and completion, private notes and bookmarks.
 * Demo: all changes live in component state; nothing is persisted.
 */
export default function ReaderView({ item, state, now, track = null, before, initialPrefs = DEFAULT_READING_PREFS, appTheme }: Props) {
  const availability = deriveAvailability(item, now)
  const userId = state.userId
  const [progress, setProgress] = useState<AcademyProgress>(() => state.progress.find((p) => p.contentId === item.id && p.userId === userId) ?? emptyProgress(item.id, userId))
  const [bookmarks, setBookmarks] = useState<AcademyBookmark[]>(() => state.bookmarks.filter((b) => b.userId === userId))
  const [prefs, setPrefs] = useState<ReadingPrefs>(initialPrefs)
  const [compose, setCompose] = useState<{ anchor: string | null; nonce: number } | null>(null)
  const [sectionMessage, setSectionMessage] = useState<{ anchor: string; text: string } | null>(null)
  const [completionMessage, setCompletionMessage] = useState('')
  const [bookmarkMessage, setBookmarkMessage] = useState('')
  const [eventCounter, setEventCounter] = useState(1)

  const isMedia = item.type === 'VIDEO' || item.type === 'AUDIO'
  const sections = item.sections ?? []
  const readable = availability === 'AVAILABLE' && !isMedia && sections.length > 0
  const titleId = `leitura-${item.id}`
  const contentBookmarks = bookmarks.filter((b) => b.contentId === item.id)
  const findBookmark = (target: AcademyBookmark['target']) => contentBookmarks.find((b) => bookmarkKey(b) === bookmarkKey({ userId, contentId: item.id, target }))

  const resumeSection = progress.position?.kind === 'ANCHOR'
    ? sections.find((s) => progress.position?.kind === 'ANCHOR' && s.anchor === progress.position.anchor)
    : progress.position?.kind === 'PAGE' ? sections[progress.position.page - 1] : undefined

  function toggleBookmark(target: AcademyBookmark['target'], label: string, anchor: string | null) {
    const existing = findBookmark(target)
    if (existing) {
      setBookmarks((list) => removeBookmark(list, existing.id, userId))
      const text = `Favorito removido (${label}). Progresso e notas continuam intactos.`
      if (anchor) setSectionMessage({ anchor, text }); else setBookmarkMessage(text)
      return
    }
    const result = addBookmark(bookmarks, item, { id: `fav-local-${item.id}-${anchor ?? 'conteudo'}`, userId, target, createdAt: now })
    if (!result.ok) { if (anchor) setSectionMessage({ anchor, text: result.message }); return }
    setBookmarks(result.list)
    const text = `Adicionado aos favoritos (${label}).`
    if (anchor) setSectionMessage({ anchor, text }); else setBookmarkMessage(text)
  }

  function recordReading(index: number) {
    const anchor = sections[index].anchor
    const measured = Math.floor(((index + 1) * 10000) / sections.length)
    const bps = progress.progress.kind === 'KNOWN' ? Math.max(progress.progress.value, measured) : measured
    const position: ResumePosition = item.type === 'DOCUMENT' ? { kind: 'PAGE', page: index + 1 } : { kind: 'ANCHOR', anchor }
    const result = updateProgress(item, progress, { expectedVersion: progress.version, at: now, progressBps: item.completion.kind === 'MANUAL' ? undefined : bps, position })
    if (!result.ok) { setSectionMessage({ anchor, text: `Não foi possível registrar: ${result.message}.` }); return }
    setProgress(result.progress)
    setSectionMessage({ anchor, text: item.completion.kind === 'MANUAL'
      ? `Ponto de retomada salvo em “${sections[index].heading}”. Esta lição é concluída manualmente.`
      : `Leitura registrada até “${sections[index].heading}” (${result.progress.progress.kind === 'KNOWN' ? `${result.progress.progress.value / 100}%` : 'progresso desconhecido'}).` })
  }

  function complete() {
    const result = completeContent(item, progress, { expectedVersion: progress.version, at: now, availability, eventId: `conclusao-local-${eventCounter}` })
    setEventCounter((n) => n + 1)
    if (!result.ok) { setCompletionMessage(`Ainda não pode ser concluído: ${result.message}.`); return }
    setProgress(result.progress)
    setCompletionMessage(`Concluído por ação sua. ${item.completion.kind === 'MANUAL' ? 'Conclusão manual.' : 'O limiar declarado foi atingido.'} Demonstração: nada é salvo.`)
  }

  const check = canComplete(item, progress, availability)
  const policy = item.completion
  const whyNot = check.allowed ? '' : (policy.kind === 'READING_THRESHOLD' || policy.kind === 'PLAYBACK_THRESHOLD') && progress.progress.kind === 'KNOWN'
    ? `leitura registrada em ${formatBpsPercent(progress.progress)}, abaixo do limiar de ${formatBpsPercent({ kind: 'KNOWN', value: policy.thresholdBps })} para concluir`
    : check.reason
  const vars = {
    '--reader-font': `${prefs.fontPx}px`,
    '--reader-leading': String(prefs.leadingTenths / 10),
    '--reader-width': `${READING_WIDTH_CH[prefs.width]}ch`,
  } as CSSProperties
  const copy = AVAILABILITY_COPY[availability]
  const contentMark = findBookmark({ kind: 'CONTENT' })
  // A completion recorded before the item became blocked/unavailable is kept but never shown as current.
  const staleCompletion = progress.status === 'COMPLETED' && availability !== 'AVAILABLE' && availability !== 'EXTERNAL_ONLY'
  const recordLabel = item.completion.kind === 'MANUAL' ? 'Retomar daqui depois' : 'Registrar leitura até aqui'

  const column = (
    <>
      {before}
      <article className={styles.readerHeader} aria-labelledby={titleId} data-testid="reader-article" data-availability={availability}>
        {track ? <Link className={styles.backLink} href={trackHref(track.id) ?? '#'}>{`← Voltar à trilha: ${track.title}`}</Link> : null}
        <p className={styles.eyebrow}>{CONTENT_TYPE_LABEL[item.type]}</p>
        <h1 id={titleId}>{item.title}</h1>
        {item.subtitle ? <p className={styles.readerSubtitle}>{item.subtitle}</p> : null}
        <ul className={styles.meta}>
          <li>{item.author ? item.author.name : 'Autoria não informada'}</li>
          <li>{formatDuration(item.duration, durationUnit(item))}</li>
          {item.type === 'DOCUMENT' ? <li>{item.pages.kind === 'KNOWN' ? `${item.pages.value} páginas` : 'Número de páginas não informado'}</li> : null}
        </ul>
        <div className={styles.actions}>
          <StatusPill tone={copy.tone}>{copy.label}</StatusPill>
          {staleCompletion
            ? <StatusPill tone="neutral">Conclusão anterior · não conta</StatusPill>
            : <StatusPill tone={progress.status === 'COMPLETED' ? 'success' : progress.status === 'IN_PROGRESS' ? 'accent' : 'neutral'}>{PROGRESS_LABEL[progress.status]}</StatusPill>}
          <LicenseBadge license={item.license} now={now} />
        </div>
        {isMedia || !readable ? null : <ProgressIndicator value={item.completion.kind === 'MANUAL' && progress.progress.kind !== 'KNOWN' ? { kind: 'NOT_APPLICABLE' } : progress.progress} label="Leitura" />}
        <div className={styles.actions}>
          {readable && resumeSection ? <a className={styles.backLink} href={`#${resumeSection.anchor}`}>{`Retomar em “${resumeSection.heading}”`}</a> : null}
          <a className={styles.backLink} href="#leitura-notas">Ir para suas notas</a>
        </div>
        {readable ? <ReadingControls prefs={prefs} onChange={setPrefs} idPrefix={`ajustes-${item.id}`} /> : null}
        {readable ? (
          <nav className={styles.toc} aria-labelledby={`${titleId}-toc`}>
            <h2 id={`${titleId}-toc`}>Nesta leitura</h2>
            <ol>{sections.map((section) => <li key={section.anchor}><a href={`#${section.anchor}`}>{section.heading}</a></li>)}</ol>
          </nav>
        ) : null}
        {isMedia && (availability === 'AVAILABLE' || availability === 'COMING_SOON')
          ? <MediaLessonPlaceholder item={item} progress={progress} />
          : availability !== 'AVAILABLE' ? <AcademyBlockedState item={item} availability={availability} now={now} />
          : !readable && !isMedia ? <StateBlock kind="not-configured" title="Texto ainda não carregado" headingLevel={2}>Os metadados existem, mas o corpo deste conteúdo ainda não foi publicado.</StateBlock>
          : null}
        {readable ? (
          <div className={styles.readerContent} data-testid="reader-content">
            {sections.map((section, index) => {
              const target = { kind: 'ANCHOR' as const, anchor: section.anchor }
              const marked = Boolean(findBookmark(target))
              return (
                <section key={section.anchor} id={section.anchor} aria-labelledby={`h-${section.anchor}`}>
                  <h2 id={`h-${section.anchor}`}>{section.heading}</h2>
                  {section.paragraphs.map((paragraph, p) => <p key={p}>{paragraph}</p>)}
                  <div className={styles.sectionActions}>
                    <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={() => recordReading(index)} aria-label={`${recordLabel}: ${section.heading}`}>
                      {recordLabel}
                    </button>
                    <button type="button" className={`${f.button} ${f.buttonQuiet}`} aria-pressed={marked} onClick={() => toggleBookmark(target, section.heading, section.anchor)} aria-label={`${marked ? 'Seção favoritada' : 'Favoritar seção'}: ${section.heading}`}>
                      {marked ? 'Seção favoritada' : 'Favoritar seção'}
                    </button>
                    <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={() => setCompose((c) => ({ anchor: section.anchor, nonce: (c?.nonce ?? 0) + 1 }))} aria-label={`Anotar nesta seção: ${section.heading}`}>
                      Anotar nesta seção
                    </button>
                    <p className={styles.status} role="status">{sectionMessage?.anchor === section.anchor ? sectionMessage.text : ''}</p>
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}
      </article>
      <section className={styles.completion} aria-labelledby={`${titleId}-done`} data-testid="completion">
        <h2 id={`${titleId}-done`}>Concluir</h2>
        <p className={styles.hint}>{POLICY_TEXT(item)}</p>
        {staleCompletion
          ? <p className={styles.notice} data-stale-completion="true">{`Existe um registro de conclusão de ${formatDateBR(progress.completedAt)}, mas este conteúdo está indisponível agora (${AVAILABILITY_COPY[availability].label.toLowerCase()}). Ele não conta como concluído em trilhas enquanto não for liberado; o registro é preservado.`}</p>
          : progress.status === 'COMPLETED'
          ? <p><StatusPill tone="success">{`Concluído em ${formatDateBR(progress.completedAt)}`}</StatusPill></p>
          : (
            <div className={styles.actions}>
              <button type="button" className={`${f.button} ${f.buttonPrimary}`} onClick={complete} disabled={!check.allowed} aria-describedby={`${titleId}-done-why`}>Marcar como concluído</button>
              <span className={styles.hint} id={`${titleId}-done-why`}>{check.allowed ? 'Disponível: a política declarada permite concluir agora.' : `Indisponível: ${whyNot}.`}</span>
            </div>
          )}
        <p className={styles.status} role="status">{completionMessage}</p>
      </section>
      <SourceAttribution item={item} now={now} />
    </>
  )

  return (
    <div className={styles.readerLayout}>
      <div className={styles.readerColumn} style={vars} data-reader-theme={prefs.theme} data-reader-font={prefs.fontPx}>
        {/* Always the same wrapper element, so changing the reading theme never remounts the column. */}
        <FoundationRoot skin="academy" theme={prefs.theme === 'inherit' ? appTheme : prefs.theme} className={styles.readerThemed}>{column}</FoundationRoot>
      </div>
      <aside id="leitura-notas" className={styles.readerAside} aria-label="Notas e favoritos deste conteúdo" tabIndex={-1}>
        <div className={styles.panel}>
          <h2>Favorito</h2>
          <button type="button" className={f.button} aria-pressed={Boolean(contentMark)} onClick={() => toggleBookmark({ kind: 'CONTENT' }, 'conteúdo inteiro', null)}>
            {contentMark ? 'Nos seus favoritos' : 'Favoritar conteúdo'}
          </button>
          <p className={styles.status} role="status">{bookmarkMessage}</p>
        </div>
        <NotesPanel initialNotes={state.notes} items={state.items} userId={userId} now={now} contentId={item.id} compose={compose} />
        <BookmarksPanel bookmarks={contentBookmarks} items={state.items} userId={userId} scopedToContent
          onRemove={(id) => { setBookmarks((list) => removeBookmark(list, id, userId)); setBookmarkMessage('Favorito removido. Progresso e notas continuam intactos.') }} />
      </aside>
    </div>
  )
}
