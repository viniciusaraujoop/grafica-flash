'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Lead = any

function formatarData(valor: string | null) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleString('pt-BR')
}

function badge(status: string) {
  const map: Record<string, string> = {
    lead: 'bg-slate-100 text-slate-700',
    checkout_criado: 'bg-yellow-100 text-yellow-800',
    pago: 'bg-blue-100 text-blue-800',
    convertido: 'bg-emerald-100 text-emerald-800',
    perdido: 'bg-red-100 text-red-800',
    opt_out: 'bg-zinc-200 text-zinc-700',
  }

  return map[status] || 'bg-slate-100 text-slate-700'
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [mensagem, setMensagem] = useState('')

  async function carregar() {
    setLoading(true)
    const res = await fetch('/api/admin/leads')
    const data = await res.json()

    if (!res.ok) {
      setMensagem(data.error || 'Erro ao carregar leads.')
      setLoading(false)
      return
    }

    setLeads(data.leads || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const pendentes = useMemo(() => leads.filter((lead) => lead.followup_due), [leads])

  async function marcarEnviado(lead: Lead) {
    if (lead.whatsapp_url) window.open(lead.whatsapp_url, '_blank')

    await fetch('/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, action: 'mark_sent', message: lead.suggested_message }),
    })

    carregar()
  }

  async function mudarStatus(lead: Lead, action: string) {
    await fetch('/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, action }),
    })

    carregar()
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm font-black text-[#05245c]">← Voltar ao admin</Link>
            <h1 className="mt-2 text-4xl font-black text-[#071b3a]">Possíveis assinantes</h1>
            <p className="mt-2 font-bold text-slate-500">Leads que começaram o cadastro, mas ainda não viraram assinatura ativa.</p>
          </div>

          <button onClick={carregar} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Atualizar</button>
        </div>

        {mensagem && <div className="mb-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{mensagem}</div>}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Total</p>
            <p className="mt-2 text-4xl font-black">{leads.length}</p>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Follow-up hoje</p>
            <p className="mt-2 text-4xl font-black text-yellow-700">{pendentes.length}</p>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Pagos sem conta</p>
            <p className="mt-2 text-4xl font-black text-blue-700">{leads.filter((lead) => lead.status === 'pago').length}</p>
          </div>
        </div>

        <div className="grid gap-4">
          {loading && <div className="rounded-[2rem] bg-white p-8 text-center font-black shadow-xl">Carregando...</div>}

          {!loading && leads.map((lead) => (
            <article key={lead.id} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black text-[#071b3a]">{lead.empresa_nome}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${badge(lead.status)}`}>{lead.status}</span>
                    {lead.followup_due && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">Chamar hoje</span>}
                  </div>

                  <p className="mt-2 font-bold text-slate-600">{lead.nome_responsavel} • {lead.email} • {lead.whatsapp}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">Plano: {lead.plano} • Segmento: {lead.segmento || lead.modelo_negocio || 'Não informado'}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">Criado em: {formatarData(lead.created_at)} • Próximo follow-up: {formatarData(lead.next_followup_at)}</p>

                  <div className="mt-4 rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Mensagem sugerida</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-slate-700">{lead.suggested_message}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                  <button onClick={() => marcarEnviado(lead)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Enviar WhatsApp</button>
                  {lead.checkout_url && <a href={lead.checkout_url} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white">Abrir checkout</a>}
                  <button onClick={() => mudarStatus(lead, 'lost')} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Marcar perdido</button>
                  <button onClick={() => mudarStatus(lead, 'opt_out')} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">Opt-out / SAIR</button>
                </div>
              </div>
            </article>
          ))}

          {!loading && leads.length === 0 && (
            <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
              <p className="text-2xl font-black">Nenhum possível assinante ainda.</p>
              <p className="mt-2 font-bold text-slate-500">Quando alguém abandonar o checkout, vai aparecer aqui.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
