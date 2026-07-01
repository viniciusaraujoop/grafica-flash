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
  business_account_id: string
  ai_prompt: string
  fallback_message: string
  template_order_created: string
  template_order_status: string
  template_proposal_update: string
  template_payment_update: string
  template_language: string
}

type EnvStatus = {
  has_token?: boolean
  has_phone_number_id?: boolean
  has_verify_token?: boolean
  has_openai?: boolean
  graph_version?: string
}

type TabKey = 'resumo' | 'automacoes' | 'mensagens' | 'ia' | 'teste'

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
  business_account_id: '',
  ai_prompt: '',
  fallback_message: 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.',
  template_order_created: '',
  template_order_status: '',
  template_proposal_update: '',
  template_payment_update: '',
  template_language: 'pt_BR',
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'automacoes', label: 'Automações' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'ia', label: 'IA' },
  { key: 'teste', label: 'Teste' },
]

const automationFields: Array<{
  key: keyof Settings
  title: string
  description: string
}> = [
  {
    key: 'notify_owner_new_order',
    title: 'Avisar a empresa sobre novo pedido',
    description: 'Quando um cliente fizer um pedido, o número interno recebe um aviso com cliente, item, valor e link do pedido.',
  },
  {
    key: 'notify_client_new_order',
    title: 'Confirmar pedido para o cliente',
    description: 'O cliente recebe uma confirmação automática informando que o pedido foi recebido.',
  },
  {
    key: 'notify_client_order_status',
    title: 'Avisar cliente sobre mudança de status',
    description: 'Ao mudar para Em análise, Aprovado, Em produção, Pronto ou Entregue, o cliente recebe a atualização.',
  },
  {
    key: 'notify_client_proposal',
    title: 'Avisar cliente sobre proposta',
    description: 'Quando uma proposta for enviada ou atualizada, o cliente pode receber o aviso pelo WhatsApp.',
  },
  {
    key: 'notify_owner_proposal',
    title: 'Avisar empresa sobre proposta',
    description: 'A equipe recebe avisos quando uma proposta for aprovada, recusada ou precisar de alteração.',
  },
]

function sanitizePhonePreview(value: string) {
  const phone = String(value || '').replace(/\D/g, '')
  if (!phone) return 'Nenhum número configurado'
  if (phone.startsWith('55')) return `+${phone}`
  return `+55${phone}`
}

function statusClass(ok: boolean) {
  return ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
}

function statusText(ok: boolean) {
  return ok ? 'Configurado' : 'Pendente'
}

function cleanPhone(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 14)
}

