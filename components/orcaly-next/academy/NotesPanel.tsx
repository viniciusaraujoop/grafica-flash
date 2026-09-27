'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { AcademyContentItem, AcademyNote } from '@/lib/orcaly-next/academy/types'
import { readHref } from '@/lib/orcaly-next/academy/library'
import { formatClock, formatDateBR } from '@/lib/orcaly-next/academy/reading'
import { StatusPill, foundationStyles as f } from '../foundation/primitives'
import NoteEditor from './NoteEditor'
import AcademyEmptyState from './AcademyEmptyState'
import styles from './academy.module.css'

type Props = {
  initialNotes: readonly AcademyNote[]
  items: readonly AcademyContentItem[]
  userId: string
  now: string
  /** When set, notes are scoped to this content and a create form is shown. */
  contentId?: string
  headingLevel?: 2 | 3
  /** Request to start a note at a section: a new nonce focuses the editor. */
  compose?: { anchor: string | null; nonce: number } | null
}

/**
 * Private notes: only the current user's notes are ever listed. Demo notes are labeled
 * "Exemplo" and are read-only, so they are never presented as the user's writing.
 */
export default function NotesPanel({ initialNotes, items, userId, now, contentId, headingLevel = 2, compose }: Props) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const [notes, setNotes] = useState<AcademyNote[]>(() => initialNotes.filter((note) => note.userId === userId))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const counter = useRef(1)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const item = contentId ? items.find((entry) => entry.id === contentId) ?? null : null
  const visible = notes.filter((note) => !contentId || note.contentId === contentId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1))
  const headingId = `notas-${contentId ?? 'todas'}`

  useEffect(() => { if (compose) textareaRef.current?.focus() }, [compose])

  const titleOf = (id: string) => items.find((entry) => entry.id === id)?.title ?? 'Conteúdo removido'
  const targetOf = (note: AcademyNote) => {
    const content = items.find((entry) => entry.id === note.contentId)
    if (note.anchor) return `Seção: ${content?.sections?.find((s) => s.anchor === note.anchor)?.heading ?? note.anchor}`
    if (note.seconds !== null) return `Em ${formatClock(note.seconds)}`
    return 'Conteúdo inteiro'
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="notes-panel">
      <Heading id={headingId}>{contentId ? 'Suas notas neste conteúdo' : 'Suas notas'}</Heading>
      <p className={styles.status} role="status">{message}</p>
      {item ? (
        <NoteEditor key={compose?.nonce ?? 0} mode="create" item={item} userId={userId} now={now} textareaRef={textareaRef} initialAnchor={compose?.anchor ?? null}
          newId={() => `nota-local-${counter.current++}`}
          onSaved={(note) => { setNotes((list) => [...list, note]); setMessage('Nota salva nesta visualização. Demonstração: nada é enviado ao servidor.') }} />
      ) : null}
      {visible.length === 0 ? <AcademyEmptyState kind="notes" headingLevel={headingLevel === 2 ? 3 : 4} /> : (
        <ul className={styles.noteList}>
          {visible.map((note) => {
            const href = readHref(note.contentId, note.anchor ?? undefined)
            return (
              <li key={note.id} id={`nota-${note.id}`} className={styles.note} data-sample={note.sample ? 'true' : 'false'}>
                <div className={styles.noteHead}>
                  {note.sample ? <StatusPill tone="warning">Exemplo</StatusPill> : <StatusPill tone="neutral">Privada</StatusPill>}
                  <span>{`Atualizada em ${formatDateBR(note.updatedAt)}`}</span>
                </div>
                <p className={styles.noteTarget}>
                  {href ? <Link href={href}>{contentId ? targetOf(note) : `${titleOf(note.contentId)} · ${targetOf(note)}`}</Link> : targetOf(note)}
                </p>
                {editingId === note.id ? (
                  <NoteEditor mode="edit" note={note} item={items.find((entry) => entry.id === note.contentId) ?? null} userId={userId} now={now}
                    onCancel={() => setEditingId(null)}
                    onSaved={(saved) => { setNotes((list) => list.map((n) => (n.id === saved.id ? saved : n))); setEditingId(null); setMessage('Nota atualizada nesta visualização.') }} />
                ) : <p className={styles.noteText}>{note.text}</p>}
                {note.sample
                  ? <p className={styles.hint}>Nota de exemplo da demonstração — não foi escrita por você e não pode ser editada.</p>
                  : editingId !== note.id ? (
                    <div className={styles.actions}>
                      <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={() => setEditingId(note.id)} aria-label={`Editar nota em ${titleOf(note.contentId)}`}>Editar</button>
                      <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={() => { setNotes((list) => list.filter((n) => n.id !== note.id)); setMessage('Nota excluída. Progresso e favoritos não mudam.') }} aria-label={`Excluir nota em ${titleOf(note.contentId)}`}>Excluir</button>
                    </div>
                  ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
