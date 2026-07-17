'use client'

// ORCALY_PANEL_UI_PREMIUM

import Link from 'next/link'
import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from 'react'

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function PanelPageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="panel-ui-page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="panel-ui-eyebrow">{eyebrow}</p> : null}
        <h1 className="panel-ui-title">{title}</h1>
        {description ? <p className="panel-ui-description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="panel-ui-actions">{actions}</div> : null}
    </section>
  )
}

export function PanelSection({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('panel-ui-section', className)}>
      {title || description || actions ? (
        <header className="panel-ui-section-header">
          <div className="min-w-0">
            {title ? <h2 className="panel-ui-section-title">{title}</h2> : null}
            {description ? <p className="panel-ui-section-description">{description}</p> : null}
          </div>
          {actions ? <div className="panel-ui-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function PanelMetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'blue',
  className,
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
  className?: string
}) {
  return (
    <article className={cn('panel-ui-metric', `panel-ui-tone-${tone}`, className)}>
      <div className="panel-ui-metric-top">
        <p>{label}</p>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {helper ? <div className="panel-ui-metric-helper">{helper}</div> : null}
    </article>
  )
}

export function PanelActionCard({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <article className={cn('panel-ui-action-card', className)}>
      {icon ? <span className="panel-ui-action-icon" aria-hidden="true">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </article>
  )
}

export function PanelButton({
  className,
  variant = 'primary',
  loading = false,
  loadingText = 'Processando...',
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  loadingText?: string
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('panel-ui-button', `panel-ui-button-${variant}`, className)}
    >
      {loading ? <span className="panel-ui-spinner" aria-hidden="true" /> : null}
      <span>{loading ? loadingText : children}</span>
    </button>
  )
}

export function PanelIconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...props} aria-label={label} title={label} className={cn('panel-ui-icon-button', className)}>
      {children}
    </button>
  )
}

export function PanelFilters({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('panel-ui-filters', className)}>{children}</div>
}

export function PanelSearch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="panel-ui-search">
      <span className="sr-only">Buscar</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
      </svg>
      <input {...props} type={props.type || 'search'} className={cn(className)} />
    </label>
  )
}

export function PanelTable({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('panel-ui-table-wrap', className)}>{children}</div>
}

export function PanelMobileCard({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return <article {...props} className={cn('panel-ui-mobile-card', className)}>{children}</article>
}

export function PanelEmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="panel-ui-state" role="status">
      {icon ? <span className="panel-ui-state-icon" aria-hidden="true">{icon}</span> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function PanelErrorState({
  title = 'Nao foi possivel carregar',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="panel-ui-state panel-ui-state-error" role="alert">
      <span className="panel-ui-state-icon" aria-hidden="true">!</span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function PanelSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} aria-hidden="true" className={cn('panel-ui-skeleton', className)} />
}

export function MetricCardSkeleton() {
  return (
    <div className="panel-ui-metric">
      <PanelSkeleton className="h-3 w-24" />
      <PanelSkeleton className="mt-5 h-8 w-32" />
      <PanelSkeleton className="mt-4 h-3 w-40" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel-ui-table-skeleton">
      <PanelSkeleton className="h-11 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-4 border-t border-slate-100 py-4">
          <PanelSkeleton className="h-4 w-full" />
          <PanelSkeleton className="h-4 w-4/5" />
          <PanelSkeleton className="h-4 w-3/5 justify-self-end" />
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="panel-ui-form-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index}>
          <PanelSkeleton className="h-3 w-28" />
          <PanelSkeleton className="mt-2 h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export function PanelModal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="panel-ui-overlay" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="panel-ui-modal">
        <header>
          <div className="min-w-0">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <PanelIconButton label="Fechar" onClick={onClose}>x</PanelIconButton>
        </header>
        <div>{children}</div>
      </div>
    </div>
  )
}

export function PanelDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="panel-ui-overlay" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="panel-ui-drawer">
        <header>
          <h2>{title}</h2>
          <PanelIconButton label="Fechar" onClick={onClose}>x</PanelIconButton>
        </header>
        <div>{children}</div>
      </aside>
    </div>
  )
}

export function PanelTabs({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="tablist" className={cn('panel-ui-tabs', className)}>{children}</div>
}

export function PanelBadge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate'
  className?: string
}) {
  return <span className={cn('panel-ui-badge', `panel-ui-tone-${tone}`, className)}>{children}</span>
}

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const normalized = String(status || '').toLowerCase()
  const tone = normalized.match(/conclu|entreg|ativ|pago|aprov/) ? 'green'
    : normalized.match(/cancel|erro|venc|recus/) ? 'red'
      : normalized.match(/pend|aguard|analise/) ? 'amber'
        : normalized.match(/andamento|preparo|produc/) ? 'blue'
          : 'slate'

  return <PanelBadge tone={tone}>{label || status || 'Indefinido'}</PanelBadge>
}

export function PanelTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="panel-ui-tooltip" data-tooltip={label}>{children}</span>
}

export function PanelToast({
  tone = 'success',
  title,
  description,
}: {
  tone?: 'success' | 'error' | 'info'
  title: string
  description?: string
}) {
  return (
    <div className={cn('panel-ui-toast', `panel-ui-toast-${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

export function PanelBreadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="panel-ui-breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}