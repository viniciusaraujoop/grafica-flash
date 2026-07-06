'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import {
  AlertMessage,
  LoadingState,
  StatusBadge,
  buttonPrimary,
  cardClass,
  displayTime,
  inputClass,
  labelClass,
  mergeClass,
  panelClass,
} from '@/components/food/food-shared'

type BusinessHour = {
  id: string
  company_id: string
  weekday: number
  is_open: boolean | null
  open_time: string | null
  close_time: string | null
  break_start: string | null
  break_end: string | null
  closed_message: string | null
  created_at?: string | null
  updated_at?: string | null
}

type BusinessHourDraft = {
  id?: string
  weekday: number
  is_open: boolean
  open_time: string
  close_time: string
  break_start: string
  break_end: string
  closed_message: string
}

const weekdayLabels = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

function defaultHour(weekday: number): BusinessHourDraft {
  const isSunday = weekday === 0

  return {
    id: undefined,
    weekday,
    is_open: !isSunday,
    open_time: isSunday ? '' : '08:00',
    close_time: isSunday ? '' : '18:00',
    break_start: '',
    break_end: '',
    closed_message: isSunday ? 'Fechado aos domingos.' : '',
  }
}

function draftFromHour(hour: BusinessHour): BusinessHourDraft {
  return {
    id: hour.id,
    weekday: hour.weekday,
    is_open: hour.is_open !== false,
    open_time: displayTime(hour.open_time) === 'Não definido' ? '' : displayTime(hour.open_time),
    close_time: displayTime(hour.close_time) === 'Não definido' ? '' : displayTime(hour.close_time),
    break_start: displayTime(hour.break_start) === 'Não definido' ? '' : displayTime(hour.break_start),
    break_end: displayTime(hour.break_end) === 'Não definido' ? '' : displayTime(hour.break_end),
    closed_message: hour.closed_message || '',
  }
}

function minutesFromTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function timeOrNull(value: string) {
  return value.trim() ? value : null
}

function normalizeRows(rows: BusinessHour[]): BusinessHourDraft[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const found = rows.find((row) => Number(row.weekday) === weekday)
    return found ? draftFromHour(found) : defaultHour(weekday)
  })
}

function getOpenState(hours: BusinessHourDraft[]) {
  const now = new Date()
  const weekday = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const today = hours.find((hour) => hour.weekday === weekday)

  if (today?.is_open && today.open_time && today.close_time) {
    const open = minutesFromTime(today.open_time)
    const close = minutesFromTime(today.close_time)
    const breakStart = today.break_start ? minutesFromTime(today.break_start) : null
    const breakEnd = today.break_end ? minutesFromTime(today.break_end) : null
    const insideBreak = breakStart !== null && breakEnd !== null && currentMinutes >= breakStart && currentMinutes < breakEnd

    if (open !== null && close !== null && currentMinutes >= open && currentMinutes < close && !insideBreak) {
      return { openNow: true, text: `Aberto agora até ${today.close_time}` }
    }
  }

  for (let offset = 0; offset < 8; offset += 1) {
    const targetWeekday = (weekday + offset) % 7
    const target = hours.find((hour) => hour.weekday === targetWeekday)
    if (!target?.is_open || !target.open_time) continue

    const targetOpen = minutesFromTime(target.open_time)
    if (offset === 0 && targetOpen !== null && targetOpen <= currentMinutes) continue

    const dayLabel = offset === 0 ? 'hoje' : offset === 1 ? 'amanhã' : weekdayLabels[targetWeekday].toLowerCase()
    return { openNow: false, text: `Próxima abertura: ${dayLabel} às ${target.open_time}` }
  }

  return { openNow: false, text: 'Nenhuma abertura configurada.' }
}

