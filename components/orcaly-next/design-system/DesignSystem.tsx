import type { CSSProperties, ReactNode } from 'react'
import type { SkinKey } from '@/lib/orcaly-next/product-registry'
import { skinStyle } from '@/lib/orcaly-next/skins'
import styles from './design-system.module.css'

export type Theme = 'light' | 'dark'

export function DesignSystemRoot({ children, skin, theme, className }: {
  children: ReactNode
  skin?: SkinKey
  theme?: Theme
  className?: string
}) {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-theme={theme}
      data-product={skin ?? 'hub'}
      style={skin ? (skinStyle(skin) as CSSProperties) : undefined}
    >
      {children}
    </div>
  )
}

export function DemoNotice({ children = 'DEMO / SAMPLE DATA — conteúdo ilustrativo, não representa dados reais.' }: { children?: ReactNode }) {
  return <p className={styles.demoNotice} role="note" data-demo="true"><strong>Demonstração</strong><span>{children}</span></p>
}

export function Button({ children, variant = 'secondary', disabled = false, type = 'button' }: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return <button className={[styles.button, styles[`button_${variant}`]].join(' ')} type={type} disabled={disabled}>{children}</button>
}

export function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return <button className={styles.iconButton} type="button" aria-label={label}>{children}</button>
}

export function Status({ tone = 'neutral', children }: {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'
  children: ReactNode
}) {
  return <span className={[styles.status, styles[`status_${tone}`]].join(' ')}><span aria-hidden="true" />{children}</span>
}

export function Field({ id, label, helper, error, required, readOnly, disabled, defaultValue, type = 'text' }: {
  id: string
  label: string
  helper?: string
  error?: string
  required?: boolean
  readOnly?: boolean
  disabled?: boolean
  defaultValue?: string
  type?: 'text' | 'email' | 'number'
}) {
  const describedBy = [helper ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : <span className={styles.optional}> opcional</span>}</label>
      <input id={id} type={type} defaultValue={defaultValue} required={required} readOnly={readOnly} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
      {helper ? <small id={`${id}-help`}>{helper}</small> : null}
      {error ? <p id={`${id}-error`} className={styles.formError} role="alert">{error}</p> : null}
    </div>
  )
}

export function TextareaField({ id, label, helper, defaultValue }: { id: string; label: string; helper?: string; defaultValue?: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} defaultValue={defaultValue} aria-describedby={helper ? `${id}-help` : undefined} />
      {helper ? <small id={`${id}-help`}>{helper}</small> : null}
    </div>
  )
}

export function PageHeader({ title, description, eyebrow, actions, meta }: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeading}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
        {meta ? <div className={styles.pageMeta}>{meta}</div> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  )
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className={styles.sectionHeader}>
      <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      {action ? <div>{action}</div> : null}
    </header>
  )
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <dl className={styles.metric}><dt>{label}</dt><dd>{value}</dd>{detail ? <dd className={styles.metricDetail}>{detail}</dd> : null}</dl>
}

export function StateView({ kind, title, description, action }: {
  kind: 'empty' | 'error' | 'loading' | 'offline' | 'unavailable' | 'no_permission' | 'no_entitlement'
  title: string
  description: string
  action?: ReactNode
}) {
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined
  return (
    <section className={styles.stateView} data-state={kind} role={role}>
      <p className={styles.stateKicker}>{kind.replace('_', ' ')}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </section>
  )
}

export type TableColumn = { key: string; label: string; align?: 'start' | 'end' }
export function DataTable({ caption, columns, rows }: {
  caption: string
  columns: readonly TableColumn[]
  rows: readonly Record<string, ReactNode>[]
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" data-align={column.align ?? 'start'}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)}>
              {columns.map((column) => <td key={column.key} data-label={column.label} data-align={column.align ?? 'start'}>{row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export type ChartPoint = { label: string; value: number; display: string }
export function ChartFrame({ title, description, points }: { title: string; description: string; points: readonly ChartPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.value))
  return (
    <figure className={styles.chartFrame}>
      <figcaption><strong>{title}</strong><span>{description}</span></figcaption>
      <div className={styles.chartPlot} aria-hidden="true">
        {points.map((point) => <div key={point.label} className={styles.chartColumn}><span style={{ height: `${Math.max(8, Math.round((point.value / max) * 100))}%` }} /><small>{point.label}</small></div>)}
      </div>
      <table className={styles.chartTable}>
        <caption className={styles.srOnly}>{title}: valores exatos</caption>
        <thead><tr><th scope="col">Série</th><th scope="col">Valor</th></tr></thead>
        <tbody>{points.map((point) => <tr key={point.label}><th scope="row">{point.label}</th><td>{point.display}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

export function Tabs({ items, active }: { items: readonly string[]; active: string }) {
  return <nav className={styles.tabs} aria-label="Seções">{items.map((item) => <a key={item} href="#conteudo" aria-current={item === active ? 'page' : undefined}>{item}</a>)}</nav>
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className={styles.skeleton} role="status" aria-label="Carregando conteúdo">{Array.from({ length: lines }, (_, index) => <span key={index} />)}</div>
}

export const designSystemStyles = styles
