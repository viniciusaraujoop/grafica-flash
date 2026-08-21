'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type {
  AssistantAction,
  AssistantCard,
  AssistantPageContext,
  AssistantResult,
} from '@/lib/assistant/types'

type ChatRole = 'assistant' | 'user'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  suggestions?: string[]
  action?: AssistantAction | null
  cards?: AssistantCard[]
  requestId?: string
  recommendedPlan?: string | null
  segment?: string | null
  feedback?: 'up' | 'down' | null
}

const STORAGE_KEY = 'orcaly:assistant:v2:messages'
const SESSION_KEY = 'orcaly:assistant:v2:session'
const REF_STORAGE_KEY = 'orcaly_affiliate_referral_v1'
const MAX_STORED_MESSAGES = 16

const STARTER_ACTIONS = [
  'Ver para meu negócio',
  'Comparar planos',
  'Ver como funciona',
  'Quanto custa?',
  'Ver demonstração',
]

const INITIAL_MESSAGE: ChatMessage = {
  id: 'orcaly-assistant-welcome-v2',
  role: 'assistant',
  content:
    'Oi! Eu sou o Assistente Orçaly 👋 Posso te mostrar como o Orçaly funcionaria no seu negócio, comparar planos ou responder suas dúvidas sobre a plataforma.',
  suggestions: STARTER_ACTIONS,
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanSuggestions(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean)),
  ).slice(0, 5)
}

function validCard(value: unknown): value is AssistantCard {
  if (!value || typeof value !== 'object') return false
  const type = String((value as Record<string, unknown>).type || '')
  return ['plan', 'comparison', 'flow', 'feature', 'lead_capture', 'handoff', 'demo'].includes(type)
}

function restoreMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [INITIAL_MESSAGE]
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return [INITIAL_MESSAGE]

    const restored = parsed.slice(-MAX_STORED_MESSAGES).flatMap((item): ChatMessage[] => {
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      const content = String(record.content || '').trim().slice(0, 2000)
      if (!content) return []

      return [{
        id: String(record.id || id('restored')),
        role: record.role === 'user' ? 'user' : 'assistant',
        content,
        suggestions: cleanSuggestions(record.suggestions),
        action: record.action && typeof record.action === 'object'
          ? record.action as AssistantAction
          : null,
        cards: Array.isArray(record.cards) ? record.cards.filter(validCard).slice(0, 5) : [],
        requestId: String(record.requestId || '') || undefined,
        recommendedPlan: String(record.recommendedPlan || '') || null,
        segment: String(record.segment || '') || null,
        feedback: null,
      }]
    })

    return restored.length ? restored : [INITIAL_MESSAGE]
  } catch {
    return [INITIAL_MESSAGE]
  }
}

function getSessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : id('session')
    window.sessionStorage.setItem(SESSION_KEY, value)
    return value
  } catch {
    return id('session')
  }
}

function readReferral() {
  const params = new URLSearchParams(window.location.search)
  const queryRef = String(params.get('ref') || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32)
  if (queryRef) return queryRef

  try {
    const raw = window.localStorage.getItem(REF_STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) as { code?: string; expiresAt?: number } : null
    if (saved?.code && Number(saved.expiresAt || 0) > Date.now()) {
      return String(saved.code).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
    }
  } catch {
    // Referral segue pela query quando storage não está disponível.
  }
  return ''
}

function pageContext(): AssistantPageContext {
  const params = new URLSearchParams(window.location.search)
  const get = (key: string, max = 100) => String(params.get(key) || '').trim().slice(0, max) || undefined

  return {
    pathname: window.location.pathname,
    ref: readReferral() || undefined,
    pc: get('pc', 40),
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
  }
}

