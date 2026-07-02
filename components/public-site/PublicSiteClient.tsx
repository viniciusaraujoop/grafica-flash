'use client'

import { useEffect, useState } from 'react'
import PublicSiteRenderer, { type PublicSiteCompany, type PublicSiteProduct } from './PublicSiteRenderer'

type PublicSiteClientProps = {
  slug: string
}

export default function PublicSiteClient({ slug }: PublicSiteClientProps) {
  const [company, setCompany] = useState<PublicSiteCompany | null>(null)
  const [products, setProducts] = useState<PublicSiteProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/public-site/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error || 'Site não encontrado.')
        }

        setCompany(payload.company)
        setProducts(Array.isArray(payload.products) ? payload.products : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar site.')
      }

      setLoading(false)
    }

    load()
  }, [slug])

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7faff] px-4 text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 text-center font-black shadow-xl shadow-blue-950/5">
          Carregando site...
        </div>
      </main>
    )
  }

  if (error || !company) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7faff] px-4 text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <h1 className="text-3xl font-black tracking-[-0.05em]">Site não encontrado</h1>
          <p className="mt-3 font-bold text-slate-500">{error || 'Confira o endereço informado.'}</p>
        </div>
      </main>
    )
  }

  return <PublicSiteRenderer company={company} products={products} />
}
