'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'

function publicCode(digest?: string) {
  const clean = String(digest || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
  return clean ? `ORC-${clean}` : 'ORC-CLIENT'
}

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const code = useMemo(() => publicCode(error.digest), [error.digest])

  useEffect(() => {
    console.error(JSON.stringify({ event: 'client_error_boundary', errorId: code, digest: error.digest || null }))
  }, [code, error.digest])

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f4f6f9] px-4 py-12 text-[#14243b]">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,.08)] sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-xl" aria-hidden>!</div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Falha inesperada</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-.04em] text-[#0b2e63]">Não conseguimos carregar esta área.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">A página encontrou um erro inesperado. Você pode tentar novamente sem precisar atualizar o navegador inteiro.</p>
        <code className="mt-4 inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600">{code}</code>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-[#0b2e63] px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Tentar novamente</button>
          <Link href="/painel" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Voltar ao painel</Link>
        </div>
      </section>
    </main>
  )
}
