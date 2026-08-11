'use client'

// ORCALY_HOME_AI_CHAT_V2

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'

type ChatRole = 'assistant' | 'user'

type ChatAction = {
  label: string
  href: string
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  suggestions?: string[]
  action?: ChatAction | null
}

type ApiPayload = {
  answer?: string
  suggestions?: string[]
  action?: ChatAction | null
  source?: 'ai' | 'guided'
  error?: string
}

const STORAGE_KEY = 'orcaly:home-ai-chat:v2'
const MAX_STORED_MESSAGES = 18

const starterSuggestions = [
  'Descobrir meu plano ideal',
  'Comparar os três planos',
  'Quais segmentos são atendidos?',
  'Como funciona o site próprio?',
]

const initialMessage: ChatMessage = {
  id: 'orcaly-welcome',
  role: 'assistant',
  content:
    'Olá! Sou o assistente do Orçaly. Posso recomendar um plano, explicar recursos, comparar opções e mostrar como a plataforma se adapta ao seu tipo de negócio.',
  suggestions: starterSuggestions,
  action: {
    label: 'Ver todos os planos',
    href: '#planos',
  },
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isSafeAction(value: unknown): value is ChatAction {
  if (!value || typeof value !== 'object') return false

  const action = value as Record<string, unknown>
  const label = String(action.label || '').trim()
  const href = String(action.href || '').trim()

  if (!label || !href) return false

  return (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href === 'mailto:orcalybr@gmail.com'
  )
}

function cleanSuggestions(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 80)),
    ),
  ).slice(0, 3)
}

function restoreMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [initialMessage]

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) return [initialMessage]

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) return [initialMessage]

    const restored = parsed
      .slice(-MAX_STORED_MESSAGES)
      .flatMap((item): ChatMessage[] => {
        if (!item || typeof item !== 'object') return []

        const record = item as Record<string, unknown>
        const role: ChatRole =
          record.role === 'user' ? 'user' : 'assistant'
        const content = String(record.content || '').trim().slice(0, 1600)

        if (!content) return []

        return [
          {
            id: String(record.id || messageId(role)),
            role,
            content,
            suggestions: cleanSuggestions(record.suggestions),
            action: isSafeAction(record.action)
              ? record.action
              : null,
          },
        ]
      })

    return restored.length ? restored : [initialMessage]
  } catch {
    return [initialMessage]
  }
}

function AssistantAvatar() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-lg shadow-lg shadow-blue-950/15">
      💭
    </div>
  )
}

