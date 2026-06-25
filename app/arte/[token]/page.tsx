'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ArteAprovacaoPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [request, setRequest] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    const response = await fetch(`/api/arte/${token}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Erro ao carregar arte.')
      setLoading(false)
      return
    }

    setRequest(data.request)
    setLoading(false)
  }

  async function submit(action: 'approve' | 'request_changes') {
    setError('')
    setMessage('')

    const response = await fetch(`/api/arte/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment }),
    })

    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Erro ao responder.')
      return
    }

    setRequest(data.request)
    setMessage(action === 'approve' ? 'Arte aprovada com sucesso.' : 'Alteração solicitada com sucesso.')
  }

  useEffect(() => {
    if (token) load()
  }, [token])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando arte...</div>
      </main>
    )
  }

  if (error && !request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Arte não encontrada</h1>
          <p className="mt-3 font-bold text-red-600">{error}</p>
        </div>
      </main>
    )
  }

  const company = request?.companies

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-8 text-[#071b3a]">
      <section className="mx-auto max-w-5xl rounded-[2rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/10 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Aprovação de arte</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">
              {request?.title || request?.produto_nome || 'Prévia da arte'}
            </h1>
            <p className="mt-3 font-bold text-slate-500">{company?.nome || 'Empresa'} • Status: {request?.status}</p>
          </div>

          {company?.logo_url && <img src={company.logo_url} alt={company.nome} className="h-16 w-auto object-contain" />}
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="mt-7 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-[#f8fbff]">
          {request?.artwork_url || request?.preview_url ? (
            <img src={request.artwork_url || request.preview_url} alt="Prévia da arte" className="max-h-[720px] w-full object-contain" />
          ) : (
            <div className="grid min-h-[260px] place-items-center p-8 text-center">
              <p className="font-black text-slate-500">Nenhuma imagem de arte foi anexada.</p>
            </div>
          )}
        </div>

        {request?.instructions && (
          <div className="mt-5 rounded-[1.5rem] bg-blue-50 p-5">
            <p className="font-black text-[#05245c]">Observações da empresa</p>
            <p className="mt-2 font-bold leading-7 text-slate-600">{request.instructions}</p>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Comentário opcional. Ex.: aprovado, trocar cor, ajustar texto, aumentar logo..."
            rows={4}
            className="resize-none rounded-[1.5rem] border border-slate-200 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c]"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => submit('approve')}
              className="rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white"
            >
              Aprovar arte
            </button>
            <button
              type="button"
              onClick={() => submit('request_changes')}
              className="rounded-2xl bg-amber-500 px-6 py-4 font-black text-white"
            >
              Pedir alteração
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
