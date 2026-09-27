'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AcademyLibraryState } from '@/lib/orcaly-next/academy/types'
import { DEFAULT_FILTER, filterLibrary, trackHref, type LibraryFilter } from '@/lib/orcaly-next/academy/library'
import { buildSearchIndex, searchLibrary, toSearchDocuments } from '@/lib/orcaly-next/academy/search'
import { foundationStyles as f } from '../foundation/primitives'
import AcademyEmptyState from './AcademyEmptyState'
import AcademySearch from './AcademySearch'
import LibraryCard from './LibraryCard'
import LibraryFilters from './LibraryFilters'
import styles from './academy.module.css'

/**
 * Library: search + filters + cards. Drafts never appear. Search results pass through the
 * same filters; tracks appear in results only when no filter is active.
 */
export default function AcademyLibrary({ state, now, initialQuery = '', initialFilter = DEFAULT_FILTER }: { state: AcademyLibraryState; now: string; initialQuery?: string; initialFilter?: LibraryFilter }) {
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<LibraryFilter>(initialFilter)
  const mine = useMemo(() => state.progress.filter((p) => p.userId === state.userId), [state])
  const publishedTracks = useMemo(() => state.tracks.filter((t) => t.publication === 'PUBLISHED'), [state])
  const index = useMemo(() => buildSearchIndex(toSearchDocuments(state.items.filter((i) => i.publication !== 'DRAFT'), publishedTracks, state.categories)), [state, publishedTracks])
  const rows = useMemo(() => filterLibrary(state.items, mine, filter, now), [state, mine, filter, now])
  const languages = useMemo(() => [...new Set(state.items.map((i) => i.language))].sort(), [state])
  const defaultFilters = filter.type === 'ALL' && filter.category === 'ALL' && filter.status === 'ALL' && filter.availability === 'ALL' && filter.language === 'ALL'
  const searching = query.trim().length > 0
  const hits = searching ? searchLibrary(index, query) : []
  const rowById = new Map(rows.map((row) => [row.item.id, row]))
  // Keep the ranker's order; filters apply to content, tracks show only without filters.
  const visibleHits = hits.filter((hit) => (hit.document.kind === 'CONTENT' ? rowById.has(hit.document.id) : defaultFilters))
  const count = searching ? visibleHits.length : rows.length
  const reset = () => { setQuery(''); setFilter(DEFAULT_FILTER) }

  if (!state.items.length) return <AcademyEmptyState kind="library" headingLevel={2} />

  return (
    <div className={styles.section} data-testid="academy-library">
      <div className={styles.libraryTools}>
        <AcademySearch query={query} onQueryChange={setQuery} resultCount={searching ? count : null} />
        <LibraryFilters filter={filter} onChange={setFilter} onReset={() => setFilter(DEFAULT_FILTER)} categories={state.categories} languages={languages} />
      </div>
      <section className={styles.section} aria-labelledby="biblioteca-lista">
        <div className={styles.sectionHead}>
          <h2 id="biblioteca-lista">{searching ? 'Resultados da busca' : 'Conteúdos'}</h2>
          <p>{searching ? 'Ordenados por relevância; empates por título.' : `${rows.length} ${rows.length === 1 ? 'item' : 'itens'}`}</p>
        </div>
        {count === 0 ? (
          <AcademyEmptyState kind="no-results" action={<button type="button" className={f.button} onClick={reset}>Limpar busca e filtros</button>} />
        ) : (
          <ul className={styles.grid} data-testid="library-results">
            {searching
              ? visibleHits.map((hit) => {
                  if (hit.document.kind === 'CONTENT') {
                    const row = rowById.get(hit.document.id)
                    return row ? <li key={`c-${hit.document.id}`}><LibraryCard row={row} categories={state.categories} /></li> : null
                  }
                  const href = trackHref(hit.document.id)
                  return (
                    <li key={`t-${hit.document.id}`}>
                      <article className={styles.card} data-result-kind="TRACK">
                        <span className={styles.cardType}>Trilha</span>
                        <h3 className={styles.cardTitle}>{href ? <Link href={href}>{hit.document.title}</Link> : hit.document.title}</h3>
                        <p className={styles.cardSubtitle}>{hit.document.subtitle}</p>
                      </article>
                    </li>
                  )
                })
              : rows.map((row) => <li key={row.item.id}><LibraryCard row={row} categories={state.categories} /></li>)}
          </ul>
        )}
      </section>
    </div>
  )
}
