'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type MessageType = 'info' | 'erro' | 'sucesso'

type SegmentCard = {
  label: string
  structure: string
  badge: string
  gradient: string
}

type Benefit = {
  title: string
  description: string
}

const segmentCards: SegmentCard[] = [
  {
    label: 'Food',
    structure: 'Cardápio, pedidos e entrega',
    badge: 'Orçaly Food',
    gradient: 'from-emerald-400 to-cyan-400',
  },
  {
    label: 'Gráfica',
    structure: 'Orçamentos, artes e produção',
    badge: 'Orçaly Gráfica',
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    label: 'Beauty',
    structure: 'Serviços e agendamentos',
    badge: 'Orçaly Beauty',
    gradient: 'from-fuchsia-400 to-purple-500',
  },
  {
    label: 'Assistência',
    structure: 'Fotos, defeitos e status',
    badge: 'Orçaly Assistência',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    label: 'Loja',
    structure: 'Catálogo, produtos e pedidos',
    badge: 'Orçaly Loja',
    gradient: 'from-cyan-400 to-blue-500',
  },
  {
    label: 'Serviços',
    structure: 'Propostas, prazos e acompanhamento',
    badge: 'Orçaly Serviços',
    gradient: 'from-violet-400 to-blue-500',
  },
]

const benefits: Benefit[] = [
  {
    title: 'Painel único',
    description: 'Pedidos, site, produtos, clientes e assinatura no mesmo lugar.',
  },
  {
    title: 'Estrutura por segmento',
    description: 'Food, gráfica, beleza, assistência, loja e serviços com fluxos mais claros.',
  },
  {
    title: 'Conta protegida',
    description: 'Seu acesso, empresa, site e dados ficam vinculados à sua conta.',
  },
]

function isValidEmail(value: string) {
  return value.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (message === 'Invalid login credentials' || normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.'
  }

  return 'Não foi possível entrar agora. Tente novamente em alguns instantes.'
}

function getSafeNextPath() {
  if (typeof window === 'undefined') return '/painel'

  const params = new URLSearchParams(window.location.search)
  const rawNext = params.get('next')

  if (!rawNext) return '/painel'

  const next = rawNext.trim()

  if (!next) return '/painel'
  if (!next.startsWith('/')) return '/painel'
  if (next.startsWith('//')) return '/painel'
  if (next.includes('://')) return '/painel'
  if (next.startsWith('/login')) return '/painel'
  if (next.startsWith('/cadastro')) return '/painel'

  return next
}