function withAttribution(rawHref: string, context: AssistantPageContext) {
  if (!rawHref.startsWith('/cadastro')) return rawHref

  const url = new URL(rawHref, window.location.origin)
  if (context.ref && !url.searchParams.has('ref')) url.searchParams.set('ref', context.ref)
  for (const key of ['pc', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
    const value = context[key]
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  return `${url.pathname}${url.search}`
}

function safeHref(rawHref: string, context: AssistantPageContext) {
  const href = withAttribution(String(rawHref || '').trim(), context)
  if (href.startsWith('/')) return href
  if (href === 'mailto:orcalybr@gmail.com') return href
  if (/^https:\/\/wa\.me\/\d{10,15}(\?|$)/.test(href)) return href
  return null
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function AssistantAvatar() {
  return (
    <div aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#0b3b78] text-base font-black text-white shadow-lg shadow-blue-950/15">
      O
    </div>
  )
}

function ActionLink({ action, context, onNavigate }: {
  action: AssistantAction
  context: AssistantPageContext
  onNavigate: (href: string) => void
}) {
  const href = safeHref(action.href, context)
  if (!href) return null
  const className = action.kind === 'secondary'
    ? 'inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-black text-[#0b3b78] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0b3b78] px-4 py-2 text-xs font-black text-white transition hover:bg-[#082f62] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

  if (href.startsWith('/')) {
    return <Link href={href} onClick={() => onNavigate(href)} className={className}>{action.label}</Link>
  }

  return <a href={href} onClick={() => onNavigate(href)} className={className}>{action.label}</a>
}

function LeadCaptureForm({ card, context, sessionId, messages }: {
  card: Extract<AssistantCard, { type: 'lead_capture' }>
  context: AssistantPageContext
  sessionId: string
  messages: ChatMessage[]
}) {
  const [form, setForm] = useState({ nome: '', whatsapp: '', empresa: '', email: '', consent: false })
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setStatus('')

    try {
      const summary = messages
        .slice(-4)
        .map((message) => `${message.role === 'user' ? 'Visitante' : 'Assistente'}: ${message.content}`)
        .join(' | ')
        .slice(0, 500)

      const response = await fetch('/api/public/home-chat/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sessionId,
          segment: card.segment,
          recommendedPlan: card.recommendedPlan,
          summary,
          interest: 'Contato após recomendação do Assistente Orçaly',
          pagePath: context.pathname,
          ref: context.ref,
          pc: context.pc,
          utm_source: context.utm_source,
          utm_medium: context.utm_medium,
          utm_campaign: context.utm_campaign,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o contato.')
      setStatus(payload.message || 'Contato registrado.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível salvar o contato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
      <div>
        <p className="text-sm font-black text-[#0b2347]">{card.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-[11px] font-bold text-slate-600 sm:col-span-1">
          Nome
          <input required value={form.nome} onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="col-span-2 text-[11px] font-bold text-slate-600 sm:col-span-1">
          WhatsApp
          <input required inputMode="tel" value={form.whatsapp} onChange={(e) => setForm((v) => ({ ...v, whatsapp: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="col-span-2 text-[11px] font-bold text-slate-600 sm:col-span-1">
          Empresa
          <input required value={form.empresa} onChange={(e) => setForm((v) => ({ ...v, empresa: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="col-span-2 text-[11px] font-bold text-slate-600 sm:col-span-1">
          E-mail <span className="font-medium text-slate-400">(opcional)</span>
          <input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-4 text-slate-600">
        <input type="checkbox" checked={form.consent} onChange={(e) => setForm((v) => ({ ...v, consent: e.target.checked }))} className="mt-0.5 h-4 w-4" />
        Autorizo o Orçaly a usar estes dados para contato comercial sobre minha recomendação e cadastro.
      </label>
      <button disabled={!form.consent || saving} className="min-h-10 w-full rounded-xl bg-[#0b3b78] px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? 'Salvando...' : 'Preparar meu contato'}
      </button>
      {status ? <p role="status" className="text-xs font-semibold leading-5 text-slate-700">{status}</p> : null}
    </form>
  )
}

function CardRenderer({ card, context, onNavigate, sessionId, messages }: {
  card: AssistantCard
  context: AssistantPageContext
  onNavigate: (href: string) => void
  sessionId: string
  messages: ChatMessage[]
}) {
  if (card.type === 'plan') {
    return (
      <div className={`rounded-2xl border p-3 ${card.featured ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-black text-[#0b2347]">{card.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{card.audience}</p></div>
          <p className="whitespace-nowrap text-sm font-black text-[#0b3b78]">{money(card.price)}<span className="text-[10px] font-bold text-slate-400">/mês</span></p>
        </div>
        <ul className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">
          {card.highlights.map((item) => <li key={item}>✓ {item}</li>)}
        </ul>
        <div className="mt-3"><ActionLink action={card.action} context={context} onNavigate={onNavigate} /></div>
      </div>
    )
  }

  if (card.type === 'comparison') {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <p className="border-b border-slate-100 px-3 py-2 text-xs font-black text-[#0b2347]">{card.title}</p>
        <div className="divide-y divide-slate-100">
          {card.plans.map((plan) => (
            <div key={plan.id} className="grid grid-cols-[1fr_auto] gap-2 p-3">
              <div><p className="text-xs font-black text-[#0b2347]">{plan.name}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{plan.highlights.slice(0, 3).join(' • ')}</p></div>
              <p className="text-xs font-black text-[#0b3b78]">{money(plan.price)}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (card.type === 'flow') {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white p-3">
        <p className="text-sm font-black text-[#0b2347]">{card.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {card.steps.map((step, index) => (
            <div key={step} className="flex items-center gap-1.5">
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-[#0b3b78]">{step}</span>
              {index < card.steps.length - 1 ? <span className="text-xs text-blue-300">→</span> : null}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">{card.features.slice(0, 5).join(' • ')}</p>
        <div className="mt-3"><ActionLink action={{ label: 'Ver solução', href: card.demoHref }} context={context} onNavigate={onNavigate} /></div>
      </div>
    )
  }

  if (card.type === 'feature') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-black text-[#0b2347]">{card.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{card.benefit}</p>
        <p className="mt-2 text-[11px] font-semibold text-slate-500">{card.bullets.join(' • ')}</p>
      </div>
    )
  }

  if (card.type === 'demo') {
    return (
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-3">
        <p className="text-sm font-black text-[#0b2347]">{card.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
        <div className="mt-3"><ActionLink action={{ label: 'Abrir demonstração', href: card.href, kind: 'primary' }} context={context} onNavigate={onNavigate} /></div>
      </div>
    )
  }

  if (card.type === 'handoff') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
        <p className="text-sm font-black text-[#0b2347]">{card.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {card.whatsappHref ? <ActionLink action={{ label: 'Continuar pelo WhatsApp', href: card.whatsappHref, kind: 'primary' }} context={context} onNavigate={onNavigate} /> : null}
          <ActionLink action={{ label: 'Usar e-mail', href: card.emailHref, kind: 'secondary' }} context={context} onNavigate={onNavigate} />
        </div>
      </div>
    )
  }

  if (card.type === 'lead_capture') {
    return <LeadCaptureForm card={card} context={context} sessionId={sessionId} messages={messages} />
  }

  return null
}

export default function HomeAiChatV2() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [hydrated, setHydrated] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [status, setStatus] = useState('IA • especialista no Orçaly')
  const [sessionId, setSessionId] = useState('')
  const [context, setContext] = useState<AssistantPageContext>({ pathname: '/' })

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const canSend = input.trim().length >= 2 && !sending
  const latestSuggestions = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.role === 'assistant')
    return latest?.suggestions?.length ? latest.suggestions : STARTER_ACTIONS.slice(0, 3)
  }, [messages])

  useEffect(() => {
    setMessages(restoreMessages())
    setSessionId(getSessionId())
    setContext(pageContext())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      const stored = messages.slice(-MAX_STORED_MESSAGES).map(({ feedback: _feedback, ...message }) => message)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      // Memória temporária é opcional; o chat continua sem storage.
    }
  }, [hydrated, messages])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, sending, streamingText])

  useEffect(() => {
    if (!open) return
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])

  async function event(name: string, extra: Record<string, unknown> = {}) {
    if (!sessionId) return
    try {
      await fetch('/api/public/home-chat/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventName: name,
          sessionId,
          pagePath: context.pathname,
          utm_source: context.utm_source,
          utm_medium: context.utm_medium,
          utm_campaign: context.utm_campaign,
          pc: context.pc,
          ref_present: Boolean(context.ref),
          ...extra,
        }),
      })
    } catch {
      // Analytics nunca bloqueia a experiência.
    }
  }

  function openAssistant() {
    setOpen(true)
    void event('assistant_open')
  }

  function clearConversation() {
    abortRef.current?.abort()
    setMessages([INITIAL_MESSAGE])
    setStreamingText('')
    setInput('')
    setStatus('IA • especialista no Orçaly')
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.sessionStorage.removeItem(SESSION_KEY)
      const next = getSessionId()
      setSessionId(next)
    } catch {
      setSessionId(id('session'))
    }
  }

  async function sendQuestion(rawQuestion: string, quick = false) {
    const question = rawQuestion.trim().slice(0, 700)
    if (question.length < 2 || sending || !sessionId) return

    const userMessage: ChatMessage = { id: id('user'), role: 'user', content: question }
    const history = [...messages, userMessage]
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, userMessage])
    setInput('')
    setSending(true)
    setStreamingText('')
    setStatus('Analisando seu negócio...')
    if (quick) void event('assistant_quick_action', { intent: question })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/public/home-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({
          question,
          messages: history,
          pageContext: context,
          sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Não foi possível consultar o Assistente.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AssistantResult | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          const lines = block.split('\n')
          const eventName = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
          const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim()
          if (!eventName || !dataLine) continue

          let payload: Record<string, unknown>
          try {
            payload = JSON.parse(dataLine) as Record<string, unknown>
          } catch {
            continue
          }

          if (eventName === 'status') {
            setStatus(String(payload.message || 'Analisando...').slice(0, 80))
          }
          if (eventName === 'delta') {
            setStreamingText((current) => `${current}${String(payload.text || '')}`.slice(0, 2000))
          }
          if (eventName === 'final') {
            finalResult = payload as unknown as AssistantResult
          }
        }
      }

      if (!finalResult?.answer) throw new Error('Resposta vazia do Assistente.')

      setMessages((current) => [...current, {
        id: id('assistant'),
        role: 'assistant',
        content: finalResult!.answer.slice(0, 2000),
        suggestions: cleanSuggestions(finalResult!.suggestions),
        action: finalResult!.action || null,
        cards: Array.isArray(finalResult!.cards) ? finalResult!.cards.filter(validCard).slice(0, 5) : [],
        requestId: finalResult!.requestId,
        recommendedPlan: finalResult!.recommendedPlan,
        segment: finalResult!.segment,
        feedback: null,
      }])
      setStreamingText('')
      setStatus(finalResult.source === 'fallback' ? 'Base segura disponível' : 'IA • especialista no Orçaly')
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus('Geração cancelada')
      } else {
        setMessages((current) => [...current, {
          id: id('assistant'),
          role: 'assistant',
          content: error instanceof Error && error.message.includes('Muitas tentativas')
            ? error.message
            : 'O Assistente está temporariamente indisponível, mas você ainda pode consultar planos, segmentos, demonstração e contato.',
          suggestions: ['Quanto custa?', 'Ver para meu negócio', 'Ver demonstração'],
          action: { label: 'Falar com a equipe', href: 'mailto:orcalybr@gmail.com', kind: 'secondary' },
        }])
        setStatus('Base segura disponível')
      }
      setStreamingText('')
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault()
    void sendQuestion(input)
  }

  function trackNavigation(href: string) {
    if (href.startsWith('/cadastro')) void event('assistant_signup_clicked')
    if (href.startsWith('https://wa.me/')) void event('assistant_whatsapp_clicked')
    if (href.includes('/demo') || href.includes('/solucoes/')) void event('assistant_demo_opened')
  }

  function rateFeedback(message: ChatMessage, rating: 'up' | 'down') {
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: rating } : item))
    void event('assistant_feedback', {
      requestId: message.requestId,
      rating,
      segment: message.segment,
      recommendedPlan: message.recommendedPlan,
    })
  }

  return (
    <>
      <style>{`
        @keyframes assistantV2Enter{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes assistantV2Dot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
        .assistant-v2-enter{animation:assistantV2Enter .2s ease-out both}
        .assistant-v2-dot{animation:assistantV2Dot 1.05s ease-in-out infinite}
        @media(max-width:639px){
          .assistant-v2-panel{inset:0!important;width:100%!important;height:100dvh!important;max-height:none!important;border-radius:0!important}
          .assistant-v2-composer{padding-bottom:max(1rem,env(safe-area-inset-bottom))!important}
        }
        @media(prefers-reduced-motion:reduce){.assistant-v2-enter,.assistant-v2-dot{animation:none!important}.assistant-v2-panel *{scroll-behavior:auto!important;transition:none!important}}
      `}</style>

      {open ? (
        <section role="dialog" aria-modal="true" aria-label="Assistente Orçaly" className="assistant-v2-panel assistant-v2-enter fixed bottom-5 right-5 z-[80] flex h-[min(720px,calc(100dvh-2.5rem))] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.75rem] border border-blue-100 bg-white shadow-[0_32px_100px_rgba(4,31,73,.28)]">
          <header className="relative overflow-hidden bg-[#061a36] px-4 py-4 text-white sm:px-5">
            <div className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <AssistantAvatar />
                <div className="min-w-0"><h2 className="truncate text-base font-black">Assistente Orçaly</h2><p className="mt-0.5 truncate text-[11px] font-bold text-blue-100/70">{status}</p></div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={clearConversation} title="Nova conversa" aria-label="Iniciar nova conversa" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-black transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300">↻</button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fechar Assistente Orçaly" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-300">×</button>
              </div>
            </div>
          </header>

          <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f9ff] px-3 py-4 sm:px-4" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id}>
                <div className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' ? <AssistantAvatar /> : null}
                  <div className={`max-w-[86%] whitespace-pre-wrap rounded-[1.25rem] px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${message.role === 'user' ? 'rounded-br-md bg-[#0b3b78] text-white' : 'rounded-bl-md border border-blue-100 bg-white text-slate-700'}`}>
                    {message.content}
                  </div>
                </div>

                {message.role === 'assistant' && message.cards?.length ? (
                  <div className="ml-11 mt-2 grid max-w-[calc(100%-2.75rem)] gap-2">
                    {message.cards.map((card, index) => <CardRenderer key={`${message.id}-card-${index}`} card={card} context={context} onNavigate={trackNavigation} sessionId={sessionId} messages={messages} />)}
                  </div>
                ) : null}

                {message.role === 'assistant' && message.action ? (
                  <div className="ml-11 mt-2"><ActionLink action={message.action} context={context} onNavigate={trackNavigation} /></div>
                ) : null}

                {message.role === 'assistant' && message.requestId ? (
                  <div className="ml-11 mt-1 flex gap-1" aria-label="Avaliar resposta">
                    <button type="button" aria-label="Resposta ajudou" onClick={() => rateFeedback(message, 'up')} className={`rounded-lg px-2 py-1 text-xs ${message.feedback === 'up' ? 'bg-blue-100' : 'text-slate-400 hover:bg-white'}`}>👍</button>
                    <button type="button" aria-label="Resposta não ajudou" onClick={() => rateFeedback(message, 'down')} className={`rounded-lg px-2 py-1 text-xs ${message.feedback === 'down' ? 'bg-blue-100' : 'text-slate-400 hover:bg-white'}`}>👎</button>
                  </div>
                ) : null}
              </div>
            ))}

            {sending ? (
              <div className="flex items-end gap-2">
                <AssistantAvatar />
                <div className="max-w-[86%] rounded-[1.25rem] rounded-bl-md border border-blue-100 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 shadow-sm">
                  {streamingText ? <span className="whitespace-pre-wrap">{streamingText}</span> : <span className="flex items-center gap-1" aria-label="Assistente digitando"><i className="assistant-v2-dot h-1.5 w-1.5 rounded-full bg-blue-400"/><i className="assistant-v2-dot h-1.5 w-1.5 rounded-full bg-blue-400 [animation-delay:.14s]"/><i className="assistant-v2-dot h-1.5 w-1.5 rounded-full bg-blue-400 [animation-delay:.28s]"/></span>}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-blue-100 bg-white px-3 py-3 sm:px-4">
            {!sending && latestSuggestions.length ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {latestSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void sendQuestion(suggestion, true)} className="min-h-9 shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 text-[11px] font-black text-[#0b3b78] transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={submit} className="assistant-v2-composer flex items-end gap-2">
              <label className="sr-only" htmlFor="orcaly-assistant-input">Pergunte sobre o Orçaly</label>
              <input id="orcaly-assistant-input" ref={inputRef} value={input} maxLength={700} disabled={sending} onChange={(eventInput) => setInput(eventInput.target.value)} placeholder="Ex.: tenho uma gráfica e vendo pelo WhatsApp" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60" />
              {sending ? (
                <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Cancelar resposta" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50">■</button>
              ) : (
                <button type="submit" disabled={!canSend} aria-label="Enviar mensagem" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0b3b78] text-lg font-black text-white shadow-md shadow-blue-950/10 transition hover:bg-[#082f62] disabled:cursor-not-allowed disabled:opacity-40">↑</button>
              )}
            </form>
            <p className="mt-2 text-center text-[10px] font-semibold text-slate-400">IA focada no Orçaly. Não envie senhas, cartão ou dados bancários.</p>
          </div>
        </section>
      ) : (
        <button type="button" onClick={openAssistant} aria-label="Abrir Assistente Orçaly" className="fixed bottom-5 right-4 z-[70] flex min-h-14 items-center gap-2 rounded-2xl bg-[#0b3b78] px-4 text-sm font-black text-white shadow-[0_18px_55px_rgba(4,31,73,.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#082f62] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:right-6">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">O</span>
          <span>Assistente Orçaly</span>
        </button>
      )}
    </>
  )
}
