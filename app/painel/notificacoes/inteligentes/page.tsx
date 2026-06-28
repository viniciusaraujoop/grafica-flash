'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Settings = Record<string, any>

const booleanFields = [
  ['new_order_enabled', 'Novo pedido recebido'],
  ['order_stuck_enabled', 'Pedido parado há X dias'],
  ['task_due_today_enabled', 'Tarefa vence hoje'],
  ['lead_idle_enabled', 'Lead sem contato há X dias'],
  ['proposal_idle_enabled', 'Proposta sem resposta'],
  ['coupon_expiring_enabled', 'Cupom perto de expirar'],
  ['product_without_image_enabled', 'Produto sem imagem'],
  ['site_without_logo_enabled', 'Site sem logo'],
  ['subscription_expiring_enabled', 'Assinatura perto de vencer'],
]

const numberFields = [
  ['order_stuck_days', 'Pedido parado depois de quantos dias?'],
  ['lead_idle_days', 'Lead sem contato depois de quantos dias?'],
  ['proposal_idle_days', 'Proposta sem resposta depois de quantos dias?'],
  ['coupon_expiring_days', 'Avisar cupom faltando quantos dias?'],
  ['subscription_expiring_days', 'Avisar assinatura faltando quantos dias?'],
]

export default function NotificacoesInteligentesPage() {
  const [token, setToken] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [scanResult, setScanResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/notifications/smart-settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar configurações.')

      setSettings(payload.settings || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function update(field: string, value: any) {
    setSettings((current) => ({ ...(current || {}), [field]: value }))
  }

  async function save() {
    if (!settings) return

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/notifications/smart-settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar configurações.')

      setSettings(payload.settings)
      setMessage('Configurações salvas.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações.')
    }

    setSaving(false)
  }

  async function scanNow() {
    setScanning(true)
    setMessage('')
    setError('')
    setScanResult(null)

    try {
      const response = await fetch('/api/notifications/smart-scan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao verificar alertas.')

      setScanResult(payload.result)
      setMessage(`Verificação concluída. ${payload.result?.created || 0} notificação(ões) criada(s).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar alertas.')
    }

    setScanning(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black text-[#071b3a] shadow-xl">
          Carregando notificações inteligentes...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel/notificacoes" className="text-sm font-black text-[#05245c]">← Voltar às notificações</Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Alertas automáticos</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Notificações inteligentes</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                O Orçaly verifica situações importantes e cria alertas antes do cliente aparecer reclamando no WhatsApp, essa rede social de boletos emocionais.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#05245c] p-5 text-white">
              <p className="text-sm font-black text-white/60">Verificação manual</p>
              <p className="mt-2 text-sm font-bold leading-6 text-white/75">
                Clique para procurar pedidos parados, tarefas vencendo, cupons expirando e outros sinais de caos.
              </p>
              <button onClick={scanNow} disabled={scanning} className="mt-4 w-full rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#05245c] disabled:opacity-60">
                {scanning ? 'Verificando...' : 'Verificar agora'}
              </button>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Alertas ativos</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {booleanFields.map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#f5f8ff] p-4 font-black">
                <input
                  type="checkbox"
                  checked={Boolean(settings?.[field])}
                  onChange={(event) => update(field, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Prazos dos alertas</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {numberFields.map(([field, label]) => (
              <label key={field} className="grid gap-2">
                <span className="text-sm font-black">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings?.[field] ?? 1}
                  onChange={(event) => update(field, Number(event.target.value || 1))}
                  className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]"
                />
              </label>
            ))}
          </div>

          <button onClick={save} disabled={saving} className="mt-5 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </section>

        {scanResult ? (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Resultado da última verificação</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-700">Criadas</p>
                <p className="mt-1 text-3xl font-black text-emerald-700">{scanResult.created || 0}</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-black text-[#05245c]">Já existiam</p>
                <p className="mt-1 text-3xl font-black text-[#05245c]">{scanResult.skipped || 0}</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-black text-red-700">Erros</p>
                <p className="mt-1 text-3xl font-black text-red-700">{scanResult.errors?.length || 0}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {(scanResult.events || []).map((event: any, index: number) => (
                <article key={`${event.type}-${index}`} className="rounded-2xl border border-slate-100 bg-[#f5f8ff] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">{event.type}</p>
                      <h3 className="mt-1 font-black">{event.title}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${event.created ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {event.created ? 'Criada' : 'Já existia'}
                    </span>
                  </div>
                </article>
              ))}

              {(scanResult.errors || []).map((item: string, index: number) => (
                <article key={`error-${index}`} className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">
                  {item}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Automação na Vercel</h2>
          <p className="mt-3 font-bold leading-7 text-slate-500">
            Para rodar automaticamente, configure um cron chamando <strong>/api/cron/smart-notifications</strong> com o segredo <strong>CRON_SECRET</strong>.
            Manualmente, o botão acima já executa a verificação da empresa atual.
          </p>
        </section>
      </section>
    </main>
  )
}
