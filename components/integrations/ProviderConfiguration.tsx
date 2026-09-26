'use client'

import { useEffect, useState } from 'react'
import type { IntegrationProviderKey } from '@/lib/integrations/core/types'
import type { ProviderConfigurationField } from '@/lib/integrations/provider-configuration'

type ConfigurationResponse = {
  error?: string
  status?: string
  fields?: ProviderConfigurationField[]
  config?: Record<string, string>
  credentials?: Record<string, boolean>
}

export default function ProviderConfiguration(props: { provider: IntegrationProviderKey; canManage: boolean }) {
  return <ProviderConfigurationForm key={props.provider} {...props} />
}

function ProviderConfigurationForm({ provider, canManage }: { provider: IntegrationProviderKey; canManage: boolean }) {
  const [fields, setFields] = useState<ProviderConfigurationField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [storedCredentials, setStoredCredentials] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/integrations/${provider}/config`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as ConfigurationResponse
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a configuração.')
        return payload
      })
      .then((payload) => {
        if (!active) return
        const nextFields = Array.isArray(payload.fields) ? payload.fields : []
        setFields(nextFields)
        setValues(payload.config || {})
        setStoredCredentials(payload.credentials || {})
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : 'Não foi possível carregar a configuração.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [provider])

  async function save() {
    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/integrations/${provider}/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload = await response.json().catch(() => ({})) as ConfigurationResponse & { message?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a configuração.')
      setNotice(payload.message || 'Configuração salva.')
      setStoredCredentials((current) => ({ ...current, ...Object.fromEntries(fields.filter((field) => field.kind === 'secret').map((field) => [field.key, true])) }))
      setValues((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => fields.some((field) => field.key === key && field.kind === 'secret') ? [key, ''] : [key, value])))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível salvar a configuração.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-500">Carregando configuração segura…</p></section>
  if (!fields.length) return null

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Configuração segura</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">Credenciais ficam somente no cofre do servidor. Salvá-las não declara o provider conectado: a ativação exige validação real.</p>
      <div className="mt-4 grid gap-3">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-sm font-bold text-slate-700">
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.kind === 'select' ? (
              <select value={values[field.key] || ''} disabled={!canManage || saving} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:opacity-60">
                <option value="">Selecione</option>
                {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input type={field.kind === 'secret' ? 'password' : 'text'} autoComplete="off" value={values[field.key] || ''} disabled={!canManage || saving} placeholder={field.kind === 'secret' && storedCredentials[field.key] ? 'Credencial já armazenada — preencha apenas para trocar' : field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold disabled:opacity-60" />
            )}
          </label>
        ))}
      </div>
      {notice ? <p role="status" className="mt-3 text-sm font-semibold text-slate-600">{notice}</p> : null}
      {canManage ? <button type="button" disabled={saving} onClick={save} className="mt-4 min-h-11 rounded-xl bg-[#0b3b78] px-4 text-sm font-black text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar configuração'}</button> : null}
    </section>
  )
}
