'use client'

import { useId } from 'react'
import type { AcademyCategory, Availability, ContentType, ProgressStatus } from '@/lib/orcaly-next/academy/types'
import { AVAILABILITIES, PROGRESS_STATUSES } from '@/lib/orcaly-next/academy/types'
import type { LibraryFilter } from '@/lib/orcaly-next/academy/library'
import { CONTENT_TYPE_LABEL, PROGRESS_LABEL } from '@/lib/orcaly-next/academy/library'
import { AVAILABILITY_COPY } from '@/lib/orcaly-next/academy/core'
import { foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

const TYPES: ContentType[] = ['ARTICLE', 'LESSON', 'VIDEO', 'AUDIO', 'DOCUMENT']
const LANGUAGE_LABEL: Record<string, string> = { 'pt-BR': 'Português (Brasil)', en: 'Inglês', es: 'Espanhol' }

/** Plain labeled selects (keyboard and screen-reader native). AND semantics. */
export default function LibraryFilters({ filter, onChange, onReset, categories, languages }: { filter: LibraryFilter; onChange: (next: LibraryFilter) => void; onReset: () => void; categories: readonly AcademyCategory[]; languages: readonly string[] }) {
  const id = useId()
  const set = <K extends keyof LibraryFilter>(key: K, value: LibraryFilter[K]) => onChange({ ...filter, [key]: value })
  return (
    <fieldset className={styles.filters}>
      <legend>Filtrar e ordenar</legend>
      <div className={styles.filterGrid}>
        <div className={styles.field}>
          <label htmlFor={`${id}-type`}>Tipo</label>
          <select id={`${id}-type`} className={styles.select} value={filter.type} onChange={(e) => set('type', e.target.value as ContentType | 'ALL')}>
            <option value="ALL">Todos</option>
            {TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-cat`}>Categoria</label>
          <select id={`${id}-cat`} className={styles.select} value={filter.category} onChange={(e) => set('category', e.target.value)}>
            <option value="ALL">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-status`}>Seu progresso</label>
          <select id={`${id}-status`} className={styles.select} value={filter.status} onChange={(e) => set('status', e.target.value as ProgressStatus | 'ALL')}>
            <option value="ALL">Qualquer</option>
            {PROGRESS_STATUSES.map((s) => <option key={s} value={s}>{PROGRESS_LABEL[s]}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-avail`}>Disponibilidade</label>
          <select id={`${id}-avail`} className={styles.select} value={filter.availability} onChange={(e) => set('availability', e.target.value as Availability | 'ALL')}>
            <option value="ALL">Qualquer</option>
            {AVAILABILITIES.map((a) => <option key={a} value={a}>{AVAILABILITY_COPY[a].label}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-lang`}>Idioma</label>
          <select id={`${id}-lang`} className={styles.select} value={filter.language} onChange={(e) => set('language', e.target.value)}>
            <option value="ALL">Todos</option>
            {languages.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l] ?? l}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-sort`}>Ordenar por</label>
          <select id={`${id}-sort`} className={styles.select} value={filter.sort} onChange={(e) => set('sort', e.target.value as LibraryFilter['sort'])}>
            <option value="title">Título (A–Z)</option>
            <option value="recent">Mais recentes</option>
            <option value="duration">Mais curtos</option>
          </select>
        </div>
      </div>
      <div className={styles.actions}><button type="button" className={`${f.button} ${f.buttonQuiet}`} onClick={onReset}>Limpar filtros</button></div>
    </fieldset>
  )
}
