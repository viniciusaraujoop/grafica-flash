'use client'

import type { ReadingPrefs, ReadingTheme, ReadingWidth } from '@/lib/orcaly-next/academy/reading'
import { READING_BOUNDS, READING_THEMES, READING_THEME_LABEL, READING_WIDTHS, READING_WIDTH_LABEL, clampReadingPrefs, formatLeading } from '@/lib/orcaly-next/academy/reading'
import { foundationStyles as f } from '../foundation/primitives'
import styles from './academy.module.css'

/**
 * Reader typography: font 14–24px, line-height 1.4–2.0, width, theme. Bounded by
 * clampReadingPrefs. State only (no localStorage); controls sit inline and never cover text.
 */
export default function ReadingControls({ prefs, onChange, idPrefix }: { prefs: ReadingPrefs; onChange: (next: ReadingPrefs) => void; idPrefix: string }) {
  const set = (patch: Partial<ReadingPrefs>) => onChange(clampReadingPrefs({ ...prefs, ...patch }))
  const leadingOptions: number[] = []
  for (let t = READING_BOUNDS.leadingMin; t <= READING_BOUNDS.leadingMax; t += 1) leadingOptions.push(t)
  return (
    <details className={styles.controls} data-testid="reading-controls">
      <summary>Ajustes de leitura</summary>
      <div className={styles.controlsBody}>
        <div className={styles.field} role="group" aria-labelledby={`${idPrefix}-font`}>
          <span className={styles.fieldLabel} id={`${idPrefix}-font`}>Tamanho do texto</span>
          <div className={styles.stepper}>
            <button type="button" className={f.button} onClick={() => set({ fontPx: prefs.fontPx - READING_BOUNDS.fontStep })} disabled={prefs.fontPx <= READING_BOUNDS.fontMin} aria-label="Diminuir texto">A−</button>
            <output aria-live="polite" id={`${idPrefix}-font-value`}>{`${prefs.fontPx}px`}</output>
            <button type="button" className={f.button} onClick={() => set({ fontPx: prefs.fontPx + READING_BOUNDS.fontStep })} disabled={prefs.fontPx >= READING_BOUNDS.fontMax} aria-label="Aumentar texto">A+</button>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-leading`}>Entrelinha</label>
          <select id={`${idPrefix}-leading`} className={styles.select} value={prefs.leadingTenths} onChange={(event) => set({ leadingTenths: Number(event.target.value) })}>
            {leadingOptions.map((t) => <option key={t} value={t}>{formatLeading(t)}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-width`}>Largura da coluna</label>
          <select id={`${idPrefix}-width`} className={styles.select} value={prefs.width} onChange={(event) => set({ width: event.target.value as ReadingWidth })}>
            {READING_WIDTHS.map((w) => <option key={w} value={w}>{READING_WIDTH_LABEL[w]}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-theme`}>Tema da leitura</label>
          <select id={`${idPrefix}-theme`} className={styles.select} value={prefs.theme} onChange={(event) => set({ theme: event.target.value as ReadingTheme })}>
            {READING_THEMES.map((t) => <option key={t} value={t}>{READING_THEME_LABEL[t]}</option>)}
          </select>
        </div>
        <p className={styles.hint}>Os ajustes valem nesta visualização. Guardar preferências entre sessões depende da persistência futura.</p>
      </div>
    </details>
  )
}
