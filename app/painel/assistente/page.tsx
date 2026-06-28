'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

const presets = [
  'Crie 10 produtos para uma gráfica rápida',
  'Melhore os textos do meu site para parecer mais profissional',
  'Crie perguntas de orçamento para uma imobiliária',
  'Sugira 3 cupons estratégicos para vender mais',
  'Monte uma promoção para essa semana',
  'Crie um roteiro de atendimento no WhatsApp',
]

export default function AssistenteOrcalyPage() {
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function ask(event?: FormEvent) {
    event?.preventDefault()
    setError('')
    setAnswer('')

    if (!prompt.trim()) {
      setError('Digite o que você quer criar ou melhorar.')
      return
    }

    setLoading(true)

    try {
      const token = await getAccessTokenClient()
      const response = await fetch('/api/ai/business-assistant', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao consultar assistente.')

      setAnswer(payload.answer || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar assistente.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">IA do Orçaly</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Assistente de configuração</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Use a IA para criar produtos, melhorar textos, gerar campanhas, montar perguntas e acelerar a configuração da empresa. A máquina finalmente fazendo trabalho útil, veja só.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Ideias rápidas</h2>
            <div className="mt-5 grid gap-3">
              {presets.map((item) => (
                <button key={item} onClick={() => setPrompt(item)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-black text-[#071b3a] transition hover:border-[#05245c] hover:bg-blue-50">
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <form onSubmit={ask}>
              <label>
                <p className="text-sm font-black">O que você quer fazer?</p>
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold leading-7 outline-none focus:border-[#05245c]" placeholder="Ex: crie produtos para uma loja de personalizados..." />
              </label>

              <button disabled={loading} className="mt-4 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
                {loading ? 'Pensando...' : 'Gerar com IA'}
              </button>
            </form>

            {error && <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}

            {answer && (
              <div className="mt-6 rounded-[1.5rem] bg-[#f5f8ff] p-5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Resultado</p>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm font-bold leading-7 text-[#071b3a]">{answer}</pre>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
