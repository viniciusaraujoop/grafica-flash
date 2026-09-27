'use client'

import { useId, type FormEvent } from 'react'
import { MAX_QUERY_LENGTH } from '@/lib/orcaly-next/academy/search'
import { foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

/**
 * Local search box. Deterministic, metadata-only (title, subtitle, author, category, tags);
 * no AI, no provider, never the full text of protected content. Result count is announced.
 */
export default function AcademySearch({ query, onQueryChange, resultCount }: { query: string; onQueryChange: (next: string) => void; resultCount: number | null }) {
  const id = useId()
  const submit = (event: FormEvent<HTMLFormElement>) => event.preventDefault()
  return (
    <form role="search" className={styles.search} onSubmit={submit} aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-q`} className={styles.fieldLabel}>Buscar na biblioteca</label>
      <div className={styles.searchRow}>
        <input id={`${id}-q`} type="search" className={styles.input} value={query} maxLength={MAX_QUERY_LENGTH} autoComplete="off" spellCheck={false}
          onChange={(event) => onQueryChange(event.target.value)} aria-describedby={`${id}-hint`} />
        {query ? <button type="button" className={f.button} onClick={() => onQueryChange('')}>Limpar busca</button> : null}
      </div>
      <span id={`${id}-hint`} className={styles.hint}>Procura em título, subtítulo, autoria, categoria e etiquetas. Maiúsculas e acentos não importam.</span>
      <p className={styles.resultLine} role="status" aria-live="polite">{resultCount === null ? '' : resultCount === 1 ? '1 resultado' : `${resultCount} resultados`}</p>
    </form>
  )
}
