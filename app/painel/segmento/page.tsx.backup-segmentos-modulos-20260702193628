'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { businessTypes, getBusinessTypeConfig, getMenuByBusinessType, type BusinessType } from '@/lib/business-types'
import { getAccessTokenClient } from '@/lib/current-company-client'

export default function SegmentoPage() {
  const [token, setToken] = useState('')
  const [company, setCompany] = useState<any>(null)
  const [selected, setSelected] = useState<BusinessType>('services')
  const [applyTemplate, setApplyTemplate] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedConfig = useMemo(() => getBusinessTypeConfig(selected), [selected])
  const menu = useMemo(() => getMenuByBusinessType(selected), [selected])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/company/current', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar empresa.')

      setCompany(payload.company)
      setSelected(getBusinessTypeConfig(payload.company?.business_type || payload.company?.site_template).id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar segmento.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/business-type/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_type: selected,
          apply_template: applyTemplate,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar segmento.')

      setCompany(payload.company)
      setMessage(payload.message || 'Segmento salvo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar segmento.')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black text-[#071b3a] shadow-xl">Carregando segmentos...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Plataforma modular</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] sm:text-5xl">Tipo de negócio</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Esse tipo de negócio muda textos, sugestões, status, menus e recursos exibidos no site e no painel.
                Você pode alterar tudo depois sem apagar produtos, pedidos ou clientes.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#05245c] p-5 text-white">
              <p className="text-sm font-black text-white/60">Atual</p>
              <h2 className="mt-2 text-2xl font-black">{getBusinessTypeConfig(company?.business_type).label}</h2>
              <p className="mt-2 text-sm font-bold text-white/70">{company?.nome || 'Empresa Orçaly'}</p>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businessTypes.map((type) => {
            const active = selected === type.id

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type.id)}
                className={`rounded-[1.7rem] border p-5 text-left shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 ${
                  active ? 'border-[#05245c] bg-white' : 'border-blue-100 bg-white/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">{type.publicName}</p>
                    <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">{type.label}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${active ? 'bg-[#05245c] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {active ? 'Selecionado' : 'Escolher'}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{type.siteSubtitle}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {type.features.slice(0, 5).map((feature) => (
                    <span key={feature} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">
                      {feature.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Prévia do segmento</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="text-sm font-black text-slate-400">Nome público</p>
                <p className="mt-1 text-xl font-black">{selectedConfig.publicName}</p>
              </div>
              <div className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="text-sm font-black text-slate-400">CTA</p>
                <p className="mt-1 text-xl font-black">{selectedConfig.cta}</p>
              </div>
              <div className="rounded-2xl bg-[#f5f8ff] p-4 md:col-span-2">
                <p className="text-sm font-black text-slate-400">Título sugerido do site</p>
                <p className="mt-1 text-xl font-black">{selectedConfig.siteTitle}</p>
                <p className="mt-2 font-bold leading-7 text-slate-500">{selectedConfig.siteSubtitle}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="font-black">Status recomendados</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedConfig.statuses.map((status) => (
                  <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{status}</span>
                ))}
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 font-bold text-[#05245c]">
              <input
                type="checkbox"
                checked={applyTemplate}
                onChange={(event) => setApplyTemplate(event.target.checked)}
                className="mt-1"
              />
              <span>
                Aplicar modelo recomendado para este segmento.
                <small className="mt-1 block font-bold text-slate-500">
                  Isso preenche headline, subtítulo, benefícios, FAQ e textos do site. Não apaga produtos, pedidos nem clientes.
                </small>
              </span>
            </label>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="mt-6 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar tipo de negócio'}
            </button>
          </div>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Menu sugerido</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              Páginas existentes abrem normalmente. Módulos ainda em preparação usam uma página explicativa, sem link quebrado.
            </p>

            <div className="mt-5 grid gap-3">
              {menu.map((item) => (
                <Link key={item.href + item.title} href={item.href} className="rounded-2xl border border-slate-100 bg-[#f5f8ff] p-4 transition hover:bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{item.title}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{item.description}</p>
                    </div>
                    {item.prepared ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">Preparação</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