function LoginSegmentPreview({ segment }: { segment: SegmentCard }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-blue-950/20 backdrop-blur">
      <div className={`absolute right-[-80px] top-[-80px] h-48 w-48 rounded-full bg-gradient-to-br ${segment.gradient} opacity-40 blur-2xl`} />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full bg-gradient-to-r ${segment.gradient} px-4 py-2 text-xs font-black text-white shadow-lg`}>
            {segment.badge}
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-white/70">
            modular
          </span>
        </div>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Tipo de negócio</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">{segment.label}</p>
          </div>

          <div className="rounded-2xl bg-white p-4 text-[#061a36]">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Estrutura</p>
            <p className="mt-2 text-xl font-black tracking-[-0.035em]">{segment.structure}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrarEmail, setLembrarEmail] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('Entre para acessar o painel da sua empresa.')
  const [tipoMensagem, setTipoMensagem] = useState<MessageType>('info')
  const [segmentIndex, setSegmentIndex] = useState(0)

  const emailValido = useMemo(() => isValidEmail(email), [email])
  const currentSegment = segmentCards[segmentIndex]

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedEmail = window.localStorage.getItem('orcaly_login_email')

    if (savedEmail) {
      setEmail(savedEmail)
    }

    const params = new URLSearchParams(window.location.search)

    if (params.get('expired') === '1') {
      setTipoMensagem('info')
      setMensagem('Sua sessão expirou. Entre novamente para continuar.')
      return
    }

    if (params.get('renovar') === '1') {
      setTipoMensagem('info')
      setMensagem('Entre para renovar sua assinatura e reativar seu painel.')
      return
    }

    setTipoMensagem('info')
    setMensagem('Entre para acessar o painel da sua empresa.')
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSegmentIndex((current) => (current + 1) % segmentCards.length)
    }, 2800)

    return () => window.clearInterval(timer)
  }, [])

  function handleEmailChange(value: string) {
    setEmail(value)

    if (typeof window !== 'undefined' && lembrarEmail && value.trim()) {
      window.localStorage.setItem('orcaly_login_email', value.trim().toLowerCase())
    }
  }

  function avisarRecuperacaoSenha() {
    setTipoMensagem('info')
    setMensagem('A recuperação de senha será liberada em breve. Por enquanto, confira seus dados ou fale com o suporte do Orçaly.')
  }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (carregando) return

    const emailLimpo = email.trim().toLowerCase()

    if (!emailLimpo) {
      setTipoMensagem('erro')
      setMensagem('Informe o e-mail da conta.')
      return
    }

    if (!emailValido) {
      setTipoMensagem('erro')
      setMensagem('Digite um e-mail válido.')
      return
    }

    if (!senha) {
      setTipoMensagem('erro')
      setMensagem('Informe sua senha de acesso.')
      return
    }

    setCarregando(true)
    setTipoMensagem('info')
    setMensagem('Validando seu acesso...')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      })

      if (error) {
        setTipoMensagem('erro')
        setMensagem(getFriendlyAuthError(error.message))
        setCarregando(false)
        return
      }

      if (!data.user?.id) {
        setTipoMensagem('erro')
        setMensagem('Não foi possível entrar agora. Tente novamente em alguns instantes.')
        setCarregando(false)
        return
      }

      if (lembrarEmail && typeof window !== 'undefined') {
        window.localStorage.setItem('orcaly_login_email', emailLimpo)
      }

      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      setTipoMensagem('sucesso')
      setMensagem('Acesso validado. Abrindo painel...')

      await new Promise((resolve) => window.setTimeout(resolve, 150))
      router.replace(getSafeNextPath())
    } catch {
      setTipoMensagem('erro')
      setMensagem('Não foi possível entrar agora. Tente novamente em alguns instantes.')
      setCarregando(false)
    }
  }

  const messageClass =
    tipoMensagem === 'erro'
      ? 'border-red-200 bg-red-50 text-red-700'
      : tipoMensagem === 'sucesso'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-200 bg-blue-50 text-[#05245c]'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061a36] text-white">
      <style>{`
        @keyframes loginFloatOrcaly {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes loginFadeOrcaly {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes loginGlowOrcaly {
          0%, 100% { opacity: .55; transform: scale(1); }
          50% { opacity: .9; transform: scale(1.06); }
        }

        .login-float-orcaly {
          animation: loginFloatOrcaly 6s ease-in-out infinite;
        }

        .login-fade-orcaly {
          animation: loginFadeOrcaly .7s ease-out both;
        }

        .login-glow-orcaly {
          animation: loginGlowOrcaly 6.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-float-orcaly,
          .login-fade-orcaly,
          .login-glow-orcaly {
            animation: none;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="login-glow-orcaly absolute left-[-220px] top-[-260px] h-[620px] w-[620px] rounded-full bg-blue-500/25 blur-3xl" />
        <div className="login-glow-orcaly absolute right-[-220px] top-[20%] h-[560px] w-[560px] rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[30%] h-[520px] w-[520px] rounded-full bg-purple-500/18 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:px-8 lg:py-10">
        <aside className="login-fade-orcaly hidden lg:block">
          <Link href="/" className="inline-flex items-center rounded-2xl bg-white px-4 py-3 shadow-xl shadow-blue-950/20">
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-12 w-auto object-contain" />
          </Link>

          <div className="mt-12 max-w-2xl">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-cyan-100 backdrop-blur">
              Especializado para vender. Unificado para escalar.
            </div>

            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-[-0.065em] xl:text-7xl">
              Entre no painel que entende o seu negócio.
            </h1>

            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-white/72">
              Organize pedidos, orçamentos, cardápios, serviços e atendimentos em uma estrutura feita para o tipo da sua empresa.
            </p>

            <div className="login-float-orcaly mt-9 max-w-xl">
              <LoginSegmentPreview segment={currentSegment} />
            </div>

            <div className="mt-7 grid max-w-xl gap-3">
              {benefits.map((benefit) => (
                <article key={benefit.title} className="rounded-2xl border border-white/12 bg-white/8 p-4 shadow-lg shadow-blue-950/10 backdrop-blur transition hover:bg-white/12">
                  <div className="flex gap-3">
                    <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400 text-xs font-black text-[#061a36]">
                      ✓
                    </span>
                    <div>
                      <p className="font-black text-white">{benefit.title}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-white/62">{benefit.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <div className="login-fade-orcaly mx-auto w-full max-w-[540px]">
          <div className="mb-5 flex justify-center lg:hidden">
            <Link href="/" className="inline-flex items-center rounded-2xl bg-white px-4 py-3 shadow-xl shadow-blue-950/20">
              <img src="/logo-orcaly.png" alt="Orçaly" className="h-12 w-auto object-contain" />
            </Link>
          </div>

          <div className="mb-5 rounded-[1.7rem] border border-white/12 bg-white/8 p-4 text-center backdrop-blur lg:hidden">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Orçaly modular</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.055em]">Entre no painel que entende o seu negócio.</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
              Pedidos, cardápios, serviços e atendimentos organizados para o tipo da sua empresa.
            </p>
          </div>

          <div className="relative">
            <div className="login-float-orcaly absolute -left-8 top-10 z-10 hidden rounded-2xl border border-white/20 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-xl shadow-blue-950/20 sm:block">
              Site ativo
            </div>

            <div className="login-float-orcaly absolute -right-8 bottom-24 z-10 hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 shadow-xl shadow-emerald-950/10 sm:block">
              Pedido recebido
            </div>

            <form onSubmit={entrar} className="relative overflow-hidden rounded-[2.35rem] border border-white/18 bg-white p-6 text-[#071b3a] shadow-2xl shadow-blue-950/25 sm:p-8">
              <div className="pointer-events-none absolute right-[-90px] top-[-90px] h-56 w-56 rounded-full bg-blue-100 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-120px] left-[-90px] h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Acesso seguro</p>
                    <h2 className="mt-2 text-4xl font-black tracking-[-0.045em] text-[#071b3a]">
                      Bem-vindo de volta
                    </h2>
                    <p className="mt-3 max-w-md leading-7 text-slate-600">
                      Entre para acessar o painel da sua empresa, acompanhar pedidos, editar seu site e gerenciar sua assinatura.
                    </p>
                  </div>

                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-[#05245c] shadow-lg shadow-[#05245c]/20">
                    <div className="relative h-8 w-8">
                      <div className="absolute left-1/2 top-0 h-4 w-5 -translate-x-1/2 rounded-t-xl border-4 border-white" />
                      <div className="absolute bottom-0 left-0 h-6 w-8 rounded-xl bg-white" />
                      <div className="absolute bottom-2 left-1/2 h-2 w-1 -translate-x-1/2 rounded-full bg-[#05245c]" />
                    </div>
                  </div>
                </div>

                {mensagem ? (
                  <div className={`mt-6 rounded-2xl border p-4 text-sm font-bold ${messageClass}`}>
                    {mensagem}
                  </div>
                ) : null}

                <div className="mt-7 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">E-mail da conta</span>
                    <div className={`rounded-2xl border bg-slate-50 px-4 transition focus-within:bg-white focus-within:ring-4 ${
                      emailValido
                        ? 'border-slate-200 focus-within:border-[#05245c] focus-within:ring-blue-100'
                        : 'border-red-200 focus-within:border-red-500 focus-within:ring-red-100'
                    }`}>
                      <input
                        value={email}
                        onChange={(event) => handleEmailChange(event.target.value)}
                        placeholder="voce@empresa.com"
                        type="email"
                        autoComplete="email"
                        disabled={carregando}
                        className="w-full bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>
                    {!emailValido ? <span className="text-xs font-bold text-red-600">Digite um e-mail válido.</span> : null}
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Senha de acesso</span>
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-[#05245c] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                      <input
                        value={senha}
                        onChange={(event) => setSenha(event.target.value)}
                        placeholder="Digite sua senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        autoComplete="current-password"
                        disabled={carregando}
                        className="w-full bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                      />

                      <button
                        type="button"
                        onClick={() => setMostrarSenha((current) => !current)}
                        disabled={carregando}
                        className="rounded-xl px-3 py-2 text-xs font-black text-[#05245c] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={lembrarEmail}
                        onChange={(event) => setLembrarEmail(event.target.checked)}
                        disabled={carregando}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Lembrar e-mail
                    </label>

                    <button
                      type="button"
                      onClick={avisarRecuperacaoSenha}
                      disabled={carregando}
                      className="text-left text-sm font-black text-[#05245c] hover:underline disabled:cursor-not-allowed disabled:opacity-60 sm:text-right"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={carregando}
                    className="mt-2 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {carregando ? 'Entrando...' : 'Entrar no painel'}
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-[#f8fbff] p-5">
                  <p className="text-sm font-black text-[#071b3a]">Ainda não usa o Orçaly?</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                    Crie sua estrutura e comece com uma página pronta para o jeito que sua empresa vende.
                  </p>

                  <Link href="/cadastro" className="mt-4 inline-flex w-full justify-center rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-[#05245c] shadow-sm transition hover:bg-blue-50">
                    Criar minha estrutura
                  </Link>
                </div>

                <p className="mt-5 text-center text-xs font-bold leading-5 text-slate-400">
                  Seu acesso, empresa, site e dados ficam vinculados à sua conta.
                </p>
              </div>
            </form>

            <p className="mt-6 text-center text-sm font-semibold leading-6 text-white/60">
              O login autentica sua conta e abre o painel. O próprio painel decide liberação, renovação ou cadastro da empresa.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
