$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto não encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

New-Item -ItemType Directory -Force "app\login" | Out-Null

Set-Content -Path "app\login\page.tsx" -Encoding UTF8 -Value @'
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from ' @/lib/supabase'

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
      alert('Informe seu e-mail.')
      return
    }

    if (!senha) {
      alert('Informe sua senha.')
      return
    }

    setCarregando(true)
    setMensagem('Entrando...')

    try {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })

      if (loginError) {
        const texto =
          loginError.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos.'
            : `Erro ao entrar: ${loginError.message}`

        setMensagem(texto)
        alert(texto)
        setCarregando(false)
        return
      }

      const usuario = loginData.user

      if (!usuario) {
        const texto = 'Login feito, mas não consegui identificar o usuário.'
        setMensagem(texto)
        alert(texto)
        setCarregando(false)
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome, assinatura_status, assinatura_expira_em')
        .eq('owner_id', usuario.id)
        .maybeSingle()

      if (empresaError) {
        const texto = `Erro ao buscar empresa: ${empresaError.message}`
        setMensagem(texto)
        alert(texto)
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
      alert(`Erro: ${textoErro}`)
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
          <aside className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <img
                src="/icone-orcaly.png"
                alt="Orçaly"
                className="h-12 w-12 rounded-2xl bg-blue-50 object-contain p-2"
              />

              <img
                src="/logo-orcaly.png"
                alt="Orçaly"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <p className="mt-10 text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Painel da empresa
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight text-[#071b3a] sm:text-5xl">
              Entre para gerenciar pedidos, produtos e orçamentos
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              O acesso ao painel só é liberado para empresas com assinatura ativa.
              Se o pagamento estiver pendente, você será enviado para a tela de assinatura.
            </p>

            <div className="mt-8 grid gap-3">
              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="font-black text-[#071b3a]">
                  Acesso protegido por assinatura
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Login sem pagamento aprovado não libera o painel. Finalmente uma porta com fechadura.
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-black text-emerald-700">
                  Checkout integrado
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O cliente pode pagar o plano e voltar para acessar o sistema.
                </p>
              </div>
            </div>
          </aside>

          <form
            onSubmit={entrar}
            className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-2xl shadow-blue-950/10 sm:p-8"
          >
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Login
            </p>

            <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
              Acessar minha conta
            </h2>

            <p className="mt-3 leading-7 text-slate-600">
              Entre com o e-mail e senha cadastrados.
            </p>

            {mensagem && (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                {mensagem}
              </div>
            )}

            <div className="mt-6 grid gap-4">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                type="email"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                type="password"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={carregando}
                className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? 'Entrando...' : 'Entrar no painel'}
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-center">
              <p className="text-sm font-bold text-slate-600">
                Ainda não tem conta?
              </p>

              <Link
                href="/cadastro"
                className="mt-3 inline-block rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5"
              >
                Criar conta e escolher plano
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}

'@

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Login atualizado com verificação de assinatura." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
