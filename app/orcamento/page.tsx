'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCurrentCompanyClient } from '@/lib/current-company-client'

type Company = {
  slug?: string | null
  subdomain_slug?: string | null
}

export default function OrcamentoPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const payload = await getCurrentCompanyClient<Company>()
        if (!active) return
        const slug = String(payload.company?.subdomain_slug || payload.company?.slug || '').trim()
        if (!slug) {
          setError('Configure o endereço público da empresa para liberar o formulário.')
          return
        }
        router.replace(`/orcamento/${encodeURIComponent(slug)}`)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Não foi possível abrir o formulário público.')
      }
    })()

    return () => { active = false }
  }, [router])

  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10 text-center">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-[#0b2347]">Formulário ainda não disponível</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
            <Link href="/painel/site" className="mt-5 inline-flex rounded-xl bg-[#0b3b78] px-4 py-3 text-sm font-bold text-white">Configurar Minha Vitrine</Link>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-100 border-t-[#0b3b78]" />
            <p className="mt-4 text-sm font-semibold text-slate-500">Abrindo formulário público...</p>
          </>
        )}
      </div>
    </main>
  )
}