export default function WhatsAppPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('resumo')
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [company, setCompany] = useState<any>(null)
  const [env, setEnv] = useState<EnvStatus>({})
  const [canManage, setCanManage] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [testText, setTestText] = useState('Teste de conexão do WhatsApp. Se você recebeu esta mensagem, a integração está funcionando.')

  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/whatsapp/webhook'
    return `${window.location.origin}/api/whatsapp/webhook`
  }, [])

  const configuredNumberId = Boolean(settings.phone_number_id || env?.has_phone_number_id)
  const hasToken = Boolean(env?.has_token)
  const hasVerifyToken = Boolean(env?.has_verify_token)
  const whatsappReady = Boolean(settings.enabled && hasToken && configuredNumberId)
  const aiReady = Boolean(settings.ai_enabled && env?.has_openai)
  const ownerPhoneReady = Boolean(settings.owner_phone)

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function load() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token

      if (!accessToken) {
        window.location.href = '/login'
        return
      }

      setToken(accessToken)

      const response = await fetch('/api/whatsapp/settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao carregar WhatsApp.')
      }

      const nextSettings = { ...defaultSettings, ...(payload.settings || {}) }

      setCompany(payload.company || null)
      setSettings(nextSettings)
      setEnv(payload.env || {})
      setCanManage(Boolean(payload.can_manage))
      setTestPhone(nextSettings.owner_phone || payload.company?.whatsapp || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!canManage) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/whatsapp/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao salvar WhatsApp.')
      }

      setSettings({ ...defaultSettings, ...(payload.settings || {}) })
      setMessage('Configurações do WhatsApp salvas com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar WhatsApp.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!canManage) return

    setTesting(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/whatsapp/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testPhone,
          text: testText,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.result?.error || 'Erro ao enviar mensagem de teste.')
      }

      setMessage('Mensagem de teste enviada com sucesso.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem de teste.')
    } finally {
      setTesting(false)
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setMessage('Webhook copiado.')
    } catch {
      setError('Não foi possível copiar o webhook automaticamente.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4 text-[#071b3a]">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
          <p className="mt-5 font-black">Carregando WhatsApp...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-[#05245c]">Atendimento e automações</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                WhatsApp
              </h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Configure avisos de novos pedidos, atualizações de status, propostas, mensagens de teste e atendimento com IA.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${statusClass(whatsappReady)}`}>
                  {whatsappReady ? 'WhatsApp pronto' : 'WhatsApp pendente'}
                </span>
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${statusClass(ownerPhoneReady)}`}>
                  {ownerPhoneReady ? 'Número interno definido' : 'Número interno pendente'}
                </span>
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${statusClass(aiReady || !settings.ai_enabled)}`}>
                  {settings.ai_enabled ? (aiReady ? 'IA pronta' : 'IA pendente') : 'IA desligada'}
                </span>
              </div>
            </div>

            <div className="rounded-[1.7rem] bg-[#05245c] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/55">Empresa</p>
              <h2 className="mt-2 text-2xl font-black">{company?.nome || 'Empresa'}</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-white/70">
                Perfil atual: {canManage ? 'pode editar configurações' : 'somente leitura'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('teste')}
                className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#05245c]"
              >
                Testar envio
              </button>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <nav className="flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-xl shadow-blue-950/5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black ${
                activeTab === tab.key ? 'bg-[#05245c] text-white' : 'text-slate-500 hover:bg-blue-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            {activeTab === 'resumo' ? (
              <>
                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Conexão</p>
                    <h2 className="mt-2 text-2xl font-black">{whatsappReady ? 'Ativa' : 'Pendente'}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Token, número e ativação precisam estar corretos para enviar mensagens.
                    </p>
                  </article>

                  <article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Avisos internos</p>
                    <h2 className="mt-2 text-2xl font-black">{sanitizePhonePreview(settings.owner_phone)}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Este número recebe avisos de pedidos e propostas.
                    </p>
                  </article>

                  <article className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">IA</p>
                    <h2 className="mt-2 text-2xl font-black">{settings.ai_enabled ? 'Ligada' : 'Desligada'}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      A IA depende da chave OpenAI configurada no ambiente.
                    </p>
                  </article>
                </section>

                <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                  <h2 className="text-2xl font-black tracking-[-0.04em]">Configuração rápida</h2>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#f5f8ff] p-4">
                      <div>
                        <p className="font-black">Ativar WhatsApp automático</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">Permite envio de avisos automáticos.</p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={settings.enabled}
                        onChange={(event) => update('enabled', event.target.checked)}
                      />
                    </label>

                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#f5f8ff] p-4">
                      <div>
                        <p className="font-black">Ativar IA no atendimento</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">Usa IA para responder mensagens recebidas.</p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={settings.ai_enabled}
                        onChange={(event) => update('ai_enabled', event.target.checked)}
                      />
                    </label>

                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-sm font-black text-slate-700">Número interno que receberá pedidos</span>
                      <input
                        disabled={!canManage}
                        value={settings.owner_phone}
                        onChange={(event) => update('owner_phone', cleanPhone(event.target.value))}
                        placeholder="5582999999999"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                      />
                      <span className="text-xs font-bold text-slate-400">Use DDI + DDD + número. Exemplo: 5582999999999.</span>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Phone Number ID</span>
                      <input
                        disabled={!canManage}
                        value={settings.phone_number_id}
                        onChange={(event) => update('phone_number_id', event.target.value)}
                        placeholder="Opcional se já estiver no ambiente"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Business Account ID</span>
                      <input
                        disabled={!canManage}
                        value={settings.business_account_id}
                        onChange={(event) => update('business_account_id', event.target.value)}
                        placeholder="Opcional"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                      />
                    </label>
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === 'automacoes' ? (
              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">Automações do WhatsApp</h2>
                <p className="mt-2 font-bold leading-7 text-slate-500">
                  Escolha quais eventos devem gerar mensagens automáticas.
                </p>

                <div className="mt-6 grid gap-4">
                  {automationFields.map((item) => (
                    <label key={item.key} className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-[#f5f8ff] p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black">{item.title}</p>
                        <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-slate-500">{item.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!canManage}
                        checked={Boolean(settings[item.key])}
                        onChange={(event) => update(item.key, event.target.checked as any)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === 'mensagens' ? (
              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">Mensagens automáticas</h2>
                <p className="mt-2 font-bold leading-7 text-slate-500">
                  Configure nomes de mensagens cadastradas para envio automático. Se não usar mensagens cadastradas, deixe os campos em branco.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Pedido recebido</span>
                    <input
                      disabled={!canManage}
                      value={settings.template_order_created}
                      onChange={(event) => update('template_order_created', event.target.value)}
                      placeholder="orcaly_pedido_recebido"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Status do pedido</span>
                    <input
                      disabled={!canManage}
                      value={settings.template_order_status}
                      onChange={(event) => update('template_order_status', event.target.value)}
                      placeholder="orcaly_status_pedido"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Atualização de proposta</span>
                    <input
                      disabled={!canManage}
                      value={settings.template_proposal_update}
                      onChange={(event) => update('template_proposal_update', event.target.value)}
                      placeholder="orcaly_proposta"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Idioma das mensagens</span>
                    <input
                      disabled={!canManage}
                      value={settings.template_language}
                      onChange={(event) => update('template_language', event.target.value)}
                      placeholder="pt_BR"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-5">
                  <p className="font-black text-[#05245c]">Exemplos de mensagens enviadas</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 font-bold leading-6 text-slate-600">
                      Olá, João! Recebemos seu pedido #A1B2C3 em Gráfica Flash. Nossa equipe vai analisar e seguir com o atendimento.
                    </div>
                    <div className="rounded-2xl bg-white p-4 font-bold leading-6 text-slate-600">
                      Olá, João! Seu pedido #A1B2C3 foi atualizado para: Em produção.
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'ia' ? (
              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">IA de atendimento</h2>
                <p className="mt-2 font-bold leading-7 text-slate-500">
                  Defina como a IA deve responder quando mensagens chegarem no WhatsApp da empresa.
                </p>

                <div className="mt-6 grid gap-4">
                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-[#f5f8ff] p-4">
                    <div>
                      <p className="font-black">Ativar respostas com IA</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        A IA precisa da chave OpenAI configurada no ambiente.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      checked={settings.ai_enabled}
                      onChange={(event) => update('ai_enabled', event.target.checked)}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Instrução da IA</span>
                    <textarea
                      disabled={!canManage}
                      value={settings.ai_prompt}
                      onChange={(event) => update('ai_prompt', event.target.value)}
                      rows={7}
                      placeholder="Exemplo: seja educado, pergunte produto, medida, quantidade, prazo e confirme o WhatsApp do cliente antes de gerar orçamento."
                      className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Mensagem quando a IA não conseguir responder</span>
                    <textarea
                      disabled={!canManage}
                      value={settings.fallback_message}
                      onChange={(event) => update('fallback_message', event.target.value)}
                      rows={4}
                      className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c] disabled:opacity-60"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {activeTab === 'teste' ? (
              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h2 className="text-2xl font-black tracking-[-0.04em]">Teste de envio</h2>
                <p className="mt-2 font-bold leading-7 text-slate-500">
                  Envie uma mensagem de teste para confirmar se a integração está funcionando.
                </p>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Número para teste</span>
                    <input
                      value={testPhone}
                      onChange={(event) => setTestPhone(cleanPhone(event.target.value))}
                      placeholder="5582999999999"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Mensagem</span>
                    <textarea
                      value={testText}
                      onChange={(event) => setTestText(event.target.value)}
                      rows={5}
                      className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!canManage || testing}
                    onClick={sendTest}
                    className="w-fit rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testing ? 'Enviando...' : 'Enviar teste'}
                  </button>
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                disabled={!canManage || saving}
                className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
              <button
                type="button"
                onClick={load}
                className="rounded-2xl border border-blue-100 bg-white px-6 py-4 font-black text-[#05245c]"
              >
                Recarregar
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Ambiente</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Status técnico</h2>

              <div className="mt-5 grid gap-3">
                {[
                  ['Token da API', hasToken],
                  ['Phone Number ID', configuredNumberId],
                  ['Verify Token', hasVerifyToken],
                  ['OpenAI API', Boolean(env?.has_openai)],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f5f8ff] p-4">
                    <span className="font-black text-slate-700">{String(label)}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(Boolean(ok))}`}>
                      {statusText(Boolean(ok))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-black text-[#05245c]">Webhook</p>
                <p className="mt-2 break-all text-sm font-bold text-slate-600">{webhookUrl}</p>
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-[#05245c]"
                >
                  Copiar webhook
                </button>
              </div>

              <p className="mt-4 text-xs font-bold leading-5 text-slate-400">
                Versão Graph API: {env?.graph_version || 'v23.0'}
              </p>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Fluxo</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Como vai funcionar</h2>

              <div className="mt-5 grid gap-3">
                {[
                  ['1', 'Cliente faz pedido', 'O pedido é salvo no Orçaly.'],
                  ['2', 'Empresa recebe aviso', 'O número interno recebe mensagem com resumo e link.'],
                  ['3', 'Status muda', 'Ao atualizar o pedido, o cliente recebe a novidade.'],
                  ['4', 'Histórico fica salvo', 'Os envios ficam registrados para conferência.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="flex gap-3 rounded-2xl bg-[#f5f8ff] p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#05245c] text-sm font-black text-white">{number}</span>
                    <div>
                      <p className="font-black">{title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </form>
      </section>
    </main>
  )
}