export default function BusinessHoursManager() {
  const [companyId, setCompanyId] = useState('')
  const [drafts, setDrafts] = useState<BusinessHourDraft[]>(Array.from({ length: 7 }, (_, weekday) => defaultHour(weekday)))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function ensureDefaultRows(currentCompanyId: string, existingRows: BusinessHour[] = []) {
    const existingWeekdays = new Set(existingRows.map((row) => Number(row.weekday)))
    const payload = Array.from({ length: 7 }, (_, weekday) => {
      const defaultRow = defaultHour(weekday)
      return {
        company_id: currentCompanyId,
        weekday,
        is_open: defaultRow.is_open,
        open_time: timeOrNull(defaultRow.open_time),
        close_time: timeOrNull(defaultRow.close_time),
        break_start: null,
        break_end: null,
        closed_message: defaultRow.closed_message || null,
        updated_at: new Date().toISOString(),
      }
    }).filter((row) => !existingWeekdays.has(row.weekday))

    if (payload.length === 0) return

    const { error: insertError } = await supabase
      .from('business_hours')
      .insert(payload)

    if (insertError) throw insertError
  }

  async function loadHours() {
    setLoading(true)
    setError('')

    try {
      const currentCompanyId = companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      const hoursResult = await supabase
        .from('business_hours')
        .select('id, company_id, weekday, is_open, open_time, close_time, break_start, break_end, closed_message, created_at, updated_at')
        .eq('company_id', currentCompanyId)
        .order('weekday', { ascending: true })

      if (hoursResult.error) throw hoursResult.error

      let data = hoursResult.data

      if (!data || data.length < 7) {
        await ensureDefaultRows(currentCompanyId, (data || []) as BusinessHour[])
        const retry = await supabase
          .from('business_hours')
          .select('id, company_id, weekday, is_open, open_time, close_time, break_start, break_end, closed_message, created_at, updated_at')
          .eq('company_id', currentCompanyId)
          .order('weekday', { ascending: true })

        if (retry.error) throw retry.error
        data = retry.data
      }

      setDrafts(normalizeRows((data || []) as BusinessHour[]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar horários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadHours()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateDraft(weekday: number, field: keyof BusinessHourDraft, value: string | boolean) {
    setDrafts((current) => current.map((draft) => draft.weekday === weekday ? { ...draft, [field]: value } : draft))
  }

  function validateDrafts() {
    for (const draft of drafts) {
      if (!draft.is_open) continue
      if (!draft.open_time || !draft.close_time) return `Informe abertura e fechamento de ${weekdayLabels[draft.weekday]}.`

      const open = minutesFromTime(draft.open_time)
      const close = minutesFromTime(draft.close_time)
      if (open === null || close === null) return `Horário inválido em ${weekdayLabels[draft.weekday]}.`
      if (close <= open) return `O fechamento precisa ser depois da abertura em ${weekdayLabels[draft.weekday]}.`

      if ((draft.break_start && !draft.break_end) || (!draft.break_start && draft.break_end)) return `Informe início e fim da pausa em ${weekdayLabels[draft.weekday]}.`
      if (draft.break_start && draft.break_end) {
        const breakStart = minutesFromTime(draft.break_start)
        const breakEnd = minutesFromTime(draft.break_end)
        if (breakStart === null || breakEnd === null) return `Pausa inválida em ${weekdayLabels[draft.weekday]}.`
        if (breakEnd <= breakStart) return `O fim da pausa precisa ser depois do início em ${weekdayLabels[draft.weekday]}.`
        if (breakStart < open || breakEnd > close) return `A pausa precisa estar dentro do horário de funcionamento em ${weekdayLabels[draft.weekday]}.`
      }
    }

    return ''
  }

  async function saveHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const validation = validateDrafts()
      if (validation) throw new Error(validation)

      const currentCompanyId = companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      for (const draft of drafts) {
        const payload = {
          company_id: currentCompanyId,
          weekday: draft.weekday,
          is_open: draft.is_open,
          open_time: draft.is_open ? timeOrNull(draft.open_time) : null,
          close_time: draft.is_open ? timeOrNull(draft.close_time) : null,
          break_start: draft.is_open ? timeOrNull(draft.break_start) : null,
          break_end: draft.is_open ? timeOrNull(draft.break_end) : null,
          closed_message: draft.closed_message.trim() || null,
          updated_at: new Date().toISOString(),
        }

        if (draft.id) {
          const { error: updateError } = await supabase
            .from('business_hours')
            .update(payload)
            .eq('id', draft.id)
            .eq('company_id', currentCompanyId)

          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase
            .from('business_hours')
            .insert(payload)

          if (insertError) throw insertError
        }
      }

      setMessage('Horários salvos com sucesso.')
      await loadHours()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar horários.')
    } finally {
      setSaving(false)
    }
  }

  const openState = useMemo(() => getOpenState(drafts), [drafts])
  const activeDays = drafts.filter((draft) => draft.is_open).length
  const breaksCount = drafts.filter((draft) => draft.break_start && draft.break_end).length

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação Food</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Horários</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Configure os 7 dias da semana, pausas e mensagem de fechamento. Ao abrir a tela, registros padrão são criados se ainda não existirem.</p>
            </div>
            <button type="button" onClick={loadHours} className={buttonPrimary}>Atualizar</button>
          </div>
        </header>

        {message ? <AlertMessage type="success">{message}</AlertMessage> : null}
        {error ? <AlertMessage type="error">{error}</AlertMessage> : null}

        {loading ? (
          <LoadingState title="Carregando horários..." description="Conferindo funcionamento da empresa no Supabase." />
        ) : (
          <form onSubmit={saveHours} className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Status agora</p><p className="mt-3 text-2xl font-black">{openState.openNow ? 'Aberto' : 'Fechado'}</p><p className="mt-2 text-sm font-bold text-slate-500">{openState.text}</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Dias abertos</p><p className="mt-3 text-3xl font-black">{activeDays}</p><p className="mt-2 text-sm font-bold text-slate-500">Dias com atendimento ativo.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Pausas</p><p className="mt-3 text-3xl font-black">{breaksCount}</p><p className="mt-2 text-sm font-bold text-slate-500">Intervalos configurados.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Próxima abertura</p><p className="mt-3 text-xl font-black leading-7">{openState.openNow ? 'Aberto agora' : openState.text.replace('Próxima abertura: ', '')}</p><p className="mt-2 text-sm font-bold text-slate-500">Cálculo local no navegador.</p></article>
            </section>

            <section className={panelClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.04em]">Funcionamento semanal</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Edite todos os dias e salve em lote. Sim, uma tela que salva de verdade, tecnologia rara neste teatro.</p>
                </div>
                <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Salvando...' : 'Salvar horários'}</button>
              </div>

              <div className="mt-6 grid gap-4">
                {drafts.map((draft) => (
                  <article key={draft.weekday} className="rounded-[1.6rem] border border-blue-100 bg-[#f8fbff] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-[180px] items-start justify-between gap-3 xl:block">
                        <div>
                          <h3 className="text-xl font-black tracking-[-0.03em]">{weekdayLabels[draft.weekday]}</h3>
                          <p className="mt-2 text-sm font-bold text-slate-500">{draft.is_open ? `${draft.open_time || '--:--'} até ${draft.close_time || '--:--'}` : draft.closed_message || 'Fechado'}</p>
                        </div>
                        <StatusBadge active={draft.is_open} trueLabel="Aberto" falseLabel="Fechado" />
                      </div>

                      <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 font-black xl:col-span-1"><input type="checkbox" checked={draft.is_open} onChange={(event) => updateDraft(draft.weekday, 'is_open', event.target.checked)} />Aberto</label>
                        <label className={labelClass}>Abre às<input type="time" value={draft.open_time} disabled={!draft.is_open} onChange={(event) => updateDraft(draft.weekday, 'open_time', event.target.value)} className={inputClass} /></label>
                        <label className={labelClass}>Fecha às<input type="time" value={draft.close_time} disabled={!draft.is_open} onChange={(event) => updateDraft(draft.weekday, 'close_time', event.target.value)} className={inputClass} /></label>
                        <label className={labelClass}>Pausa início<input type="time" value={draft.break_start} disabled={!draft.is_open} onChange={(event) => updateDraft(draft.weekday, 'break_start', event.target.value)} className={inputClass} /></label>
                        <label className={labelClass}>Pausa fim<input type="time" value={draft.break_end} disabled={!draft.is_open} onChange={(event) => updateDraft(draft.weekday, 'break_end', event.target.value)} className={inputClass} /></label>
                        <label className={mergeClass(labelClass, 'md:col-span-2 xl:col-span-6')}>Mensagem quando fechado<input value={draft.closed_message} onChange={(event) => updateDraft(draft.weekday, 'closed_message', event.target.value)} className={inputClass} placeholder="Ex: Hoje não estamos recebendo pedidos." /></label>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </form>
        )}
      </section>
    </main>
  )
}
