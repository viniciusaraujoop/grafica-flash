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
    <div className="mt-10 grid gap-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(13,45,86,.08)] sm:p-7 lg:grid-cols-[1fr_.72fr] lg:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#1776cf]">Qual plano combina com você?</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-[#0b2347] sm:text-3xl">Marque o que sua empresa precisa agora.</h3>
        <div className="mt-5 grid gap-3">
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
                className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
                  active ? 'border-[#1776cf] bg-blue-50 text-[#0b3b78]' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs ${active ? 'border-[#1776cf] bg-[#1776cf] text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <aside className="rounded-[1.4rem] bg-[#071b3a] p-5 text-white sm:p-6" aria-live="polite">
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200">Recomendação pelas respostas</p>
        <h4 className="mt-3 text-3xl font-semibold tracking-[-.045em]">{recommended.name}</h4>
        <p className="mt-2 text-sm leading-6 text-white/65">{recommended.audience}</p>
        <p className="mt-5 text-sm font-semibold text-white">{recommended.outcome}</p>
        <Link
          href={marketingPlanSignupHref(recommended.id)}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0b3b78] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200/30"
        >
          Criar conta com {recommended.name}
        </Link>
        <button
          type="button"
          onClick={() => setAnswers(initial)}
          className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Limpar respostas
        </button>
      </aside>
    </div>
  )
}