export default function HomeAiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage])
  const [hydrated, setHydrated] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(true)
  const [status, setStatus] = useState('Pronto para ajudar')

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const canSend = input.trim().length >= 2 && !sending

  const latestSuggestions = useMemo(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant')

    return latestAssistant?.suggestions?.length
      ? latestAssistant.suggestions
      : starterSuggestions.slice(0, 3)
  }, [messages])

  useEffect(() => {
    setMessages(restoreMessages())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
      )
    } catch {
      // O chat continua funcionando mesmo quando o navegador bloqueia storage.
    }
  }, [hydrated, messages])

  useEffect(() => {
    if (!open) return

    setUnread(false)

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 180)

    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, open, sending])

  useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function clearConversation() {
    setMessages([initialMessage])
    setInput('')
    setStatus('Nova conversa iniciada')

    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Sem impacto funcional.
    }
  }

  async function sendQuestion(rawQuestion: string) {
    const question = rawQuestion.trim().slice(0, 700)

    if (question.length < 2 || sending) return

    const userMessage: ChatMessage = {
      id: messageId('user'),
      role: 'user',
      content: question,
    }

    const history = [...messages, userMessage]
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))

    setMessages((current) => [...current, userMessage])
    setInput('')
    setSending(true)
    setStatus('Analisando sua dúvida...')

    try {
      const response = await fetch('/api/public/home-chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          question,
          messages: history,
          page: window.location.pathname,
        }),
      })

      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiPayload

      if (!response.ok) {
        throw new Error(
          payload.error ||
            'Não foi possível consultar o assistente.',
        )
      }

      const answer = String(payload.answer || '').trim()

      if (!answer) {
        throw new Error('O assistente retornou uma resposta vazia.')
      }

      const assistantMessage: ChatMessage = {
        id: messageId('assistant'),
        role: 'assistant',
        content: answer.slice(0, 1600),
        suggestions: cleanSuggestions(payload.suggestions),
        action: isSafeAction(payload.action)
          ? payload.action
          : null,
      }

      setMessages((current) => [...current, assistantMessage])
      setStatus(
        payload.source === 'ai'
          ? 'Resposta personalizada'
          : 'Resposta rápida',
      )
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: messageId('assistant'),
          role: 'assistant',
          content:
            'Não consegui consultar a IA agora, mas a equipe pode ajudar diretamente pelo e-mail orcalybr@gmail.com.',
          suggestions: [
            'Comparar os planos',
            'O que é o Orçaly?',
          ],
          action: {
            label: 'Falar com a equipe',
            href: 'mailto:orcalybr@gmail.com',
          },
        },
      ])
      setStatus('Atendimento alternativo disponível')
    } finally {
      setSending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendQuestion(input)
  }

  return (
    <>
      <style>{`
        @keyframes orcalyChatEnterV2 {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes orcalyChatPulseV2 {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(5, 36, 92, .25);
          }
          50% {
            box-shadow: 0 0 0 13px rgba(5, 36, 92, 0);
          }
        }

        @keyframes orcalyTypingDotV2 {
          0%, 60%, 100% {
            opacity: .35;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        .orcaly-home-chat-enter-v2 {
          animation: orcalyChatEnterV2 .25s ease-out both;
        }

        .orcaly-home-chat-pulse-v2 {
          animation: orcalyChatPulseV2 2.8s ease-in-out infinite;
        }

        .orcaly-home-chat-dot-v2 {
          animation: orcalyTypingDotV2 1.1s ease-in-out infinite;
        }

        /* ORCALY_HOME_CHAT_MOBILE_RESPONSIVE_V3 */
        @media (max-width: 639px) {
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] {
            left: 0.5rem !important;
            right: 0.5rem !important;
            bottom: 5.4rem !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            max-height: calc(100dvh - 6.3rem) !important;
            border-radius: 1.4rem !important;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] header {
            padding: 1rem !important;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] > div {
            min-width: 0;
            max-width: 100%;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] p,
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] a,
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] button {
            overflow-wrap: anywhere;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] input {
            min-width: 0;
            max-width: 100%;
          }

          button[aria-label="Abrir assistente virtual do Orçaly"] {
            width: 3.5rem !important;
            height: 3.5rem !important;
            font-size: 1.5rem !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .orcaly-home-chat-enter-v2,
          .orcaly-home-chat-pulse-v2,
          .orcaly-home-chat-dot-v2 {
            animation: none;
          }
        }
      `}</style>

      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Assistente virtual do Orçaly"
          className="orcaly-home-chat-enter-v2 fixed inset-x-3 bottom-[5.8rem] z-[70] flex max-h-[min(76vh,680px)] flex-col overflow-hidden rounded-[1.8rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/25 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[650px] sm:max-h-[calc(100vh-3rem)] sm:w-[430px]"
        >
          <header className="relative overflow-hidden bg-[#061a36] px-5 py-5 text-white">
            <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 left-8 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <AssistantAvatar />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-black">
                      Assistente Orçaly
                    </h2>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.14)]" />
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-blue-100/75">
                    {status}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={clearConversation}
                  aria-label="Iniciar nova conversa"
                  title="Nova conversa"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-black text-white transition hover:bg-white/20"
                >
                  ↻
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar assistente"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-xl font-black text-white transition hover:bg-white/20"
                >
                  ×
                </button>
              </div>
            </div>
          </header>

          <div
            ref={messagesRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f9ff] px-4 py-5"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={`flex items-end gap-2 ${
                    message.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <AssistantAvatar />
                  ) : null}

                  <div
                    className={`max-w-[84%] whitespace-pre-wrap rounded-[1.35rem] px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-[#05245c] text-white'
                        : 'rounded-bl-md border border-blue-100 bg-white text-[#304965]'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>

                {message.role === 'assistant' &&
                message.action ? (
                  <div className="ml-11 mt-2">
                    <a
                      href={message.action.href}
                      className="inline-flex rounded-xl bg-[#05245c] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5"
                    >
                      {message.action.label}
                    </a>
                  </div>
                ) : null}
              </div>
            ))}

            {sending ? (
              <div className="flex items-end gap-2">
                <AssistantAvatar />
                <div className="flex items-center gap-1 rounded-[1.35rem] rounded-bl-md border border-blue-100 bg-white px-4 py-4 shadow-sm">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="orcaly-home-chat-dot-v2 h-2 w-2 rounded-full bg-[#05245c]"
                      style={{
                        animationDelay: `${index * 140}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-blue-100 bg-white px-4 py-4">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
              {latestSuggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendQuestion(question)}
                  className="shrink-0 rounded-full border border-blue-100 bg-[#f6f9ff] px-3 py-2 text-xs font-black text-[#05245c] transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>

            <form
              onSubmit={submit}
              className="flex items-center gap-2 rounded-[1.25rem] border border-blue-100 bg-[#f8fbff] p-2 focus-within:border-blue-300 focus-within:bg-white"
            >
              <input
                ref={inputRef}
                value={input}
                maxLength={700}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Pergunte sobre planos ou recursos..."
                aria-label="Digite sua dúvida sobre o Orçaly"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-bold text-[#061a36] outline-none placeholder:text-slate-400"
              />

              <button
                type="submit"
                disabled={!canSend}
                aria-label="Enviar pergunta"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-lg font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                ↑
              </button>
            </form>

            <p className="mt-2 text-center text-[10px] font-bold leading-4 text-slate-400">
              Não compartilhe senhas, cartões, CPF ou dados financeiros.
            </p>
          </div>
        </section>
      ) : (
        <div className="fixed bottom-[5.8rem] right-4 z-[70] sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir assistente virtual do Orçaly"
            className="orcaly-home-chat-pulse-v2 group relative grid h-16 w-16 place-items-center rounded-[1.4rem] border-4 border-white bg-[#05245c] text-3xl shadow-2xl shadow-blue-950/25 transition hover:-translate-y-1 hover:scale-105"
          >
            <span aria-hidden="true">💭</span>

            {unread ? (
              <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-emerald-500 px-1 text-[10px] font-black text-white">
                1
              </span>
            ) : null}

            <span className="pointer-events-none absolute right-[calc(100%+10px)] hidden whitespace-nowrap rounded-xl bg-[#061a36] px-3 py-2 text-xs font-black text-white opacity-0 shadow-xl transition group-hover:opacity-100 sm:block">
              Descubra o plano ideal
            </span>
          </button>
        </div>
      )}
    </>
  )
}
