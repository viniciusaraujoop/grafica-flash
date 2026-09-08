'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { marketingPlans, marketingPlanSignupHref } from '@/lib/marketing/main-site'

type Answers = {
  needProposals: boolean
  needAutomation: boolean
  needAdvanced: boolean
}

const initial: Answers = {
  needProposals: false,
  needAutomation: false,
  needAdvanced: false,
}

export default function PlanSelector() {
  const [answers, setAnswers] = useState(initial)

  const recommended = useMemo(() => {
    if (answers.needAutomation || answers.needAdvanced) return marketingPlans[2]
    if (answers.needProposals) return marketingPlans[1]
    return marketingPlans[0]
  }, [answers])

  function toggle(key: keyof Answers) {
    setAnswers((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className="mt-12 grid overflow-hidden rounded-[2.1rem] border border-slate-200/90 bg-white shadow-[0_28px_80px_rgba(13,45,86,.08)] lg:grid-cols-[1.08fr_.72fr]">
      <div className="p-5 sm:p-7 lg:p-9">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">Qual plano combina com você?</p>
        <h3 className="mt-2 max-w-xl text-2xl font-semibold tracking-[-.04em] text-[#0b2347] sm:text-3xl">Marque o que sua empresa precisa agora.</h3>
        <div className="mt-6 grid gap-3">
          {[
            ['needProposals', 'Quero propostas, follow-up e mais controle comercial.'],
            ['needAutomation', 'Quero automações para reduzir tarefas repetitivas.'],
            ['needAdvanced', 'Quero recursos avançados para uma operação em crescimento.'],
          ].map(([key, label]) => {
            const typedKey = key as keyof Answers
            const active = answers[typedKey]
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(typedKey)}
                className={`group flex min-h-16 items-center gap-3 rounded-[1rem] border p-3.5 text-left text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
                  active
                    ? 'border-[#1776cf] bg-[#f4f8ff] text-[#0b3b78] shadow-[0_10px_24px_rgba(23,118,207,.08)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-[#fbfdff] hover:shadow-[0_10px_24px_rgba(13,45,86,.05)]'
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs transition duration-200 ${active ? 'border-[#1776cf] bg-[#1776cf] text-white shadow-sm' : 'border-slate-300 bg-slate-50 text-transparent group-hover:border-blue-200'}`}>✓</span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="relative overflow-hidden bg-[#061a36] p-6 text-white sm:p-8 lg:p-9" aria-live="polite">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200">Recomendação pelas respostas</p>
          <h4 className="mt-3 text-4xl font-semibold tracking-[-.05em]">{recommended.name}</h4>
          <p className="mt-3 text-sm leading-6 text-white/65">{recommended.audience}</p>
          <div className="mt-6 rounded-[1rem] border border-white/10 bg-white/[.055] p-4 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">{recommended.outcome}</p>
          </div>
          <Link
            href={marketingPlanSignupHref(recommended.id)}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[.9rem] bg-white px-4 py-3 text-sm font-semibold text-[#0b3b78] shadow-[0_12px_28px_rgba(0,0,0,.15)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,.2)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/30"
          >
            Criar conta com {recommended.name}
          </Link>
          <button
            type="button"
            onClick={() => setAnswers(initial)}
            className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/[.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Limpar respostas
          </button>
        </div>
      </aside>
    </div>
  )
}
