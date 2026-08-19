'use client'

import { useEffect, useState } from 'react'
import PublicSiteRenderer, { type PublicSiteCompany, type PublicSiteProduct } from './PublicSiteRenderer'
import StorefrontExperienceV2 from './StorefrontExperienceV2'

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

        setCompany({
          ...(payload.company || {}),
          delivery_zones: Array.isArray(payload.delivery_zones) ? payload.delivery_zones : [],
          payment_methods: Array.isArray(payload.payment_methods) ? payload.payment_methods : [],
          business_hours: Array.isArray(payload.business_hours) ? payload.business_hours : [],
        })
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
      <main className="min-h-screen bg-[#f7faff] px-4 py-8 text-[#071b3a]">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
          <div className="h-[420px] animate-pulse rounded-[2rem] bg-slate-100 motion-reduce:animate-none" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />)}</div>
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

  return <StorefrontExperienceV2 company={company} products={products}><PublicSiteRenderer company={company} products={products} /></StorefrontExperienceV2>
}
