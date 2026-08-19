'use client'

import { FormEvent, useEffect, useState } from 'react'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Mode = 'day_summary' | 'followup' | 'customer' | 'product'
type Lead = { id: string; nome: string; etapa?: string | null; telefone?: string | null }

const modes: Array<{ id: Mode; label: string; title: string; description: string }> = [
  { id: 'day_summary', label: 'Resumo do dia', title: 'Entender o que pede atenção', description: 'Resume pedidos, propostas, tarefas e contatos com números reais.' },
  { id: 'followup', label: 'Follow-up', title: 'Sugerir mensagem para um lead', description: 'A IA escreve a mensagem. Você revisa e decide se envia.' },
  { id: 'customer', label: 'Cliente', title: 'Resumir histórico e oportunidade', description: 'Reúne histórico visível, valor, etapa e próxima ação.' },
  { id: 'product', label: 'Produto', title: 'Ajudar no cadastro comercial', description: 'Sugere nome, descrição, categoria e texto comercial sem inventar preço.' },
]

export default function AssistenteOrcalyPage() {
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<Mode>('day_summary')
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadId, setLeadId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const accessToken = await getAccessTokenClient()
        setToken(accessToken)
        const response = await fetch('/api/crm/leads?status=ativo', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (response.ok) setLeads((payload.leads || []).slice(0, 100))
      } catch {
        // O assistente continua útil mesmo se a lista de leads não carregar.
      }
    })()
  }, [])

  async function run(event?: FormEvent) {
    event?.preventDefault()
    setError(''); setAnswer(''); setSource(''); setLoading(true)
    try {
      const response = await fetch('/api/ai/business-assistant', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || await getAccessTokenClient()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, prompt, lead_id: leadId || null }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao executar a IA operacional.')
      setAnswer(payload.answer || '')
      setSource(payload.source || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar a IA operacional.')
    } finally { setLoading(false) }
  }

  const active = modes.find((item) => item.id === mode) || modes[0]
  const needsLead = mode === 'followup' || mode === 'customer'

  return (
    <main className="grid gap-4 text-[#10233f]">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[#071d43] p-5 text-white shadow-[0_18px_50px_rgba(7,29,67,.16)] sm:p-6">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" aria-hidden="true" />
        <div className="relative"><span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-blue-200">IA operacional</span><h2 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">IA que executa trabalho útil, não um chatbot de enfeite.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/75">Resumo do dia, follow-up, leitura de cliente e texto de produto. Se a OpenAI falhar, o Orçaly usa fallback local e o sistema principal continua funcionando.</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[1.3rem] border border-slate-200 bg-white p-2 shadow-[0_10px_30px_rgba(10,40,82,.05)]">
          {modes.map((item) => <button key={item.id} type="button" onClick={() => { setMode(item.id); setAnswer(''); setError('') }} className={`w-full rounded-xl px-3 py-3 text-left transition ${mode === item.id ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'}`}><strong className={`block text-sm ${mode === item.id ? 'text-[#174e93]' : 'text-slate-700'}`}>{item.label}</strong><small className="mt-0.5 block text-[11px] leading-4 text-slate-400">{item.description}</small></button>)}
        </aside>

        <section className="rounded-[1.3rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(10,40,82,.05)] sm:p-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#4776ad]">{active.label}</span><h3 className="mt-1 text-xl font-bold tracking-[-.03em]">{active.title}</h3>
          <form onSubmit={(event) => void run(event)} className="mt-5 grid gap-3">
            {needsLead ? <label className="grid gap-1.5 text-xs font-extrabold text-slate-500">Lead/cliente<select required value={leadId} onChange={(event) => setLeadId(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300"><option value="">Selecione...</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.nome}{lead.etapa ? ` · ${lead.etapa}` : ''}</option>)}</select></label> : null}

            {mode === 'product' ? <label className="grid gap-1.5 text-xs font-extrabold text-slate-500">O que você já sabe sobre o produto/serviço<textarea required value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} placeholder="Ex.: cartão de visita premium, frente e verso, foco em advogados..." className="resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700 outline-none focus:border-blue-300 focus:bg-white" /></label> : null}

            {mode === 'followup' ? <label className="grid gap-1.5 text-xs font-extrabold text-slate-500">Contexto opcional<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Ex.: quero cobrar aprovação sem parecer insistente" className="resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 focus:bg-white" /></label> : null}

            <button disabled={loading || (needsLead && !leadId)} className="mt-1 rounded-xl bg-[#0b3b78] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#082f61] disabled:opacity-40">{loading ? 'Analisando dados...' : mode === 'day_summary' ? 'Gerar resumo com dados reais' : mode === 'followup' ? 'Sugerir mensagem' : mode === 'customer' ? 'Resumir cliente' : 'Gerar sugestão de cadastro'}</button>
          </form>

          {error ? <div role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
          {answer ? <section className="mt-5 rounded-[1.1rem] border border-blue-100 bg-[#f7faff] p-4"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Resultado</span><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-slate-400 ring-1 ring-slate-200">{source === 'openai' ? 'OpenAI + dados Orçaly' : 'Fallback local'}</span></div><pre className="mt-3 whitespace-pre-wrap font-sans text-sm font-medium leading-6 text-slate-700">{answer}</pre>{mode === 'followup' ? <div className="mt-3 border-t border-blue-100 pt-3 text-[11px] font-semibold text-slate-400">A mensagem não foi enviada. Revise antes de copiar para o WhatsApp.</div> : null}</section> : null}
        </section>
      </section>
    </main>
  )
}
