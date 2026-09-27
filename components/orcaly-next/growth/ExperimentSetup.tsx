'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { BASE_METRICS, DERIVED_METRICS } from '@/lib/orcaly-next/growth/types'
import { METRIC_CATALOGUE } from '@/lib/orcaly-next/growth/metrics'
import { EMPTY_SETUP, READINESS_CHECKS, evaluateSetup, type SetupForm } from '@/lib/orcaly-next/growth/setup'
import type { GrowthExperiment } from '@/lib/orcaly-next/growth/types'
import { foundationStyles as f } from '../foundation/primitives'
import GrowthEmptyState from './GrowthEmptyState'
import styles from './growth.module.css'

const FIELD_ORDER: ReadonlyArray<keyof SetupForm> = ['title', 'statement', 'primaryMetric', 'thresholdPercent', 'minSamplePerArm', 'minimumDurationDays', 'windowStart', 'windowEnd', 'controlLabel', 'variantLabel', 'source', 'assumptions', 'risks']

/**
 * Experiment setup form. Validates live against the real domain rules (readinessIssues).
 * Persistence is not configured: without `onSave`, submitting shows an honest NOT_CONFIGURED state.
 */
export default function ExperimentSetup({ onSave, companyId = 'demo-company', initial = EMPTY_SETUP, now }: {
  onSave?: (draft: GrowthExperiment) => void
  companyId?: string
  initial?: SetupForm
  now: string
}) {
  const id = useId()
  const [form, setForm] = useState<SetupForm>(initial)
  const [touched, setTouched] = useState<Partial<Record<keyof SetupForm, boolean>>>({})
  const [submitted, setSubmitted] = useState<'idle' | 'invalid' | 'persistence-off' | 'saved'>('idle')
  const formRef = useRef<HTMLFormElement>(null)
  const evaluation = useMemo(() => evaluateSetup(form, { id: 'rascunho', companyId, now }), [form, companyId, now])
  const codes = new Set(evaluation.issues.map((issue) => issue.code))
  const show = (field: keyof SetupForm) => (touched[field] || submitted === 'invalid') ? evaluation.fieldErrors[field] : undefined

  function update(field: keyof SetupForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    if (submitted !== 'idle') setSubmitted('idle')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (evaluation.issues.length || Object.keys(evaluation.fieldErrors).length) {
      setSubmitted('invalid')
      const first = FIELD_ORDER.find((field) => evaluation.fieldErrors[field])
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    if (onSave) { onSave(evaluation.draft); setSubmitted('saved') } else setSubmitted('persistence-off')
  }

  const field = (name: keyof SetupForm, label: string, options: { hint?: string; type?: string; inputMode?: 'numeric' | 'decimal'; textarea?: boolean; required?: boolean } = {}) => {
    const error = show(name)
    const hintId = `${id}-${name}-hint`
    const errorId = `${id}-${name}-error`
    const describedBy = [options.hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
    const common = {
      id: `${id}-${name}`, name, value: form[name], 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required: options.required,
      onChange: (event: { target: { value: string } }) => update(name, event.target.value),
      onBlur: () => setTouched((current) => ({ ...current, [name]: true })),
    }
    return (
      <div className={styles.field}>
        <label htmlFor={`${id}-${name}`}>{label}{options.required ? <span aria-hidden="true"> *</span> : null}</label>
        {options.hint ? <span className={styles.hint} id={hintId}>{options.hint}</span> : null}
        {options.textarea ? <textarea className={styles.textarea} {...common} /> : <input className={styles.input} type={options.type ?? 'text'} inputMode={options.inputMode} autoComplete="off" {...common} />}
        {error ? <span className={styles.error} id={errorId}>{error}</span> : null}
      </div>
    )
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-describedby={`${id}-readiness`}>
      <fieldset className={styles.fieldset}>
        <legend>1 · Hipótese</legend>
        {field('title', 'Nome do experimento', { required: true })}
        {field('statement', 'Hipótese', { textarea: true, required: true, hint: 'O que você acredita que vai acontecer e por quê. Ex.: "Mostrar o prazo de resposta aumenta a conversão."' })}
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${id}-primaryMetric`}>Métrica primária <span aria-hidden="true">*</span></label>
            <select className={styles.select} id={`${id}-primaryMetric`} name="primaryMetric" value={form.primaryMetric} onChange={(event) => update('primaryMetric', event.target.value)} aria-invalid={show('primaryMetric') ? true : undefined}>
              {[...DERIVED_METRICS, ...BASE_METRICS].map((key) => <option key={key} value={key}>{METRIC_CATALOGUE[key].label}</option>)}
            </select>
          </div>
          <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className={styles.label} style={{ fontSize: 'var(--ox-text-sm)', fontWeight: 700, padding: 0 }}>Direção esperada</legend>
            <div className={styles.radios}>
              {(['increase', 'decrease'] as const).map((value) => (
                <label key={value} className={styles.radio}><input type="radio" name="direction" value={value} checked={form.direction === value} onChange={() => update('direction', value)} />{value === 'increase' ? 'Aumentar' : 'Reduzir'}</label>
              ))}
            </div>
          </fieldset>
        </div>
        {field('source', 'Origem da hipótese', { required: true, hint: 'Quem ou o que a originou (ex.: conversa com clientes, aprendizado anterior).' })}
        {field('assumptions', 'Premissas (uma por linha)', { textarea: true })}
        {field('risks', 'Riscos (um por linha)', { textarea: true })}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>2 · Critério de sucesso</legend>
        <p className={styles.hint}>Declarado antes de começar. O resultado só será comparado com este critério — sem teste estatístico nesta versão.</p>
        <div className={styles.row}>
          {field('thresholdPercent', `Variação mínima (%) — ${form.direction === 'decrease' ? 'redução' : 'aumento'}`, { inputMode: 'decimal', required: true, hint: 'Ex.: 10 significa 10% vs controle.' })}
          {field('minSamplePerArm', 'Amostra mínima por braço', { inputMode: 'numeric', required: true, hint: 'Contada no denominador da métrica (ex.: cliques para taxa de conversão).' })}
        </div>
        {field('minimumDurationDays', 'Duração mínima (dias)', { inputMode: 'numeric', required: true })}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>3 · Janela e braços</legend>
        <div className={styles.row}>
          {field('windowStart', 'Início da janela', { type: 'date', required: true })}
          {field('windowEnd', 'Fim da janela', { type: 'date', required: true })}
        </div>
        <div className={styles.row}>
          {field('controlLabel', 'Controle', { required: true })}
          {field('variantLabel', 'Variante', { required: true })}
        </div>
      </fieldset>

      <section className={styles.panel} id={`${id}-readiness`} aria-labelledby={`${id}-readiness-h`}>
        <h2 id={`${id}-readiness-h`} style={{ fontSize: 'var(--ox-text-md)' }}>Pronto para iniciar?</h2>
        <ul className={styles.checklist}>
          {READINESS_CHECKS.map((check) => {
            const missing = check.codes.some((code) => codes.has(code))
            return <li key={check.label} className={missing ? styles.missing : styles.ok}><span>{check.label}: <strong>{missing ? 'falta' : 'ok'}</strong></span></li>
          })}
        </ul>
      </section>

      <div className={styles.actions}>
        <button type="submit" className={`${f.button} ${f.buttonPrimary}`}>Validar e salvar rascunho</button>
        <button type="button" className={f.button} onClick={() => { setForm(initial); setTouched({}); setSubmitted('idle') }}>Limpar</button>
      </div>
      <div role="status" aria-live="polite">
        {submitted === 'invalid' ? <p className={styles.error}>Revise os campos indicados antes de salvar.</p> : null}
        {submitted === 'saved' ? <p>Rascunho salvo.</p> : null}
      </div>
      {submitted === 'persistence-off' ? <GrowthEmptyState kind="persistence-off" headingLevel={2} /> : null}
    </form>
  )
}
