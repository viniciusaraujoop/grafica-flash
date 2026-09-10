'use client'

import { useEffect, useState } from 'react'

type Calendar = { id: string; summary: string; timeZone: string | null; accessRole: string; primary: boolean; writable: boolean }
type CalendarPayload = {
  calendars?: Calendar[]
  scopes?: string[]
  config?: { default_calendar_id?: string | null; delete_policy?: string; watch_enabled?: boolean }
  error?: string
}

export default function GoogleCalendarSettings({ canManage }: { canManage: boolean }) {
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [scopes, setScopes] = useState<string[]>([])
  const [calendarId, setCalendarId] = useState('')
  const [deletePolicy, setDeletePolicy] = useState('unlink')
  const [watchEnabled, setWatchEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setNotice('')
    try {
      const response = await fetch('/api/integrations/google_calendar/calendars', { cache: 'no-store' })
      const payload = await response.json() as CalendarPayload
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os calendários.')
      setCalendars(Array.isArray(payload.calendars) ? payload.calendars : [])
      setScopes(Array.isArray(payload.scopes) ? payload.scopes : [])
      setCalendarId(payload.config?.default_calendar_id || '')
      setDeletePolicy(payload.config?.delete_policy === 'delete' || payload.config?.delete_policy === 'cancel' ? payload.config.delete_policy : 'unlink')
      setWatchEnabled(payload.config?.watch_enabled === true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao carregar Google Calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save() {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/integrations/google_calendar/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ default_calendar_id: calendarId, delete_policy: deletePolicy, watch_enabled: watchEnabled }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a configuração.')
      setNotice('Configuração do Calendar salva.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao salvar configuração.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleWatch(next: boolean) {
    setBusy(true)
    setNotice('')
    try {
      const response = await fetch('/api/integrations/google_calendar/watch', { method: next ? 'POST' : 'DELETE' })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível alterar notificações push.')
      setWatchEnabled(next)
      setNotice(next ? 'Notificações push ativadas.' : 'Notificações push desativadas.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao alterar notificações push.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">Carregando configuração do Calendar…</section>

  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Google Calendar</p><h3 className="mt-1 font-black text-slate-800">Agenda padrão e política externa</h3></div>
      <a href="/api/integrations/google_calendar/connect" className="text-xs font-black text-[#0b3b78] underline">Reautenticar</a>
    </div>
    <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
      Calendário padrão
      <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)} disabled={!canManage || busy} className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-300">
        <option value="">Selecione…</option>
        {calendars.map((calendar) => <option key={calendar.id} value={calendar.id} disabled={!calendar.writable}>{calendar.summary}{calendar.primary ? ' (principal)' : ''}{calendar.writable ? '' : ' — somente leitura'}</option>)}
      </select>
    </label>
    <label className="mt-3 grid gap-2 text-sm font-bold text-slate-700">
      Ao remover entidade no Orçaly
      <select value={deletePolicy} onChange={(event) => setDeletePolicy(event.target.value)} disabled={!canManage || busy} className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-300">
        <option value="unlink">Desvincular, sem apagar no Google</option>
        <option value="cancel">Marcar evento como cancelado</option>
        <option value="delete">Excluir evento externo</option>
      </select>
    </label>
    <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Scopes concedidos</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{scopes.map((scope) => <span key={scope} className="max-w-full break-all rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{scope}</span>)}</div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={save} disabled={!canManage || busy || !calendarId} className="min-h-11 rounded-xl bg-[#0b3b78] px-3 text-sm font-black text-white disabled:opacity-50">Salvar Calendar</button>
      <button type="button" onClick={() => toggleWatch(!watchEnabled)} disabled={!canManage || busy || !calendarId} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 disabled:opacity-50">{watchEnabled ? 'Desativar push' : 'Ativar push'}</button>
    </div>
    <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Push só é ativado quando o servidor possui URL pública HTTPS válida. O token do canal é armazenado apenas como hash.</p>
    {notice ? <div role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#0b3b78]">{notice}</div> : null}
  </section>
}
