import Link from 'next/link'
import type { ReactNode } from 'react'

type Metric = {
  label: string
  value: string | number
  description: string
}

type Action = {
  label: string
  href: string
  primary?: boolean
}

type PanelModuleShellProps = {
  eyebrow: string
  title: string
  description: string
  status?: string
  metrics?: Metric[]
  actions?: Action[]
  children?: ReactNode
}

export default function PanelModuleShell({
  eyebrow,
  title,
  description,
  status,
  metrics = [],
  actions = [],
  children,
}: PanelModuleShellProps) {
  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">{eyebrow}</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">{description}</p>
              {status ? (
                <span className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-[#05245c]">
                  {status}
                </span>
              ) : null}
            </div>

            {actions.length ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={action.primary
                      ? 'rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white'
                      : 'rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]'}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {metrics.length ? (
          <section className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <article key={metric.label} className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black text-slate-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{metric.value}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{metric.description}</p>
              </article>
            ))}
          </section>
        ) : null}

        {children}
      </section>
    </main>
  )
}

export function PanelEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-2xl">○</div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl font-bold leading-7 text-slate-500">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
