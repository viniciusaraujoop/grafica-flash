'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

const etapas = [
  { id: 'novo_lead', label: 'Novo lead' },
  { id: 'em_atendimento', label: 'Em atendimento' },
  { id: 'orcamento_enviado', label: 'Orçamento enviado' },
  { id: 'aguardando_resposta', label: 'Aguardando resposta' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'fechado', label: 'Fechado' },
  { id: 'perdido', label: 'Perdido' },
  { id: 'recorrente', label: 'Cliente recorrente' },
]

function etapaLabel(value: string) {
  return etapas.find((item) => item.id === value)?.label || value
}

function moeda(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CrmPage() {
  const [token, setToken] = useState('')
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    origem: 'manual',
    etapa: 'novo_lead',
    valor_estimado: '',
    proximo_contato_em: '',
    observacoes: '',
  })

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    etapas.forEach((etapa) => map.set(etapa.id, []))

    leads.forEach((lead) => {
      const key = lead.etapa || 'novo_lead'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(lead)
    })

    return map
  }, [leads])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/crm/leads', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar CRM.')

      setLeads(payload.leads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRM.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function createLead(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          valor_estimado: Number(form.valor_estimado || 0),
          proximo_contato_em: form.proximo_contato_em || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao criar lead.')

      setMessage('Lead criado com sucesso.')
      setForm({ nome: '', telefone: '', email: '', origem: 'manual', etapa: 'novo_lead', valor_estimado: '', proximo_contato_em: '', observacoes: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar lead.')
    }

    setSaving(false)
  }

  async function moveLead(id: string, etapa: string) {
    const response = await fetch(`/api/crm/leads/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ etapa }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error || 'Erro ao mover lead.')
      return
    }

    await load()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando CRM...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">CRM</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Funil comercial</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Acompanhe leads, orçamentos, negociações e clientes recorrentes. Porque confiar na memória humana para venda é basicamente jogar dinheiro no mato.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#05245c] p-5 text-white">
              <p className="text-sm font-black text-white/60">Leads ativos</p>
              <p className="mt-2 text-4xl font-black">{leads.length}</p>
              <p className="mt-2 text-sm font-bold text-white/70">Distribuídos por etapa do funil.</p>
            </div>
          </div>
        </header>

        {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <form onSubmit={createLead} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 xl:sticky xl:top-6 xl:self-start">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Novo lead</h2>

            <div className="mt-5 grid gap-3">
              <input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome do cliente" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="WhatsApp" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="E-mail" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <select value={form.etapa} onChange={(event) => setForm({ ...form, etapa: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                {etapas.map((etapa) => <option key={etapa.id} value={etapa.id}>{etapa.label}</option>)}
              </select>
              <input type="number" value={form.valor_estimado} onChange={(event) => setForm({ ...form, valor_estimado: event.target.value })} placeholder="Valor estimado" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <input type="datetime-local" value={form.proximo_contato_em} onChange={(event) => setForm({ ...form, proximo_contato_em: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Observações" rows={4} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <button disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                {saving ? 'Salvando...' : 'Criar lead'}
              </button>
            </div>
          </form>

          <div className="grid gap-4 xl:grid-cols-2">
            {etapas.map((etapa) => (
              <section key={etapa.id} className="rounded-[2rem] border border-blue-100 bg-white/80 p-5 shadow-xl shadow-blue-950/5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black tracking-[-0.03em]">{etapa.label}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{grouped.get(etapa.id)?.length || 0}</span>
                </div>

                <div className="grid gap-3">
                  {(grouped.get(etapa.id) || []).map((lead) => (
                    <article key={lead.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4">
                      <p className="font-black">{lead.nome}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{lead.telefone || lead.email || 'Sem contato'}</p>
                      <p className="mt-2 text-sm font-black text-[#05245c]">{moeda(lead.valor_estimado || 0)}</p>
                      {lead.observacoes && <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{lead.observacoes}</p>}
                      <select value={lead.etapa} onChange={(event) => moveLead(lead.id, event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold outline-none">
                        {etapas.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </article>
                  ))}

                  {(grouped.get(etapa.id)?.length || 0) === 0 && (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-400">
                      Nenhum lead nesta etapa.
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
