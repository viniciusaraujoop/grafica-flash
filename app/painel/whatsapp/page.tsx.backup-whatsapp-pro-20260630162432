'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Settings = {
  enabled: boolean
  ai_enabled: boolean
  notify_owner_new_order: boolean
  notify_client_new_order: boolean
  notify_client_order_status: boolean
  notify_client_proposal: boolean
  notify_owner_proposal: boolean
  owner_phone: string
  phone_number_id: string
  ai_prompt: string
  fallback_message: string
  template_order_created: string
  template_order_status: string
  template_proposal_update: string
  template_payment_update: string
  template_language: string
}

const defaultSettings: Settings = {
  enabled: false,
  ai_enabled: false,
  notify_owner_new_order: true,
  notify_client_new_order: true,
  notify_client_order_status: true,
  notify_client_proposal: true,
  notify_owner_proposal: true,
  owner_phone: '',
  phone_number_id: '',
  ai_prompt: '',
  fallback_message: 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
  template_order_created: '',
  template_order_status: '',
  template_proposal_update: '',
  template_payment_update: '',
  template_language: 'pt_BR',
}

export default function WhatsAppPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [company, setCompany] = useState<any>(null)
  const [env, setEnv] = useState<any>(null)
  const [canManage, setCanManage] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testText, setTestText] = useState('Teste do WhatsApp Orçaly. Se chegou, a conexão funcionou.')

  const webhookUrl = useMemo(() => typeof window === 'undefined' ? '/api/whatsapp/webhook' : `${window.location.origin}/api/whatsapp/webhook`, [])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function load() {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) { window.location.href = '/login'; return }

    setToken(accessToken)
    const response = await fetch('/api/whatsapp/settings', { headers: { Authorization: `Bearer ${accessToken}` } })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao carregar WhatsApp.')
      setLoading(false)
      return
    }

    setCompany(payload.company)
    setSettings({ ...defaultSettings, ...(payload.settings || {}) })
    setEnv(payload.env || {})
    setCanManage(Boolean(payload.can_manage))
    setTestPhone(payload.settings?.owner_phone || payload.company?.whatsapp || '')
    setLoading(false)
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setSaving(true); setError(''); setMessage('')

    const response = await fetch('/api/whatsapp/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao salvar WhatsApp.')
      setSaving(false)
      return
    }

    setSettings({ ...defaultSettings, ...(payload.settings || {}) })
    setMessage('Configurações salvas.')
    setSaving(false)
  }

  async function sendTest() {
    setError(''); setMessage('')

    const response = await fetch('/api/whatsapp/settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testPhone, text: testText }),
    })

    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      setError(payload.error || payload.result?.error || 'Erro ao enviar teste.')
      return
    }
    setMessage('Mensagem de teste enviada.')
  }

  useEffect(() => { load() }, [])

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#f8fbff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando WhatsApp...</div></main>

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8fbff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">WhatsApp e IA</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Envie avisos automáticos para clientes e equipe, registre eventos e deixe a IA responder mensagens recebidas.</p>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <form onSubmit={save} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Empresa</p>
                <h2 className="mt-1 text-2xl font-black">{company?.nome || 'Empresa'}</h2>
              </div>
              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-[#05245c]">{canManage ? 'Dono/Gerente' : 'Somente leitura'}</div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                ['enabled', 'Ativar WhatsApp automático'],
                ['ai_enabled', 'Ativar IA automática'],
                ['notify_owner_new_order', 'Avisar empresa sobre novo pedido'],
                ['notify_client_new_order', 'Avisar cliente sobre pedido recebido'],
                ['notify_client_order_status', 'Avisar cliente sobre status'],
                ['notify_client_proposal', 'Avisar cliente sobre proposta'],
                ['notify_owner_proposal', 'Avisar empresa sobre proposta'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8fbff] p-4 text-sm font-black">
                  {label}
                  <input type="checkbox" disabled={!canManage} checked={Boolean((settings as any)[key])} onChange={(event) => update(key as keyof Settings, event.target.checked as any)} />
                </label>
              ))}

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">WhatsApp que receberá avisos internos</span>
                <input disabled={!canManage} value={settings.owner_phone} onChange={(event) => update('owner_phone', event.target.value)} placeholder="5582999999999" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Phone Number ID específico da empresa</span>
                <input disabled={!canManage} value={settings.phone_number_id} onChange={(event) => update('phone_number_id', event.target.value)} placeholder="Opcional, senão usa ENV global" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
              </label>

              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="font-black text-amber-800">Templates aprovados</p>
                <p className="mt-1 text-sm font-bold leading-6 text-amber-700">Para mensagens iniciadas pela empresa fora da janela de atendimento do WhatsApp, use templates aprovados pela Meta. Se deixar vazio, o Orçaly tenta texto livre e a API pode recusar. Maravilhas da burocracia corporativa.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input disabled={!canManage} value={settings.template_order_created} onChange={(event) => update('template_order_created', event.target.value)} placeholder="template_order_created" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
                <input disabled={!canManage} value={settings.template_order_status} onChange={(event) => update('template_order_status', event.target.value)} placeholder="template_order_status" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
                <input disabled={!canManage} value={settings.template_proposal_update} onChange={(event) => update('template_proposal_update', event.target.value)} placeholder="template_proposal_update" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
                <input disabled={!canManage} value={settings.template_language} onChange={(event) => update('template_language', event.target.value)} placeholder="pt_BR" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Prompt da IA</span>
                <textarea disabled={!canManage} value={settings.ai_prompt} onChange={(event) => update('ai_prompt', event.target.value)} rows={6} placeholder="Ex.: Seja direto, pergunte medida, quantidade, prazo e envie para orçamento." className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Mensagem de fallback</span>
                <textarea disabled={!canManage} value={settings.fallback_message} onChange={(event) => update('fallback_message', event.target.value)} rows={3} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none disabled:opacity-60" />
              </label>

              <button disabled={!canManage || saving} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar configurações'}</button>
            </div>
          </form>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Ambiente</p>
              <h2 className="mt-1 text-2xl font-black">Configuração técnica</h2>
              <div className="mt-5 grid gap-3">
                {[
                  ['Token WhatsApp', env?.has_token],
                  ['Phone Number ID', env?.has_phone_number_id || Boolean(settings.phone_number_id)],
                  ['Verify Token', env?.has_verify_token],
                  ['OpenAI API', env?.has_openai],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-[#f8fbff] p-4">
                    <span className="font-black text-slate-700">{label}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{ok ? 'OK' : 'Faltando'}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-black text-[#05245c]">Webhook</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-600">{webhookUrl}</p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Teste</p>
              <h2 className="mt-1 text-2xl font-black">Enviar mensagem</h2>
              <div className="mt-5 grid gap-3">
                <input value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="5582999999999" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <textarea value={testText} onChange={(event) => setTestText(event.target.value)} rows={4} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <button type="button" disabled={!canManage} onClick={sendTest} className="rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60">Enviar teste</button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
