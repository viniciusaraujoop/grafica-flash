import type { ReactNode } from 'react'

export type CompanyRef = {
  id: string
  nome?: string | null
}

export function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function numberFromInput(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value || '').replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function integerFromInput(value: string | number | null | undefined) {
  const parsed = Math.floor(numberFromInput(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export function displayTime(value?: string | null) {
  if (!value) return 'Não definido'
  return String(value).slice(0, 5)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function todayStartIso() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function mergeClass(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export const buttonPrimary = 'rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
export const buttonSecondary = 'rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
export const buttonDanger = 'rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
export const inputClass = 'rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold text-[#071b3a] outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'
export const labelClass = 'grid gap-2 text-sm font-black text-[#071b3a]'
export const cardClass = 'rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5'
export const panelClass = 'rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5'

export function StatusBadge({ active, trueLabel = 'Ativo', falseLabel = 'Inativo' }: { active: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <span className={mergeClass('rounded-full px-3 py-1 text-xs font-black', active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
      {active ? trueLabel : falseLabel}
    </span>
  )
}

export function AlertMessage({ type, children }: { type: 'success' | 'error'; children: ReactNode }) {
  return (
    <div className={mergeClass('rounded-2xl p-4 font-bold', type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
      {children}
    </div>
  )
}

export function LoadingState({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-[2rem] border border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
      <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl font-bold leading-7 text-slate-500">{description}</p>
    </section>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
      <h2 className="text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">{description}</p>
    </div>
  )
}
