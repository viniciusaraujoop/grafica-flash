'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug?: string | null
  assinatura_status: string | null
  assinatura_expira_em: string | null
}

type Member = {
  company_id: string | null
  cargo?: string | null
  status?: string | null
}

const features = [
  {
    title: 'Pedidos organizados',
    description: 'Receba solicitações, arquivos e detalhes sem depender de conversa perdida.',
  },
  {
    title: 'Propostas com aprovação',
    description: 'Envie links profissionais para o cliente visualizar, assinar e aprovar.',
  },
  {
    title: 'Produção no controle',
    description: 'Acompanhe status, etapas e oportunidades pelo painel da empresa.',
  },
]

const metrics = [
  ['Orçamentos', '24h'],
  ['Propostas', 'link'],
  ['Equipe', 'multiacesso'],
]

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function assinaturaEstaAtiva(empresa: Empresa | null) {
  if (!empresa) return false

  if (empresa.assinatura_status !== 'ativa') return false

  if (!empresa.assinatura_expira_em) return true

  const agora = new Date()
  const expiraEm = new Date(empresa.assinatura_expira_em)

  return expiraEm > agora
}

function friendlyAuthError(message: string) {
  if (message === 'Invalid login credentials') return 'E-mail ou senha incorretos.'
  if (message.toLowerCase().includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  return `Erro ao entrar: ${message}`
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrar, setLembrar] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [tipoMensagem, setTipoMensagem] = useState<'info' | 'erro' | 'sucesso'>('info')

  const emailValido = useMemo(() => {
    return email.trim().length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }, [email])

  useEffect(() => {
    const savedEmail = typeof window !== 'undefined' ? window.localStorage.getItem('orcaly_login_email') : null
    if (savedEmail) setEmail(savedEmail)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('expired') === '1') {
        setTipoMensagem('info')
        setMensagem('Sua sessão expirou por segurança. Entre novamente para continuar.')
      }
    }
  }, [])

  async function buscarEmpresaDoUsuario(usuarioId: string) {
    if (!isUuid(usuarioId)) return null

    const { data: empresaDono, error: empresaError } = await supabase
      .from('companies')
      .select('id, nome, slug, assinatura_status, assinatura_expira_em')
      .or(`owner_id.eq.${usuarioId},tester_id.eq.${usuarioId}`)
      .maybeSingle()

    if (empresaError) throw new Error(`Erro ao buscar empresa: ${empresaError.message}`)
    if (empresaDono?.id) return empresaDono as Empresa

    const { data: membro, error: membroError } = await supabase
      .from('company_members')
      .select('company_id,cargo,status')
      .eq('user_id', usuarioId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (membroError) throw new Error(`Erro ao buscar acesso da equipe: ${membroError.message}`)

    const membroAtivo = membro as Member | null

    if (!membroAtivo?.company_id || !isUuid(membroAtivo.company_id)) return null

    const { data: empresaFuncionario, error: empresaFuncionarioError } = await supabase
      .from('companies')
      .select('id, nome, slug, assinatura_status, assinatura_expira_em')
      .eq('id', membroAtivo.company_id)
      .maybeSingle()

    if (empresaFuncionarioError) throw new Error(`Erro ao buscar empresa da equipe: ${empresaFuncionarioError.message}`)

    return (empresaFuncionario || null) as Empresa | null
  }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const emailLimpo = email.trim().toLowerCase()

    if (!emailLimpo) {
      setTipoMensagem('erro')
      setMensagem('Informe seu e-mail.')
      return
    }

    if (!emailValido) {
      setTipoMensagem('erro')
      setMensagem('Digite um e-mail válido.')
      return
    }

    if (!senha) {
      setTipoMensagem('erro')
      setMensagem('Informe sua senha.')
      return
    }

    setCarregando(true)
    setTipoMensagem('info')
    setMensagem('Validando acesso...')

    try {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      })

      if (loginError) {
        setTipoMensagem('erro')
        setMensagem(friendlyAuthError(loginError.message))
        setCarregando(false)
        return
      }

      const usuario = loginData.user

      if (!usuario?.id || !isUuid(usuario.id)) {
        setTipoMensagem('erro')
        setMensagem('Não foi possível identificar o usuário.')
        setCarregando(false)
        return
      }

      if (lembrar && typeof window !== 'undefined') {
        window.localStorage.setItem('orcaly_login_email', emailLimpo)
      }

      // Depois do login, sempre abre o painel.
      // A tela /painel decide o estado correto: liberado, bloqueado por assinatura
      // ou sem empresa vinculada. Isso evita jogar usuário pago de volta para /cadastro.
      setTipoMensagem('sucesso')
      setMensagem('Acesso validado. Abrindo painel...')

      router.push('/painel')
    } catch (erro) {
      const textoErro = erro instanceof Error ? erro.message : 'Erro desconhecido ao entrar.'

      setTipoMensagem('erro')
      setMensagem(textoErro)
      setCarregando(false)
    }
  }

  const messageClass =
    tipoMensagem === 'erro'
      ? 'border-red-100 bg-red-50 text-red-700'
      : tipoMensagem === 'sucesso'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : 'border-blue-100 bg-blue-50 text-[#05245c]'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8fbff] text-[#071b3a]">
      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }

        @keyframes loginFadeUp {
          0% { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes loginPulse {
          0%, 100% { transform: scale(1); opacity: .7; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        .login-float { animation: loginFloat 5.5s ease-in-out infinite; }
        .login-float-delay { animation: loginFloat 6.2s ease-in-out infinite; animation-delay: .9s; }
        .login-fade-up { animation: loginFadeUp .65s ease-out both; }
        .login-pulse { animation: loginPulse 4.4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .login-float, .login-float-delay, .login-fade-up, .login-pulse { animation: none; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="login-pulse absolute left-[-220px] top-[-220px] h-[520px] w-[520px] rounded-full bg-[#dcecff] blur-3xl" />
        <div className="login-pulse absolute right-[-220px] top-[18%] h-[520px] w-[520px] rounded-full bg-[#dffbea] blur-3xl" />
        <div className="absolute bottom-[-260px] left-[28%] h-[520px] w-[520px] rounded-full bg-[#fff4d6] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#05245c]/20 to-transparent" />
      </div>

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:px-8">
        <aside className="login-fade-up hidden lg:block">
          <Link href="/" className="inline-flex items-center">
            <img src="/logo-orcaly.png" alt="Orçaly" className="h-14 w-auto object-contain" />
          </Link>

          <div className="mt-14 max-w-2xl">
            <div className="inline-flex rounded-full border border-[#d7e3f3] bg-white px-4 py-2 text-sm font-black text-[#05245c] shadow-sm">
              Plataforma empresarial para pedidos e propostas
            </div>

            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-[-0.065em] text-[#061a36] xl:text-7xl">
              Entre para transformar atendimento em operação organizada.
            </h1>

            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-[#607895]">
              Acesse pedidos, propostas, catálogo, clientes, produção e oportunidades da sua empresa em um só painel.
            </p>

            <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
              {metrics.map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-[#d7e3f3] bg-white p-5 shadow-xl shadow-[#05245c]/6">
                  <p className="text-3xl font-black text-[#05245c]">{value}</p>
                  <p className="mt-2 text-sm font-bold text-[#607895]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid max-w-xl gap-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-[#e5edf8] bg-white/80 p-4 shadow-lg shadow-[#05245c]/5 backdrop-blur">
                  <div className="flex gap-3">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">✓</span>
                    <div>
                      <p className="font-black text-[#071b3a]">{feature.title}</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-[#607895]">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="login-fade-up mx-auto w-full max-w-[520px]">
          <div className="mb-6 flex justify-center lg:hidden">
            <Link href="/" className="inline-flex items-center">
              <img src="/logo-orcaly.png" alt="Orçaly" className="h-14 w-auto object-contain" />
            </Link>
          </div>

          <div className="relative">
            <div className="login-float absolute -left-8 top-9 z-10 hidden rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-xl shadow-[#05245c]/10 sm:block">
              Proposta aprovada
            </div>

            <div className="login-float-delay absolute -right-8 bottom-20 z-10 hidden rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 shadow-xl shadow-emerald-900/10 sm:block">
              Pedido em produção
            </div>

            <form onSubmit={entrar} className="relative overflow-hidden rounded-[2.4rem] border border-[#d7e3f3] bg-white p-6 shadow-2xl shadow-[#05245c]/14 sm:p-8">
              <div className="pointer-events-none absolute right-[-90px] top-[-90px] h-56 w-56 rounded-full bg-[#dcecff] blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-120px] left-[-90px] h-56 w-56 rounded-full bg-[#dffbea] blur-3xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-[#05245c]">Acesso seguro</p>
                    <h2 className="mt-2 text-4xl font-black tracking-[-0.045em] text-[#071b3a]">
                      Entrar no painel
                    </h2>
                    <p className="mt-3 leading-7 text-slate-600">
                      Use seu e-mail cadastrado para acessar o Orçaly.
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

                {mensagem && (
                  <div className={`mt-6 rounded-2xl border p-4 text-sm font-bold ${messageClass}`}>
                    {mensagem}
                  </div>
                )}

                <div className="mt-7 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">E-mail</span>
                    <div className={`rounded-2xl border bg-slate-50 px-4 transition focus-within:bg-white focus-within:ring-4 ${
                      emailValido
                        ? 'border-slate-200 focus-within:border-[#05245c] focus-within:ring-blue-100'
                        : 'border-red-200 focus-within:border-red-500 focus-within:ring-red-100'
                    }`}>
                      <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="voce@empresa.com"
                        type="email"
                        autoComplete="email"
                        className="w-full bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    {!emailValido && <span className="text-xs font-bold text-red-600">Digite um e-mail válido.</span>}
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Senha</span>
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-[#05245c] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                      <input
                        value={senha}
                        onChange={(event) => setSenha(event.target.value)}
                        placeholder="Digite sua senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="w-full bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                      />

                      <button
                        type="button"
                        onClick={() => setMostrarSenha((current) => !current)}
                        className="rounded-xl px-3 py-2 text-xs font-black text-[#05245c] hover:bg-blue-50"
                      >
                        {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-sm font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={lembrar}
                        onChange={(event) => setLembrar(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Lembrar e-mail
                    </label>

                    <Link href="/cadastro" className="text-sm font-black text-[#05245c] hover:underline">
                      Criar conta
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={carregando}
                    className="mt-2 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-xl shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {carregando ? 'Entrando...' : 'Acessar painel'}
                  </button>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-200 bg-[#f8fbff] p-5">
                  <p className="text-sm font-black text-[#071b3a]">Ainda não tem acesso?</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                    Crie uma empresa ou peça ao responsável para adicionar seu e-mail na equipe.
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link href="/cadastro" className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-black text-[#05245c] shadow-sm transition hover:bg-blue-50">
                      Criar empresa
                    </Link>
                    <Link href="/" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-600 transition hover:bg-slate-50">
                      Voltar ao site
                    </Link>
                  </div>
                </div>
              </div>
            </form>

            <p className="mt-6 text-center text-sm font-semibold leading-6 text-[#607895]">
              O acesso ao painel depende de uma assinatura ativa e de permissão na empresa.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
