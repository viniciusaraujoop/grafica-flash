'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { AcademyBookmark, AcademyContentItem } from '@/lib/orcaly-next/academy/types'
import { removeBookmark } from '@/lib/orcaly-next/academy/notes'
import { readHref } from '@/lib/orcaly-next/academy/library'
import { formatClock, formatDateBR } from '@/lib/orcaly-next/academy/reading'
import { foundationStyles as f } from '../foundation/primitives'
import AcademyEmptyState from './AcademyEmptyState'
import styles from './academy.module.css'

type Props = {
  bookmarks: readonly AcademyBookmark[]
  items: readonly AcademyContentItem[]
  userId: string
  onRemove?: (id: string) => void
  headingLevel?: 2 | 3
  scopedToContent?: boolean
}

function targetLabel(bookmark: AcademyBookmark, item: AcademyContentItem | undefined): string {
  if (bookmark.target.kind === 'ANCHOR') { const anchor = bookmark.target.anchor; return `Seção: ${item?.sections?.find((s) => s.anchor === anchor)?.heading ?? anchor}` }
  if (bookmark.target.kind === 'SECONDS') return `Em ${formatClock(bookmark.target.seconds)}`
  return 'Conteúdo inteiro'
}

/** Private bookmarks (current user only). Removing one never touches progress or notes. */
export default function BookmarksPanel({ bookmarks, items, userId, onRemove, headingLevel = 2, scopedToContent = false }: Props) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const mine = bookmarks.filter((b) => b.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1))
  const headingId = scopedToContent ? 'favoritos-conteudo' : 'favoritos-todos'
  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="bookmarks-panel">
      <Heading id={headingId}>{scopedToContent ? 'Favoritos neste conteúdo' : 'Seus favoritos'}</Heading>
      {mine.length === 0 ? <AcademyEmptyState kind="bookmarks" headingLevel={headingLevel === 2 ? 3 : 4} /> : (
        <ul className={styles.bookmarkList}>
          {mine.map((bookmark) => {
            const item = items.find((entry) => entry.id === bookmark.contentId)
            const href = readHref(bookmark.contentId, bookmark.target.kind === 'ANCHOR' ? bookmark.target.anchor : undefined)
            const label = scopedToContent ? targetLabel(bookmark, item) : `${item?.title ?? 'Conteúdo removido'} · ${targetLabel(bookmark, item)}`
            return (
              <li key={bookmark.id} className={styles.bookmark} data-bookmark={bookmark.id}>
                <span className={styles.bookmarkMain}>
                  {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
                  <span className={styles.hint}>{`Favoritado em ${formatDateBR(bookmark.createdAt)}`}</span>
                </span>
                {onRemove ? <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={() => onRemove(bookmark.id)} aria-label={`Remover favorito: ${label}`}>Remover</button> : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Standalone favorites page body: holds its own (demo) state. */
export function BookmarksManager({ initial, items, userId }: { initial: readonly AcademyBookmark[]; items: readonly AcademyContentItem[]; userId: string }) {
  const [list, setList] = useState<AcademyBookmark[]>(() => [...initial])
  const [message, setMessage] = useState('')
  return (
    <>
      <p className={styles.status} role="status">{message}</p>
      <BookmarksPanel bookmarks={list} items={items} userId={userId} onRemove={(id) => { setList((current) => removeBookmark(current, id, userId)); setMessage('Favorito removido. Seu progresso e suas notas continuam intactos.') }} />
    </>
  )
}
