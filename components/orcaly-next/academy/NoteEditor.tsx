'use client'

import { useId, useState, type FormEvent, type RefObject } from 'react'
import type { AcademyContentItem, AcademyNote } from '@/lib/orcaly-next/academy/types'
import { NOTE_MAX, createNote, updateNote } from '@/lib/orcaly-next/academy/notes'
import { foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

type Props = {
  userId: string
  now: string
  onSaved: (note: AcademyNote, created: boolean) => void
  onCancel?: () => void
  textareaRef?: RefObject<HTMLTextAreaElement | null>
} & ({ mode: 'create'; item: AcademyContentItem; newId: () => string; initialAnchor?: string | null } | { mode: 'edit'; note: AcademyNote; item: AcademyContentItem | null })

/**
 * Private note editor. Plain text only (rendered as text, never HTML), bounded length,
 * CAS on edit. The note text never goes into a URL.
 */
export default function NoteEditor(props: Props) {
  const id = useId()
  const editing = props.mode === 'edit' ? props.note : null
  const [text, setText] = useState(editing ? editing.text : '')
  const [anchor, setAnchor] = useState<string>(props.mode === 'create' ? (props.initialAnchor ?? '') : '')
  const [error, setError] = useState<string | null>(null)
  // CAS: remember the version this edit started from.
  const [baseVersion] = useState(editing ? editing.version : 0)
  const sections = props.item?.sections ?? []
  const length = [...text].length

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = props.mode === 'create'
      ? createNote(props.item, { id: props.newId(), userId: props.userId, text, anchor: anchor || null, at: props.now })
      : updateNote(props.note, { userId: props.userId, text, expectedVersion: baseVersion, at: props.now })
    if (!result.ok) { setError(result.message); props.textareaRef?.current?.focus(); return }
    setError(null)
    if (props.mode === 'create') { setText(''); setAnchor('') }
    props.onSaved(result.note, props.mode === 'create')
  }

  return (
    <form className={styles.editor} onSubmit={submit} noValidate aria-label={editing ? 'Editar nota' : 'Nova nota'}>
      {props.mode === 'create' && sections.length ? (
        <div className={styles.field}>
          <label htmlFor={`${id}-anchor`}>Onde</label>
          <select id={`${id}-anchor`} className={styles.select} value={anchor} onChange={(event) => setAnchor(event.target.value)}>
            <option value="">Conteúdo inteiro</option>
            {sections.map((section) => <option key={section.anchor} value={section.anchor}>{section.heading}</option>)}
          </select>
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor={`${id}-text`}>{editing ? 'Editar sua nota' : 'Sua nota'}</label>
        <textarea id={`${id}-text`} ref={props.textareaRef} className={styles.textarea} value={text} onChange={(event) => setText(event.target.value)}
          aria-invalid={error ? 'true' : undefined} aria-describedby={`${id}-hint ${id}-count${error ? ` ${id}-error` : ''}`} />
        <span className={styles.hint} id={`${id}-hint`}>Privada: só você vê. Texto simples; marcações HTML aparecem como texto.</span>
        <span className={styles.counter} id={`${id}-count`} data-over={length > NOTE_MAX ? 'true' : 'false'}>{`${length} de ${NOTE_MAX} caracteres`}</span>
        {error ? <span className={styles.error} id={`${id}-error`} role="alert">{`Não foi possível salvar: ${error}.`}</span> : null}
      </div>
      <div className={styles.actions}>
        <button type="submit" className={`${f.button} ${f.buttonPrimary}`}>{editing ? 'Salvar alterações' : 'Salvar nota'}</button>
        {props.onCancel ? <button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={props.onCancel}>Cancelar</button> : null}
      </div>
    </form>
  )
}
