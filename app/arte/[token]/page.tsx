'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type ApprovalRequest = {
  id: string
  title?: string | null
  produto_nome?: string | null
  cliente_nome?: string | null
  artwork_url?: string | null
  preview_url?: string | null
  instructions?: string | null
  status: string
  comentario_cliente?: string | null
  approved_at?: string | null
  requested_changes_at?: string | null
  responded_at?: string | null
  expires_at?: string | null
  created_at?: string | null
  companies?: { nome?: string | null; logo_url?: string | null; whatsapp?: string | null; cor_principal?: string | null } | null
}

function dateBR(value?: string | null) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function statusTone(status?: string | null) {
  const value = String(status || '').toLowerCase()
  if (value.includes('aprov')) return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (value.includes('alter')) return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-blue-50 text-blue-700 ring-blue-100'
}

export default function ArteAprovacaoPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token
  const [request, setRequest] = useState<ApprovalRequest | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/arte/${token}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar arte.')
      setRequest(data.request)
      setComment(data.request?.comentario_cliente || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar arte.')
    } finally { setLoading(false) }
  }

  async function submit(action: 'approve' | 'request_changes') {
    setError(''); setMessage(''); setSubmitting(true)
    try {
      const response = await fetch(`/api/arte/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, comment }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Erro ao responder.')
      setRequest(data.request)
      setMessage(action === 'approve' ? 'Arte aprovada. A empresa já pode seguir com a produção.' : 'Pedido de alteração enviado com seu comentário.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao responder.')
    } finally { setSubmitting(false) }
  }

  useEffect(() => { if (token) void load() }, [token])

  if (loading) return <main className="min-h-screen bg-[#f4f7fb] px-4 py-7"><div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_340px]"><div className="h-[70vh] animate-pulse rounded-[1.7rem] bg-slate-200"/><div className="h-96 animate-pulse rounded-[1.5rem] bg-slate-100"/></div></main>

  if (!request) return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] px-4"><div className="max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-7 text-center shadow-xl"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 font-black text-red-600">!</span><h1 className="mt-4 text-2xl font-bold tracking-[-.03em] text-[#10233f]">Arte indisponível</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error || 'Este link pode ter expirado ou sido revogado.'}</p></div></main>

  const company = request.companies
  const image = request.preview_url || request.artwork_url
  const answered = Boolean(request.responded_at)
  const primary = company?.cor_principal || '#0b3b78'

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-3 py-4 text-[#10233f] sm:px-5 sm:py-7" style={{ '--art-primary': primary } as React.CSSProperties}>
      <section className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(10,40,82,.05)]">
          <div className="flex min-w-0 items-center gap-3">{company?.logo_url ? <img src={company.logo_url} alt={company.nome || 'Empresa'} className="h-10 w-10 rounded-xl object-contain"/> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--art-primary)] text-sm font-black text-white">{(company?.nome || 'O').slice(0, 1)}</span>}<span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{company?.nome || 'Empresa'}</strong><small className="block text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Aprovação de arte</small></span></div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${statusTone(request.status)}`}>{request.status || 'Aguardando'}</span>
        </header>

        {message ? <div role="status" className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
        {error ? <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(10,40,82,.07)]">
            <div className="border-b border-slate-100 p-4 sm:p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">Prévia</span><h1 className="mt-1 text-xl font-bold tracking-[-.035em] sm:text-2xl">{request.title || request.produto_nome || 'Arte para aprovação'}</h1><p className="mt-1 text-xs font-medium text-slate-400">Versão enviada em {dateBR(request.created_at)}</p></div>
            <div className="grid min-h-[55vh] place-items-center bg-[#eef2f7] p-3 sm:p-5">{image ? <img src={image} alt="Prévia da arte enviada para aprovação" className="max-h-[76vh] max-w-full rounded-lg object-contain shadow-sm"/> : <div className="max-w-sm text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white font-black text-slate-400">A</span><p className="mt-3 text-sm font-semibold text-slate-500">Nenhuma imagem foi anexada a esta aprovação.</p></div>}</div>
          </section>

          <aside className="grid gap-3 lg:sticky lg:top-4">
            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(10,40,82,.05)] sm:p-5">
              <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Detalhes</span>
              <div className="mt-3 grid gap-2"><Info label="Produto/pedido" value={request.produto_nome || request.title || 'Não informado'}/><Info label="Cliente" value={request.cliente_nome || 'Não informado'}/><Info label="Prazo do link" value={dateBR(request.expires_at)}/></div>
              {request.instructions ? <div className="mt-3 rounded-xl bg-blue-50 p-3"><strong className="text-xs text-[#174e93]">Orientações da empresa</strong><p className="mt-1 text-xs leading-5 text-slate-600">{request.instructions}</p></div> : null}
            </section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(10,40,82,.05)] sm:p-5">
              <h2 className="text-base font-bold tracking-[-.025em]">Sua decisão</h2>
              {answered ? <div className={`mt-3 rounded-xl p-3 ${request.approved_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><strong className="text-sm">Resposta registrada</strong><p className="mt-1 text-xs leading-5">{request.approved_at ? `Aprovada em ${dateBR(request.approved_at)}.` : `Alteração solicitada em ${dateBR(request.requested_changes_at)}.`}</p>{request.comentario_cliente ? <p className="mt-2 rounded-lg bg-white/60 p-2 text-xs">“{request.comentario_cliente}”</p> : null}</div> : <><label className="mt-3 grid gap-1.5 text-xs font-bold text-slate-500">Comentário<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ex.: trocar a cor, ajustar texto, aumentar a logo..." rows={4} className="resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"/></label><div className="mt-3 grid gap-2"><button type="button" disabled={submitting} onClick={() => void submit('approve')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{submitting ? 'Registrando...' : 'Aprovar arte'}</button><button type="button" disabled={submitting || !comment.trim()} onClick={() => void submit('request_changes')} className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-40">Solicitar alteração</button><p className="text-[10px] leading-4 text-slate-400">Para pedir alteração, descreva o que precisa mudar. A versão atual não é apagada por esta resposta.</p></div></>}
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 px-3 py-2.5"><span className="block text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-400">{label}</span><strong className="mt-0.5 block text-xs text-slate-700">{value}</strong></div> }
