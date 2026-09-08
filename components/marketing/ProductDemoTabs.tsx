'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { marketingSolutions } from '@/lib/marketing/main-site'

const visibleSlugs = ['graficas', 'restaurantes', 'lojas', 'assistencia-tecnica', 'barbearias', 'servicos']

const accentClasses = {
  blue: 'from-[#0b3b78] to-[#1776cf]',
  cyan: 'from-[#087ea4] to-[#27b7cf]',
  amber: 'from-[#b66b12] to-[#e6a633]',
  violet: 'from-[#5633a8] to-[#8b5cf6]',
  emerald: 'from-[#087a5b] to-[#17a77b]',
} as const

export default function ProductDemoTabs() {
  const solutions = useMemo(
    () => marketingSolutions.filter((solution) => visibleSlugs.includes(solution.slug)),
    [],
  )
  const [activeSlug, setActiveSlug] = useState('graficas')
  const active = solutions.find((solution) => solution.slug === activeSlug) || solutions[0]

  return (
    <div className="mt-12">
      <div className="mx-auto flex max-w-fit gap-1.5 overflow-x-auto rounded-[1.1rem] border border-slate-200/80 bg-white/85 p-1.5 shadow-[0_10px_30px_rgba(12,47,89,.06)] backdrop-blur-sm" role="tablist" aria-label="Demonstrações por segmento">
        {solutions.map((solution) => (
          <button
            key={solution.slug}
            type="button"
            role="tab"
            aria-selected={active.slug === solution.slug}
            onClick={() => setActiveSlug(solution.slug)}
            className={`shrink-0 rounded-[.8rem] border px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
              active.slug === solution.slug
                ? 'border-[#0b3b78] bg-[#0b3b78] text-white shadow-[0_8px_22px_rgba(11,59,120,.18)]'
                : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-[#0b3b78]'
            }`}
          >
            {solution.shortLabel}
          </button>
        ))}
      </div>

      <div className="relative mt-6 grid overflow-hidden rounded-[2.25rem] border border-slate-200/90 bg-white shadow-[0_32px_90px_rgba(12,47,89,.1)] lg:grid-cols-[.82fr_1.18fr]">
        <div className="relative z-10 p-6 sm:p-8 lg:p-10 xl:p-12">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">{active.eyebrow}</p>
          <h3 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.03] tracking-[-.048em] text-[#0b2347] sm:text-4xl xl:text-[2.85rem]">
            {active.headline}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">{active.description}</p>

          <div className="mt-7 flex flex-wrap gap-2">
            {active.features.map((feature) => (
              <span key={feature} className="rounded-full border border-blue-100/70 bg-[#f5f8fc] px-3 py-2 text-xs font-semibold text-[#405773]">
                {feature}
              </span>
            ))}
          </div>

          <Link
            href={`/solucoes/${active.slug}`}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-[.9rem] bg-[#0b3b78] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(11,59,120,.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#082f62] hover:shadow-[0_18px_40px_rgba(11,59,120,.22)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          >
            Ver solução para {active.shortLabel.toLowerCase()}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="relative min-h-[460px] overflow-hidden bg-[#061a36] p-4 sm:p-6 lg:p-8 xl:p-10">
          <div className={`pointer-events-none absolute inset-x-8 top-[-180px] h-80 rounded-full bg-gradient-to-r ${accentClasses[active.accent]} opacity-30 blur-3xl`} />
          <div className="pointer-events-none absolute bottom-[-140px] right-[-90px] h-72 w-72 rounded-full bg-blue-300/10 blur-3xl" />

          <div className="relative mx-auto max-w-2xl rounded-[1.7rem] border border-white/10 bg-[#0a2448]/95 p-3 shadow-[0_28px_70px_rgba(0,0,0,.28)] backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>
              <span className="rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-semibold text-white/60">painel.orcaly.com.br</span>
            </div>

            <div className="grid gap-3 pt-3 sm:grid-cols-[150px_1fr]">
              <aside className="hidden rounded-[1.1rem] border border-white/8 bg-white/[.045] p-3 sm:block">
                <div className="h-8 rounded-lg border border-white/8 bg-white/[.08]" />
                <div className="mt-4 space-y-2">
                  {['Hoje', 'Pedidos', 'Clientes', 'Financeiro', 'Mais'].map((item, index) => (
                    <div key={item} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${index === 1 ? 'bg-white text-[#0b3b78] shadow-sm' : 'text-white/55'}`}>
                      {item}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="rounded-[1.1rem] bg-[#f4f7fb] p-3 shadow-inner shadow-slate-200/40 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Hoje no Orçaly</p>
                    <p className="mt-1 text-lg font-semibold tracking-[-.03em] text-[#0b2347]">O que precisa da sua atenção</p>
                  </div>
                  <span className={`rounded-lg bg-gradient-to-r ${accentClasses[active.accent]} px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm`}>
                    {active.shortLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {active.workflow.slice(0, 3).map((step, index) => (
                    <div key={step} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_6px_16px_rgba(9,42,84,.04)]">
                      <span className="text-[10px] font-semibold text-slate-400">0{index + 1}</span>
                      <p className="mt-1 text-xs font-semibold text-[#0b2347]">{step}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_6px_16px_rgba(9,42,84,.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">Fluxo operacional</p>
                      <p className="mt-1 text-xs font-semibold text-[#0b2347]">Próxima ação claramente visível</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Atenção</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 overflow-hidden">
                    {active.workflow.map((step, index) => (
                      <div key={step} className="flex min-w-0 flex-1 items-center gap-1">
                        <span className={`h-2 flex-1 rounded-full ${index < 2 ? 'bg-[#1776cf]' : 'bg-slate-200'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative -mt-3 ml-auto max-w-md rounded-[1.45rem] border border-white/20 bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,.22)] sm:mr-5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Site da empresa</p>
                <p className="mt-1 text-sm font-semibold text-[#0b2347]">suaempresa.orcaly.com.br</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Público</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {active.publicExperience.slice(0, 4).map((item) => (
                <div key={item} className="rounded-lg border border-slate-100 bg-[#f4f7fb] px-3 py-2 text-[10px] font-semibold text-slate-600">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
