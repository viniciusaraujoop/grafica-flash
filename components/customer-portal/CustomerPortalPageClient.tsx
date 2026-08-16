'use client'

import { useEffect, useState } from 'react'
import type { CustomerPortalOrder } from '@/lib/customer-portal/contracts'
import { PortalOrderView } from './PortalOrderView'

type PortalResponse = {
  order?: CustomerPortalOrder
  error?: string
}

function PortalFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 py-8 text-slate-950">
      {children}
    </main>
  )
}

export function CustomerPortalPageClient() {
  const [token, setToken] = useState<string | null>(null)
  const [order, setOrder] = useState<CustomerPortalOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    function readTokenFromFragment() {
      setOrder(null)
      setError('')
      setLoading(true)
      setToken(window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : '')
    }

    readTokenFromFragment()
    window.addEventListener('hashchange', readTokenFromFragment)
    return () => window.removeEventListener('hashchange', readTokenFromFragment)
  }, [])

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()

    async function resolvePortal() {
      try {
        const response = await fetch('/api/customer-portal/resolve', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => ({}))) as PortalResponse

        if (!response.ok || !payload.order) {
          throw new Error(
            payload.error || 'Não foi possível acessar este acompanhamento.',
          )
        }

        setOrder(payload.order)
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível acessar este acompanhamento.',
        )
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void resolvePortal()
    return () => controller.abort()
  }, [token])

  const resolvedError = token === ''
    ? 'Não foi possível acessar este acompanhamento.'
    : error

  if (resolvedError) {
    return (
      <PortalFrame>
        <section
          role="alert"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-2xl text-amber-800">
            !
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">
            Acompanhamento indisponível
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            {resolvedError}
          </p>
          <p className="mt-4 text-xs font-semibold text-slate-400">
            Entre em contato com a empresa que enviou o link.
          </p>
        </section>
      </PortalFrame>
    )
  }

  if (loading) {
    return (
      <PortalFrame>
        <section
          aria-live="polite"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5"
        >
          <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
          <h1 className="mt-5 text-xl font-black">Carregando acompanhamento</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Estamos buscando as informações mais recentes.
          </p>
        </section>
      </PortalFrame>
    )
  }

  if (!order) {
    return (
      <PortalFrame>
        <section
          role="alert"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-950/5"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-2xl text-amber-800">
            !
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">
            Acompanhamento indisponível
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            Não foi possível acessar este acompanhamento.
          </p>
          <p className="mt-4 text-xs font-semibold text-slate-400">
            Entre em contato com a empresa que enviou o link.
          </p>
        </section>
      </PortalFrame>
    )
  }

  return <PortalOrderView portal={order} />
}
