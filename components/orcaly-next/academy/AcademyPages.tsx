import type { AcademyLibraryState } from '@/lib/orcaly-next/academy/types'
import type { LibraryFilter } from '@/lib/orcaly-next/academy/library'
import { StateBlock } from '../foundation/primitives'
import AcademyLibrary from './AcademyLibrary'
import AcademyShell from './AcademyShell'
import { BookmarksManager } from './BookmarksPanel'
import LessonView from './LessonView'
import NotesPanel from './NotesPanel'
import TrackDetail from './TrackDetail'
import styles from './academy.module.css'

/**
 * Page-level views ready to be mounted by FUTURE routes (none exists yet):
 *   /apps/academy                 → AcademyHome (./AcademyHome)
 *   /apps/academy/biblioteca      → AcademyLibraryPage
 *   /apps/academy/trilhas/[id]    → AcademyTrackPage
 *   /apps/academy/ler/[id]        → AcademyReadPage
 *   /apps/academy/notas           → AcademyNotesPage
 *   /apps/academy/favoritos       → AcademyBookmarksPage
 */

type Common = { state: AcademyLibraryState; now: string; demoLabel?: string; theme?: 'light' | 'dark' }

export function AcademyLibraryPage({ state, now, demoLabel, theme, initialQuery, initialFilter }: Common & { initialQuery?: string; initialFilter?: LibraryFilter }) {
  return (
    <AcademyShell current="library" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Biblioteca</p>
        <h1>Biblioteca</h1>
        <p className={styles.lead}>Tudo o que está liberado para você, com o estado de cada item em texto: disponível, em breve, na fonte externa ou bloqueado por licença.</p>
      </div>
      <AcademyLibrary state={state} now={now} initialQuery={initialQuery} initialFilter={initialFilter} />
    </AcademyShell>
  )
}

export function AcademyTrackPage({ trackId, state, now, demoLabel, theme }: Common & { trackId: string }) {
  const track = state.tracks.find((t) => t.id === trackId && t.publication === 'PUBLISHED')
  return (
    <AcademyShell current="none" demoLabel={demoLabel} theme={theme}>
      {track ? <TrackDetail track={track} state={state} now={now} /> : (
        <>
          <div className={styles.intro}><p className={styles.eyebrow}>Trilha</p><h1>Trilha não encontrada</h1></div>
          <StateBlock kind="empty" title="Esta trilha não existe ou ainda não foi publicada" headingLevel={2}>Volte para a biblioteca para ver as trilhas disponíveis.</StateBlock>
        </>
      )}
    </AcademyShell>
  )
}

export function AcademyReadPage({ contentId, trackId, state, now, demoLabel, theme }: Common & { contentId: string; trackId?: string }) {
  const item = state.items.find((i) => i.id === contentId && i.publication !== 'DRAFT')
  const track = trackId ? state.tracks.find((t) => t.id === trackId && t.publication === 'PUBLISHED') ?? null : null
  return (
    <AcademyShell current="none" demoLabel={demoLabel} theme={theme}>
      {item ? <LessonView item={item} state={state} now={now} track={track} appTheme={theme} /> : (
        <>
          <div className={styles.intro}><p className={styles.eyebrow}>Leitura</p><h1>Conteúdo não encontrado</h1></div>
          <StateBlock kind="empty" title="Este conteúdo não existe ou não está publicado" headingLevel={2}>Volte para a biblioteca.</StateBlock>
        </>
      )}
    </AcademyShell>
  )
}

export function AcademyNotesPage({ state, now, demoLabel, theme }: Common) {
  return (
    <AcademyShell current="notes" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Notas</p>
        <h1>Notas</h1>
        <p className={styles.lead}>Privadas por padrão: não aparecem para outras pessoas nem em outros produtos Orçaly. Para criar uma nota, abra um conteúdo.</p>
      </div>
      <NotesPanel initialNotes={state.notes} items={state.items} userId={state.userId} now={now} />
    </AcademyShell>
  )
}

export function AcademyBookmarksPage({ state, demoLabel, theme }: Common) {
  return (
    <AcademyShell current="bookmarks" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Favoritos</p>
        <h1>Favoritos</h1>
        <p className={styles.lead}>Conteúdos e seções que você marcou para voltar. Remover um favorito não apaga progresso, notas ou histórico.</p>
      </div>
      <BookmarksManager initial={state.bookmarks} items={state.items} userId={state.userId} />
    </AcademyShell>
  )
}
