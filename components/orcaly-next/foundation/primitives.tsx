import type { CSSProperties, ReactNode } from 'react'
import type { SkinKey } from '@/lib/orcaly-next/product-registry'
import type { Tone } from '@/lib/orcaly-next/product-status'
import { skinStyle } from '@/lib/orcaly-next/skins'
import styles from './foundation.module.css'

/**
 * Orçaly UX Foundation primitives (prototype, isolated).
 * Server-safe: no hooks, no browser APIs. Not imported by any existing route.
 */

export const foundationStyles = styles

export function FoundationRoot({ skin, theme, children, className, as: Tag = 'div' }: {
  skin?: SkinKey
  /** Omit to follow the OS preference. */
  theme?: 'light' | 'dark'
  children: ReactNode
  className?: string
  as?: 'div' | 'main' | 'section'
}) {
  return (
    <Tag className={[styles.root, className].filter(Boolean).join(' ')} data-skin={skin} data-theme={theme} style={skin ? (skinStyle(skin) as CSSProperties) : undefined}>
      {children}
    </Tag>
  )
}

const toneClass: Record<Tone, string> = {
  neutral: styles['tone-neutral'], info: styles['tone-info'], success: styles['tone-success'],
  warning: styles['tone-warning'], danger: styles['tone-danger'], accent: styles['tone-accent'],
}

/** Text is mandatory: color is never the only signal. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${styles.pill} ${toneClass[tone]}`}>{children}</span>
}

export type StateKind = 'empty' | 'error' | 'forbidden' | 'not-configured' | 'blocked-external' | 'loading'

const stateDefaults: Record<StateKind, { title: string; role?: 'status' | 'alert' }> = {
  empty: { title: 'Nada por aqui ainda' },
  error: { title: 'Não foi possível carregar', role: 'alert' },
  forbidden: { title: 'Você não tem acesso a esta área' },
  'not-configured': { title: 'Recurso ainda não configurado' },
  'blocked-external': { title: 'Aguardando serviço externo' },
  loading: { title: 'Carregando…', role: 'status' },
}

/**
 * One component for every non-happy state, so "no data", "no permission" and
 * "provider missing" are never rendered the same way (audit A4 / consolidation C2).
 */
export function StateBlock({ kind, title, children, action, headingLevel = 3 }: {
  kind: StateKind
  title?: string
  children?: ReactNode
  action?: ReactNode
  headingLevel?: 2 | 3 | 4
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const defaults = stateDefaults[kind]
  return (
    <div className={`${styles.state} ${kind === 'error' ? styles.stateError : ''}`} role={defaults.role} data-state={kind}>
      <Heading>{title ?? defaults.title}</Heading>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <p className={styles.demoBanner} role="note" data-demo="true">
      <strong>Demonstração</strong>
      <span>{children}</span>
    </p>
  )
}
