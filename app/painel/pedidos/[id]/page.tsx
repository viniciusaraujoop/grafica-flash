'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getAccessTokenClient } from '@/lib/current-company-client'

const statusFlow = ['Recebido', 'Em análise', 'Aprovado', 'Em produção', 'Pronto', 'Entregue']

const statusOptions = [
  'Recebido',
  'Pendente',
  'Em análise',
  'Aguardando aprovação',
  'Aprovado',
  'Em produção',
  'Pronto',
  'Entregue',
  'Cancelado',
]

function moeda(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function inputDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(phone?: string | null, text?: string) {
  const clean = phoneOnly(phone)
  if (!clean) return '#'
  const finalPhone = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text || 'Olá! Vim falar sobre meu pedido.')}`
}

function statusColor(status?: string | null) {
  const value = String(status || '').toLowerCase()

  if (value.includes('entregue') || value.includes('pronto') || value.includes('aprovado')) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (value.includes('cancel')) return 'bg-red-50 text-red-700 border-red-100'
  if (value.includes('produção') || value.includes('producao')) return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-blue-50 text-[#05245c] border-blue-100'
}

export default function PedidoDetalheProPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [token, setToken] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const total = useMemo(() => Number(order?.valor_total || order?.preco_estimado || 0), [order])
  const currentIndex = Math.max(0, statusFlow.indexOf(order?.status || 'Recebido'))

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const [orderResponse, timelineResponse, commentsResponse] = await Promise.all([
        fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/orders/${id}/timeline`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/orders/${id}/comments`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])

      const orderPayload = await orderResponse.json().catch(() => ({}))
      const timelinePayload = await timelineResponse.json().catch(() => ({}))
      const commentsPayload = await commentsResponse.json().catch(() => ({}))

      if (!orderResponse.ok) throw new Error(orderPayload.error || 'Erro ao carregar pedido.')

      setOrder(orderPayload.order)
      setTimeline(timelinePayload.timeline || [])
      setComments(commentsPayload.comments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedido.')
    }

    setLoading(false)
  }

  useEffect(() => {
    if (id) load()
  }, [id])

  function update(field: string, value: any) {
    setOrder((current: any) => ({ ...(current || {}), [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: order.status,
          prioridade: order.prioridade,
          prazo_entrega: order.prazo_entrega || null,
          responsavel_nome: order.responsavel_nome,
          canal_origem: order.canal_origem,
          endereco_entrega: order.endereco_entrega,
          forma_pagamento: order.forma_pagamento,
          observacoes_internas: order.observacoes_internas,
          preco_estimado: order.preco_estimado,
          valor_total: order.valor_total,
          observacoes: order.observacoes,
          note,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar pedido.')

      setOrder(payload.order)
      setNote('')
      setMessage('Pedido atualizado.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pedido.')
    }

    setSaving(false)
  }

  async function addComment(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/orders/${id}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comentario: comment }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao comentar.')

      setComment('')
      setMessage('Comentário interno adicionado.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao comentar.')
    }
  }

  async function createTask() {
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/orders/${id}/create-task`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao criar tarefa.')

      setMessage('Tarefa criada a partir do pedido.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa.')
    }
  }

  async function createProposal() {
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/orders/${id}/create-proposal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao criar proposta.')

      setMessage('Proposta criada a partir do pedido.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar proposta.')
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black text-[#071b3a] shadow-xl">
          Carregando Pedido Pro...
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black text-[#071b3a] shadow-xl">
          Pedido não encontrado.
        </div>
      </main>
    )
  }

  const fileUrl = order.arquivo_url || order.file_url

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel/pedidos" className="text-sm font-black text-[#05245c]">← Voltar aos pedidos</Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusColor(order.status)}`}>
                  {order.status || 'Recebido'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  {order.prioridade || 'normal'}
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
                {order.nome || 'Cliente sem nome'}
              </h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                {order.produto || 'Pedido sem produto informado'}
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#05245c] p-5 text-white">
              <p className="text-sm font-black text-white/60">Valor estimado</p>
              <p className="mt-2 text-4xl font-black">{moeda(total)}</p>
              <p className="mt-2 text-sm font-bold text-white/70">{formatDate(order.created_at)}</p>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Fluxo do pedido</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Recebido → Em análise → Aprovado → Em produção → Pronto → Entregue</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-6">
            {statusFlow.map((status, index) => {
              const reached = index <= currentIndex && order.status !== 'Cancelado'
              const current = status === order.status

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => update('status', status)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    reached ? 'border-[#05245c] bg-blue-50' : 'border-slate-100 bg-[#f5f8ff]'
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-2xl text-sm font-black ${reached ? 'bg-[#05245c] text-white' : 'bg-white text-slate-400'}`}>
                    {reached ? '✓' : index + 1}
                  </span>
                  <p className="mt-3 text-sm font-black">{status}</p>
                  {current ? <p className="mt-1 text-xs font-black text-[#05245c]">Status atual</p> : null}
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="space-y-6">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">Operação do pedido</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Status</span>
                  <select value={order.status || 'Recebido'} onChange={(event) => update('status', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none">
                    {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Responsável</span>
                  <input value={order.responsavel_nome || ''} onChange={(event) => update('responsavel_nome', event.target.value)} placeholder="Nome do responsável" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Prioridade</span>
                  <select value={order.prioridade || 'normal'} onChange={(event) => update('prioridade', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none">
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Prazo de entrega</span>
                  <input type="datetime-local" value={inputDate(order.prazo_entrega)} onChange={(event) => update('prazo_entrega', event.target.value || null)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Forma de pagamento</span>
                  <input value={order.forma_pagamento || ''} onChange={(event) => update('forma_pagamento', event.target.value)} placeholder="Pix, cartão, dinheiro..." className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Valor total</span>
                  <input type="number" value={order.valor_total || order.preco_estimado || 0} onChange={(event) => update('valor_total', Number(event.target.value || 0))} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                </label>
              </div>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-black">Endereço de entrega</span>
                <input value={order.endereco_entrega || ''} onChange={(event) => update('endereco_entrega', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-black">Observações do cliente</span>
                <textarea value={order.observacoes || ''} onChange={(event) => update('observacoes', event.target.value)} rows={4} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-black">Observações internas</span>
                <textarea value={order.observacoes_internas || ''} onChange={(event) => update('observacoes_internas', event.target.value)} rows={4} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-black">Nota para histórico de status</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: cliente aprovou por WhatsApp" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={save} disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Salvando...' : 'Salvar pedido'}
                </button>
                <button onClick={createTask} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]">Transformar em tarefa</button>
                <button onClick={createProposal} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]">Criar proposta</button>
                <a href={whatsappLink(order.telefone, `Olá, ${order.nome || ''}! Vim falar sobre seu pedido: ${order.produto || ''}.`)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]">Enviar WhatsApp</a>
                {fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]">Abrir arquivo</a> : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">Comentário interno</h2>

              <form onSubmit={addComment} className="mt-5 grid gap-3">
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Adicionar comentário interno..." rows={3} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                <button className="w-fit rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white">Comentar</button>
              </form>

              <div className="mt-5 grid gap-3">
                {comments.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="font-bold leading-7">{item.comentario}</p>
                    <p className="mt-2 text-xs font-black text-slate-400">{item.user_email || 'Equipe'} • {formatDate(item.created_at)}</p>
                  </article>
                ))}

                {comments.length === 0 ? <p className="font-bold text-slate-400">Nenhum comentário interno ainda.</p> : null}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">Cliente</h2>
              <div className="mt-5 grid gap-3 text-sm font-bold text-slate-500">
                <p><span className="text-slate-400">Nome:</span> {order.nome || '-'}</p>
                <p><span className="text-slate-400">Telefone:</span> {order.telefone || '-'}</p>
                <p><span className="text-slate-400">Quantidade:</span> {order.quantidade || 1}</p>
                <p><span className="text-slate-400">Medida:</span> {order.largura || '-'} x {order.altura || '-'}</p>
                <p><span className="text-slate-400">Responsável:</span> {order.responsavel_nome || 'não definido'}</p>
                <p><span className="text-slate-400">Prazo:</span> {formatDate(order.prazo_entrega)}</p>
                {order.cupom_codigo ? <p><span className="text-slate-400">Cupom:</span> {order.cupom_codigo}</p> : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">Histórico de status</h2>
              <div className="mt-5 grid gap-3">
                {timeline.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-blue-100 bg-[#f5f8ff] p-4">
                    <p className="font-black">{item.old_status || 'Início'} → {item.new_status}</p>
                    {item.note ? <p className="mt-1 text-sm font-bold text-slate-500">{item.note}</p> : null}
                    <p className="mt-2 text-xs font-black text-slate-400">
                      {item.changed_by_email || 'Equipe'} • {formatDate(item.created_at)}
                    </p>
                  </article>
                ))}

                {timeline.length === 0 ? <p className="font-bold text-slate-400">Nenhuma mudança registrada ainda.</p> : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
