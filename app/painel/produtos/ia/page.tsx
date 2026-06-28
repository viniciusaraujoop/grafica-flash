'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

export default function ProdutoIaPage() {
  const [form, setForm] = useState({
    nome: '',
    categoria: '',
    tipo: 'produto',
    objetivo: 'descricao',
  })
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setAnswer('')

    try {
      setLoading(true)
      const token = await getAccessTokenClient()

      const response = await fetch('/api/ai/product-helper', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao gerar sugestão.')

      setAnswer(payload.answer || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar sugestão.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">IA de catálogo</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Gerador de produto</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Gere descrição, benefícios, perguntas de orçamento e chamada comercial para produtos e serviços.
          </p>
        </header>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <form onSubmit={generate} className="grid gap-4">
            <input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome do produto ou serviço" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
            <input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} placeholder="Categoria" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
            <div className="grid gap-4 sm:grid-cols-2">
              <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                <option value="produto">Produto</option>
                <option value="servico">Serviço</option>
                <option value="pacote">Pacote</option>
              </select>
              <select value={form.objetivo} onChange={(event) => setForm({ ...form, objetivo: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                <option value="descricao">Descrição comercial</option>
                <option value="orcamento">Perguntas de orçamento</option>
                <option value="venda">Texto para vender mais</option>
              </select>
            </div>
            <button disabled={loading} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
              {loading ? 'Gerando...' : 'Gerar sugestão'}
            </button>
          </form>

          {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
          {answer && <pre className="mt-6 whitespace-pre-wrap rounded-[1.5rem] bg-[#f5f8ff] p-5 font-sans text-sm font-bold leading-7">{answer}</pre>}
        </section>
      </section>
    </main>
  )
}
