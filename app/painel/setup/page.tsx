'use client'

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import { getCompanyPublicUrl } from '@/lib/company-url'

type Company = {
  id: string
  nome?: string | null
  slug?: string | null
  logo_url?: string | null
  whatsapp?: string | null
  site_publico_ativo?: boolean | null
  site_template?: string | null
  site_headline?: string | null
  site_banner_url?: string | null
  marketplace_endereco?: string | null
  assinatura_status?: string | null
  whatsapp_enabled?: boolean | null
}

type Step = {
  title: string
  description: string
  href: string
  done: boolean
  action: string
}

export default function SetupOrcalyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [productCount, setProductCount] = useState(0)
  const [couponCount, setCouponCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const token = await getAccessTokenClient()

      const companyResponse = await fetch('/api/company/current', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const companyPayload = await companyResponse.json().catch(() => ({}))

      if (!companyResponse.ok) throw new Error(companyPayload.error || 'Erro ao carregar empresa.')

      setCompany(companyPayload.company)

      const [productsResponse, couponsResponse] = await Promise.all([
        fetch('/api/products?limit=1', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch('/api/coupons', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ])

      if (productsResponse?.ok) {
        const payload = await productsResponse.json().catch(() => ({}))
        setProductCount(Number(payload.total || payload.count || payload.products?.length || 0))
      }

      if (couponsResponse?.ok) {
        const payload = await couponsResponse.json().catch(() => ({}))
        setCouponCount(Number(payload.coupons?.length || 0))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar checklist.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const steps = useMemo<Step[]>(() => {
    const data: Partial<Company> = company ?? {}

    return [
      {
        title: 'Configurar dados da empresa',
        description: 'Nome, WhatsApp, cidade, endereço e dados básicos de atendimento.',
        href: '/painel/configuracoes',
        done: Boolean(data.nome && data.whatsapp),
        action: 'Configurar empresa',
      },
      {
        title: 'Escolher template do site',
        description: 'Selecione o ramo da empresa e aplique uma página pré-pronta.',
        href: '/painel/site',
        done: Boolean(data.site_template && data.site_headline),
        action: 'Editar site',
      },
      {
        title: 'Enviar logo ou banner',
        description: 'Coloque identidade visual no site público.',
        href: '/painel/site',
        done: Boolean(data.logo_url || data.site_banner_url),
        action: 'Enviar imagens',
      },
      {
        title: 'Criar produtos ou serviços',
        description: 'Cadastre o que a empresa vende para ativar catálogo e pedidos.',
        href: '/painel/produtos',
        done: productCount > 0,
        action: 'Cadastrar produtos',
      },
      {
        title: 'Criar primeiro cupom',
        description: 'Opcional, mas ajuda a divulgar a primeira campanha.',
        href: '/painel/cupons',
        done: couponCount > 0,
        action: 'Criar cupom',
      },
      {
        title: 'Ativar WhatsApp',
        description: 'Configure notificações e automações de atendimento.',
        href: '/painel/whatsapp',
        done: Boolean(data.whatsapp_enabled),
        action: 'Configurar WhatsApp',
      },
      {
        title: 'Publicar e testar o site',
        description: 'Abra o site público, simule pedido e confira a experiência.',
        href: data.slug ? getCompanyPublicUrl(data.slug) : '/painel/site',
        done: Boolean(data.site_publico_ativo && data.slug),
        action: 'Abrir site',
      },
    ]
  }, [company, productCount, couponCount])

  const doneCount = steps.filter((step) => step.done).length
  const percent = Math.round((doneCount / steps.length) * 100)

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando setup...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Primeiros passos</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Checklist da empresa</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Siga essa lista para deixar a empresa pronta para vender, receber pedidos e parecer profissional. Sem isso, o sistema vira um carro com motor bom e volante no porta-malas.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#f5f8ff] p-5">
              <p className="text-sm font-black text-slate-500">Progresso</p>
              <p className="mt-1 text-4xl font-black text-[#05245c]">{percent}%</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#05245c]" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold text-slate-500">{doneCount} de {steps.length} etapas concluídas</p>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-4">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-black ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-[#05245c]'}`}>
                    {step.done ? '✓' : index + 1}
                  </span>
                  <div>
                    <h2 className="text-xl font-black tracking-[-0.03em]">{step.title}</h2>
                    <p className="mt-1 font-bold leading-6 text-slate-500">{step.description}</p>
                  </div>
                </div>

                <Link href={step.href} target={step.href.startsWith('http') ? '_blank' : undefined} className="rounded-2xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white">
                  {step.action}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
