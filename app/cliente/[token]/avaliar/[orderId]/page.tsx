'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type ReviewItem = {
  id: string
  productId: string | null
  name: string
  quantity: number
  review: { rating?: number; comment?: string | null } | null
}

type Payload = {
  schemaReady: boolean
  eligible: boolean
  order: { id: string; status?: string | null; label: string }
  items: ReviewItem[]
}

type ReviewDraft = { rating: number; comment: string }

export default function CustomerOrderReviewPage() {
  const params = useParams<{ token: string; orderId: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token
  const orderId = Array.isArray(params?.orderId) ? params.orderId[0] : params?.orderId
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({})

  async function load() {
    if (!token || !orderId) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/cliente/${encodeURIComponent(token)}/reviews?orderId=${encodeURIComponent(orderId)}`,
        { cache: 'no-store' },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a avaliação.')
      setData(payload)
      const next: Record<string, ReviewDraft> = {}
      for (const item of payload.items || []) {
        if (!item.productId) continue
        next[item.productId] = {
          rating: Number(item.review?.rating || 5),
          comment: String(item.review?.comment || ''),
        }
      }
      setDrafts(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a avaliação.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token, orderId])

  async function save(item: ReviewItem) {
    if (!item.productId || !token || !orderId) return
    const productId = item.productId
    const draft = drafts[productId] || { rating: 5, comment: '' }
    setBusy(productId)
    setError('')
    setMessage('')
    const response = await fetch(`/api/cliente/${encodeURIComponent(token)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, productId, rating: draft.rating, comment: draft.comment }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy('')
    if (!response.ok) {
      setError(payload.error || 'Não foi possível salvar a avaliação.')
      return
    }
    setMessage(`Avaliação de “${item.name}” salva.`)
    await load()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f7fb] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-40 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-3xl bg-white motion-reduce:animate-none" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-3 py-5 text-[#10233f] sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-[1.7rem] bg-[#0b3b78] p-5 text-white shadow-xl sm:p-7">
          <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-white/60">Avaliação verificada</span>
          <h1 className="mt-2 text-3xl font-black tracking-[-.045em]">Como foi seu pedido?</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">A nota só pode ser enviada por este link individual e depois que o pedido estiver concluído ou entregue.</p>
        </header>

        {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        {message ? <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}
        {data?.schemaReady === false ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">Avaliações ainda não estão habilitadas neste ambiente. Nenhuma nota será simulada até a migration do Storefront 2.0 estar aplicada.</div> : null}
        {data && !data.eligible ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600">Este pedido está como <strong>{data.order.status || 'em andamento'}</strong>. A avaliação será liberada quando ele estiver concluído ou entregue.</div> : null}

        {data?.eligible && data.schemaReady ? (
          <section className="grid gap-3">
            {data.items.map((item) => {
              const productId = item.productId
              if (!productId) {
                return (
                  <article key={item.id} className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
                    {item.name} não possui produto vinculado e não pode receber nota pública individual.
                  </article>
                )
              }

              const draft = drafts[productId] || { rating: 5, comment: '' }
              return (
                <article key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(10,40,82,.04)] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{item.name}</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-400">Quantidade: {item.quantity}</p>
                    </div>
                    {item.review ? <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Avaliado</span> : null}
                  </div>

                  <div className="mt-4">
                    <span className="text-xs font-bold text-slate-500">Sua nota</span>
                    <div className="mt-2 flex gap-1" role="radiogroup" aria-label={`Nota para ${item.name}`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          role="radio"
                          aria-checked={draft.rating === star}
                          onClick={() => setDrafts((current) => ({
                            ...current,
                            [productId]: { rating: star, comment: current[productId]?.comment || '' },
                          }))}
                          className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${star <= draft.rating ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-300'}`}
                          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="mt-4 grid gap-2 text-xs font-bold text-slate-500">
                    Comentário opcional
                    <textarea
                      maxLength={1200}
                      rows={4}
                      value={draft.comment}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [productId]: { rating: current[productId]?.rating || 5, comment: event.target.value },
                      }))}
                      className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-[#0b3b78] focus:bg-white focus:ring-4 focus:ring-blue-50"
                      placeholder="Conte como foi sua experiência com este item."
                    />
                  </label>

                  <button
                    type="button"
                    disabled={busy === productId}
                    onClick={() => void save(item)}
                    className="mt-4 rounded-xl bg-[#0b3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy === productId ? 'Salvando…' : item.review ? 'Atualizar avaliação' : 'Enviar avaliação'}
                  </button>
                </article>
              )
            })}
          </section>
        ) : null}

        <Link href={`/cliente/${encodeURIComponent(token || '')}`} className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">← Voltar ao portal</Link>
      </div>
    </main>
  )
}
