'use client'

import { useState, type FormEvent } from 'react'

type Props = {
  slug: string
  companyName: string
  primaryColor?: string | null
}

type FormState = {
  nome: string
  telefone: string
  produto: string
  quantidade: string
  observacoes: string
}

const initialState: FormState = {
  nome: '',
  telefone: '',
  produto: '',
  quantidade: '1',
  observacoes: '',
}

export default function PublicOrderRequestForm({ slug, companyName, primaryColor }: Props) {
  const [form, setForm] = useState<FormState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function setField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/public/orcamento/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; order_id?: string }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar sua solicitação.')

      setSuccess(`Solicitação enviada para ${companyName}. A empresa já pode acompanhar pelo painel.`)
      setForm(initialState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar sua solicitação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(10,43,82,.10)] sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Seu nome
          <input required maxLength={120} value={form.nome} onChange={(event) => setField('nome', event.target.value)} className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          WhatsApp
          <input required inputMode="tel" maxLength={30} value={form.telefone} onChange={(event) => setField('telefone', event.target.value)} placeholder="(82) 99999-9999" className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Produto ou serviço
          <input required maxLength={180} value={form.produto} onChange={(event) => setField('produto', event.target.value)} placeholder="O que você precisa?" className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Quantidade
          <input required type="number" min="1" max="100000" value={form.quantidade} onChange={(event) => setField('quantidade', event.target.value)} className="h-12 rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
        Detalhes da solicitação
        <textarea maxLength={2000} rows={5} value={form.observacoes} onChange={(event) => setField('observacoes', event.target.value)} placeholder="Medidas, prazo, modelo, referência ou qualquer informação que ajude a empresa a responder melhor." className="resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
      </label>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p role="status" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

      <button type="submit" disabled={submitting} className="mt-5 w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60" style={{ backgroundColor: primaryColor || '#0b3b78' }}>
        {submitting ? 'Enviando...' : 'Enviar solicitação'}
      </button>
    </form>
  )
}
