'use client'

import { useEffect, useState } from 'react'

const timezoneExamples = [
  'America/Maceio',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Rio_Branco',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Belem',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Boa_Vista',
  'America/Porto_Velho',
  'America/Noronha',
  'UTC',
]

type TimezonePayload = {
  timezone?: string | null
  configured?: boolean
  can_config?: boolean
  error?: string
}

async function getAccessToken() {
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function CompanyTimezoneSettings() {
  const [timezone, setTimezone] = useState('')
  const [savedTimezone, setSavedTimezone] = useState<string | null>(null)
  const [canConfig, setCanConfig] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('Você precisa estar logado.')

        const response = await fetch('/api/company/timezone', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const payload = await response.json() as TimezonePayload
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o fuso horário.')
        if (cancelled) return

        const current = payload.timezone || ''
        setTimezone(current)
        setSavedTimezone(payload.timezone || null)
        setCanConfig(Boolean(payload.can_config))
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o fuso horário.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  async function saveTimezone() {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Você precisa estar logado.')

      const response = await fetch('/api/company/timezone', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timezone: timezone.trim() || null }),
      })
      const payload = await response.json() as TimezonePayload
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o fuso horário.')

      const current = payload.timezone || null
      setTimezone(current || '')
      setSavedTimezone(current)
      setMessage(current ? 'Fuso horário salvo.' : 'Fuso horário removido. Operações agendadas continuarão bloqueadas até nova configuração.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o fuso horário.')
    } finally {
      setSaving(false)
    }
  }

  const changed = timezone.trim() !== (savedTimezone || '')

  return (
    <section className="mb-5 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Horário operacional</p>
          <h2 className="mt-2 text-2xl font-black text-[#071b3a]">Fuso horário da empresa</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            Esta é a fonte oficial para agenda, automações e integrações. O Orçaly mantém instantes absolutos em UTC e converte apenas nas bordas de exibição e dos provedores.
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-black ${savedTimezone ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
          {savedTimezone ? 'Configurado' : 'Configuração pendente'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-black text-slate-700">Fuso horário</span>
          <input
            list="orcaly-company-timezones"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            disabled={loading || !canConfig}
            placeholder="America/Maceio"
            autoComplete="off"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          />
          <datalist id="orcaly-company-timezones">
            {timezoneExamples.map((value) => <option key={value} value={value} />)}
          </datalist>
        </label>

        <button
          type="button"
          onClick={saveTimezone}
          disabled={loading || saving || !canConfig || !changed}
          className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar fuso horário'}
        </button>
      </div>

      <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
        Use um identificador IANA, por exemplo America/Maceio, America/Sao_Paulo, America/Manaus, America/Rio_Branco ou UTC. Offset fixo como -03:00 e nomes como “Brasília” não são aceitos.
      </p>

      {!savedTimezone && !loading && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
          O uso geral do Orçaly continua disponível. Ações cujo horário seria ambíguo, como sincronizar eventos com calendário, devem exigir esta configuração antes de executar.
        </div>
      )}
      {!canConfig && !loading && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Somente o dono da empresa ou um administrador autorizado pode alterar esta configuração.
        </div>
      )}
      {message && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    </section>
  )
}
