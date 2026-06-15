'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  assinatura_status: string | null
  assinatura_expira_em: string | null
}

function assinaturaEstaAtiva(empresa: Empresa | null) {
  if (!empresa) return false

  if (empresa.assinatura_status !== 'ativa') return false

  if (!empresa.assinatura_expira_em) return true

  const agora = new Date()
  const expiraEm = new Date(empresa.assinatura_expira_em)

  return expiraEm > agora
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!email.trim()) {
      alert('Informe seu email.')
      return
    }

    if (!senha) {
      alert('Informe sua senha.')
      return
    }

    setCarregando(true)
    setMensagem('Validando acesso...')

    try {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })

      if (loginError) {
        const texto =
          loginError.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos.'
            : `Erro ao entrar: ${loginError.message}`

        setMensagem(texto)
        setCarregando(false)
        return
      }

      const usuario = loginData.user

      if (!usuario) {
        setMensagem('Nao foi possivel identificar o usuario.')
        setCarregando(false)
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome, assinatura_status, assinatura_expira_em')
        .eq('owner_id', usuario.id)
        .maybeSingle()

      if (empresaError) {
        setMensagem(`Erro ao buscar empresa: ${empresaError.message}`)
        setCarregando(false)
        return
      }

      if (!empresaData) {
        router.push('/cadastro')
        return
      }

      if (!assinaturaEstaAtiva(empresaData as Empresa)) {
        router.push('/assinatura')
        return
      }

      router.push('/painel')
    } catch (erro) {
      const textoErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao entrar.'

      setMensagem(`Erro: ${textoErro}`)
      setCarregando(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07142f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute right-[-120px] top-[15%] h-[360px] w-[360px] rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-[35%] h-[420px] w-[420px] rounded-full bg-orange-400/20 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <aside className="hidden lg:block">
            <Link href="/" className="inline-flex items-center">
              <img
                src="/logo-orcaly.png"
                alt="Orcaly"
                className="h-14 w-auto object-contain"
              />
            </Link>

            <div className="mt-14 max-w-2xl">
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100 backdrop-blur">
                Plataforma empresarial
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight xl:text-6xl">
                Controle pedidos, produtos e or&ccedil;amentos em um painel simples.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100/85">
                Entre para acompanhar solicita&ccedil;&otilde;es, organizar o cat&aacute;logo
                da empresa e transformar atendimentos em oportunidades reais.
              </p>

              <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-3xl font-black">24h</p>
                  <p className="mt-2 text-sm font-semibold text-blue-100/75">
                    Or&ccedil;amentos online
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-3xl font-black">Pix</p>
                  <p className="mt-2 text-sm font-semibold text-blue-100/75">
                    Pagamentos integrados
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-3xl font-black">CRM</p>
                  <p className="mt-2 text-sm font-semibold text-blue-100/75">
                    Pedidos organizados
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex justify-center lg:hidden">
              <Link href="/" className="inline-flex items-center">
                <img
                  src="/logo-orcaly.png"
                  alt="Orcaly"
                  className="h-14 w-auto object-contain"
                />
              </Link>
            </div>

            <form
              onSubmit={entrar}
              className="rounded-[2rem] border border-white/15 bg-white p-6 text-slate-950 shadow-2xl shadow-black/30 sm:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#05245c]">
                    Acesso
                  </p>

                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#071b3a]">
                    Entrar no painel
                  </h2>
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                  🔐
                </div>
              </div>

              <p className="mt-4 leading-7 text-slate-600">
                Use o email cadastrado para acessar sua empresa no Or&ccedil;aly.
              </p>

              {mensagem && (
                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                  {mensagem}
                </div>
              )}

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">
                    Email
                  </span>

                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    type="email"
                    autoComplete="email"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">
                    Senha
                  </span>

                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    type="password"
                    autoComplete="current-password"
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={carregando}
                  className="mt-2 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {carregando ? 'Entrando...' : 'Acessar painel'}
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-bold leading-6 text-slate-600">
                  Ainda n&atilde;o tem uma conta?
                </p>

                <Link
                  href="/cadastro"
                  className="mt-3 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5 transition hover:bg-blue-50"
                >
                  Criar empresa no Or&ccedil;aly
                </Link>
              </div>
            </form>

            <p className="mt-6 text-center text-sm font-medium leading-6 text-blue-100/70">
              O acesso ao painel depende de uma assinatura ativa.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
