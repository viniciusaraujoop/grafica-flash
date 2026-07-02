'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import {
  getModulesByGroupForSegment,
  getQuickActionsForSegment,
  getSegmentInfo,
  moduleGroupLabels,
  normalizeSegment,
  segmentInfos,
  type SegmentType,
} from '@/lib/segment-modules'

type Company = {
  id: string
  nome?: string | null
  business_type?: string | null
  site_template?: string | null
}

type CompanyPayload = {
  company?: Company | null
  error?: string
}

export default function SegmentoPage() {
  const [token, setToken] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [selected, setSelected] = useState<SegmentType>('services')
  const [applyTemplate, setApplyTemplate] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedInfo = useMemo(() => getSegmentInfo(selected), [selected])
  const groups = useMemo(() => getModulesByGroupForSegment(selected), [selected])
  const quickActions = useMemo(() => getQuickActionsForSegment(selected), [selected])
  const currentSegment = normalizeSegment(company?.business_type || company?.site_template)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/company/current', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({})) as CompanyPayload

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar empresa.')

      const loadedCompany = payload.company || null
      setCompany(loadedCompany)
      setSelected(normalizeSegment(loadedCompany?.business_type || loadedCompany?.site_template))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar segmento.')
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(segment: SegmentType) {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const accessToken = token || await getAccessTokenClient()
      const response = await fetch('/api/business-type/apply', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_type: segment,
          apply_template: applyTemplate,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao aplicar segmento.')

      setCompany(payload.company as Company)
      setSelected(segment)
      setMessage(payload.message || 'Segmento aplicado. Produtos, pedidos e clientes foram preservados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar segmento.')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8ff] px-4 text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 text-center font-black shadow-xl shadow-blue-950/5">
          Carregando módulos do segmento...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2.4rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/10">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:items-end sm:p-8">
            <div>
              <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Segmentos e módulos</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[1.03] tracking-[-0.06em] sm:text-6xl">
                Escolha como o Orçaly deve organizar sua empresa
              </h1>
              <p className="mt-4 max-w-3xl font-bold leading-8 text-slate-500">
                Cada segmento ativa menus, textos, módulos e fluxos pensados para o jeito que sua empresa vende e atende.
              </p>
            </div>

            <aside className="rounded-[1.7rem] bg-[#05245c] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Segmento atual</p>
              <p className="mt-2 text-2xl font-black">{getSegmentInfo(currentSegment).label}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-white/65">{company?.nome || 'Empresa Orçaly'}</p>

              <label className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={applyTemplate}
                  onChange={(event) => setApplyTemplate(event.target.checked)}
                  className="h-5 w-5"
                />
                Aplicar textos e modelo recomendado ao trocar segmento
              </label>
            </aside>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {segmentInfos.map((info) => {
            const active = selected === info.id
            const current = currentSegment === info.id

            return (
              <article
                key={info.id}
                className={`rounded-[2rem] border bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl ${
                  active ? 'border-[#05245c] ring-4 ring-blue-100' : 'border-blue-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">{info.shortLabel}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{info.label}</h2>
                  </div>

                  {current ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Atual</span> : null}
                </div>

                <p className="mt-3 text-sm font-bold leading-7 text-slate-500">{info.description}</p>

                <div className="mt-5 grid gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Módulos principais</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {info.principalModules.map((item) => (
                        <span key={item} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">{item}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Gestão</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {info.adminModules.map((item) => (
                        <span key={item} className="rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(info.id)
                      void save(info.id)
                    }}
                    disabled={saving}
                    className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {saving && active ? 'Aplicando...' : 'Aplicar este modelo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(info.id)}
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]"
                  >
                    Ver módulos
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Menu sugerido</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">{selectedInfo.label}</h2>
            <p className="mt-3 font-bold leading-7 text-slate-500">{selectedInfo.description}</p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {groups.map((group) => (
                <div key={group.group} className="rounded-[1.6rem] border border-blue-100 bg-[#f8fbff] p-5">
                  <h3 className="font-black text-[#071b3a]">{moduleGroupLabels[group.group]}</h3>
                  <div className="mt-3 grid gap-2">
                    {group.modules.map((module) => (
                      <Link
                        key={module.id}
                        href={module.href}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        {module.label}
                        {module.status === 'coming_soon' ? <span className="ml-2 text-[10px] text-amber-600">breve</span> : null}
                        {module.status === 'beta' ? <span className="ml-2 text-[10px] text-purple-600">beta</span> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Ações rápidas</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Botões corretos por segmento</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              Se a página existe, o botão aponta para ela. Se não existe, vai para um placeholder seguro.
            </p>

            <div className="mt-5 grid gap-2">
              {quickActions.slice(0, 9).map((action) => (
                <Link key={`${action.id}-${action.label}`} href={action.href} className="rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#05245c]">
                  {action.label}
                </Link>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  )
}
