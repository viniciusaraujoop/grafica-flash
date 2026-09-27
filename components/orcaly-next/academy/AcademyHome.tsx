import Link from 'next/link'
import type { AcademyLibraryState } from '@/lib/orcaly-next/academy/types'
import { activeTracks, buildContinueLearning, learningSuggestions } from '@/lib/orcaly-next/academy/continue'
import { trackItemViews } from '@/lib/orcaly-next/academy/tracks'
import { ACADEMY_ROUTES, DEFAULT_FILTER, filterLibrary } from '@/lib/orcaly-next/academy/library'
import { noteHref } from '@/lib/orcaly-next/academy/notes'
import { formatDateBR } from '@/lib/orcaly-next/academy/reading'
import { StatusPill } from '../foundation/primitives'
import AcademyEmptyState from './AcademyEmptyState'
import AcademyShell from './AcademyShell'
import ContinueLearning from './ContinueLearning'
import LibraryCard from './LibraryCard'
import TrackCard from './TrackCard'
import styles from './academy.module.css'

/**
 * Academy home, in the required order: Continuar → Trilhas em andamento → Biblioteca →
 * Notas recentes → Descobrir. No vanity metrics (hours studied, "productivity" scores).
 */
export default function AcademyHome({ state, now, demoLabel, theme }: { state: AcademyLibraryState; now: string; demoLabel?: string; theme?: 'light' | 'dark' }) {
  const mine = state.progress.filter((p) => p.userId === state.userId)
  const continueItems = buildContinueLearning(state, now, 3)
  const suggestions = learningSuggestions(state, now)
  const active = activeTracks(state)
  const activeIds = new Set(active.map((t) => t.id))
  const discover = state.tracks.filter((t) => t.publication === 'PUBLISHED' && !activeIds.has(t.id))
  const recent = filterLibrary(state.items, mine, { ...DEFAULT_FILTER, availability: 'AVAILABLE', sort: 'recent' }, now).slice(0, 3)
  const notes = state.notes.filter((n) => n.userId === state.userId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1)).slice(0, 3)
  const review = suggestions.find((s) => s.ruleId === 'REVIEW_NOTE')
  const titleOf = (id: string) => state.items.find((i) => i.id === id)?.title ?? 'Conteúdo removido'
  const usedCategories = state.categories.filter((c) => state.items.some((i) => i.publication === 'PUBLISHED' && i.categories.includes(c.id)))

  return (
    <AcademyShell current="home" demoLabel={demoLabel} theme={theme}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Academy</p>
        <h1>Continue de onde parou</h1>
        <p className={styles.lead}>Sua biblioteca pessoal: trilhas, leituras, progresso e notas privadas. Nada aqui é comparado com outras pessoas.</p>
      </div>

      <section className={styles.section} aria-labelledby="home-continuar">
        <div className={styles.sectionHead}><h2 id="home-continuar">Continuar</h2><p>Por regra fixa: em andamento, próxima unidade de trilha, favorito recente.</p></div>
        <ContinueLearning items={continueItems} state={state} suggestions={suggestions} />
      </section>

      <section className={styles.section} aria-labelledby="home-trilhas">
        <div className={styles.sectionHead}><h2 id="home-trilhas">Trilhas em andamento</h2><p>Só itens obrigatórios disponíveis contam.</p></div>
        {active.length ? (
          <ul className={styles.gridTwo}>
            {active.map((track) => <li key={track.id}><TrackCard track={track} views={trackItemViews(track, state.items, mine, now)} enrolled /></li>)}
          </ul>
        ) : <AcademyEmptyState kind="tracks" />}
      </section>

      <section className={styles.section} aria-labelledby="home-biblioteca">
        <div className={styles.sectionHead}><h2 id="home-biblioteca">Biblioteca</h2><Link className={styles.sectionLink} href={ACADEMY_ROUTES.library}>Ver biblioteca completa</Link></div>
        {recent.length ? (
          <ul className={styles.grid}>{recent.map((row) => <li key={row.item.id}><LibraryCard row={row} categories={state.categories} /></li>)}</ul>
        ) : <AcademyEmptyState kind="library" />}
      </section>

      <section className={styles.section} aria-labelledby="home-notas">
        <div className={styles.sectionHead}><h2 id="home-notas">Notas recentes</h2><Link className={styles.sectionLink} href={ACADEMY_ROUTES.notes}>Todas as notas</Link></div>
        {notes.length ? (
          <ul className={styles.noteList}>
            {notes.map((note) => (
              <li key={note.id} className={styles.note} data-sample={note.sample ? 'true' : 'false'}>
                <div className={styles.noteHead}>{note.sample ? <StatusPill tone="warning">Exemplo</StatusPill> : <StatusPill tone="neutral">Privada</StatusPill>}<span>{formatDateBR(note.updatedAt)}</span></div>
                <p className={styles.noteTarget}><Link href={noteHref(note)}>{titleOf(note.contentId)}</Link></p>
                <p className={styles.noteText}>{note.text}</p>
              </li>
            ))}
          </ul>
        ) : <AcademyEmptyState kind="notes" />}
        {review ? <p className={styles.rule} data-rule={review.ruleId}>{`${review.title}. ${review.reason}`} <code>{review.ruleId}</code></p> : null}
      </section>

      <section className={styles.section} aria-labelledby="home-descobrir">
        <div className={styles.sectionHead}><h2 id="home-descobrir">Descobrir</h2><p>Trilhas publicadas e temas da biblioteca.</p></div>
        {discover.length ? (
          <ul className={styles.gridTwo}>
            {discover.map((track) => <li key={track.id}><TrackCard track={track} views={trackItemViews(track, state.items, mine, now)} enrolled={false} /></li>)}
          </ul>
        ) : null}
        {usedCategories.length ? (
          <ul className={styles.chips} aria-label="Temas">
            {usedCategories.map((c) => <li key={c.id}><Link href={`${ACADEMY_ROUTES.library}?categoria=${c.id}`}>{c.label}</Link></li>)}
          </ul>
        ) : null}
        {!discover.length && !usedCategories.length ? <AcademyEmptyState kind="library" /> : null}
      </section>
    </AcademyShell>
  )
}
