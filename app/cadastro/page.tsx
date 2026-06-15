'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const planos = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: 'R$ 49/mês',
    descricao: 'Para começar com catálogo, pedidos e página pública.',
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 'R$ 99/mês',
    descricao: 'Para empresas que querem catálogo, pedidos, pagamentos e gestão.',
  },
  {
    id: 'premium',
    nome: 'Premium',
    preco: 'R$ 199/mês',
    descricao: 'Para operações maiores, com mais personalização e automações.',
  },
]

function criarSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function CadastroPage() {
  const router = useRouter()

  const [plano, setPlano] = useState('profissional')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [segmento, setSegmento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const planoUrl = parametros.get('plano')

    if (planoUrl) {
      setPlano(planoUrl)
    }
  }, [])

  async function cadastrarEmpresa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!nomeEmpresa.trim()) {
      const texto = 'Informe o nome da empresa.'
      setMensagem(texto)
      alert(texto)
      return
    }

    if (!email.trim()) {
      const texto = 'Informe seu e-mail.'
      setMensagem(texto)
      alert(texto)
      return
    }

    if (!senha || senha.length < 6) {
      const texto = 'A senha precisa ter pelo menos 6 caracteres.'
      setMensagem(texto)
      alert(texto)
      return
    }

    setCarregando(true)
    setMensagem('')

    try {
      const slug = criarSlug(nomeEmpresa)

      const { data: cadastroData, error: cadastroError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: {
              nome: nomeResponsavel.trim(),
              empresa: nomeEmpresa.trim(),
            },
          },
        })

      if (cadastroError) {
        const texto = `Erro ao criar conta: ${cadastroError.message}`
        setMensagem(texto)
        alert(texto)
        setCarregando(false)
        return
      }

      const usuarioId = cadastroData.user?.id

      if (!usuarioId) {
        const texto =
          'Conta criada, mas não consegui identificar o usuário. Faça login e cadastre a empresa pelo painel.'
        setMensagem(texto)
        alert(texto)
        setCarregando(false)
        return
      }

      const { error: empresaError } = await supabase.from('companies').insert({
        nome: nomeEmpresa.trim(),
        slug,
        owner_id: usuarioId,
        email: email.trim(),
        segmento: segmento.trim(),
        telefone: telefone.trim(),
        whatsapp: telefone.trim(),
        cidade: cidade.trim(),
        estado: estado.trim(),
        plano,
        ativo: true,
        cor_principal: '#05245c',
        aceita_pix: false,
        aceita_cartao: false,
        cobrar_sinal: false,
        percentual_sinal: 0,
      })

      if (empresaError) {
        const texto = `Erro ao cadastrar empresa: ${empresaError.message}`
        setMensagem(texto)
        alert(texto)
        setCarregando(false)
        return
      }

      const texto =
        'Cadastro criado com sucesso. Agora faça login para acessar o painel.'
      setMensagem(texto)
      alert(texto)

      router.push('/login')
    } catch (erro) {
      const textoErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao cadastrar.'

      const texto = `Erro: ${textoErro}`
      setMensagem(texto)
      alert(texto)
    }

    setCarregando(false)
  }

  const planoAtual = planos.find((item) => item.id === plano) || planos[1]
  const slugPreview = nomeEmpresa ? criarSlug(nomeEmpresa) : 'sua-empresa'

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-16 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-blue-50 bg-white/90 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
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

          <Link
            href="/login"
            className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
          >
            Já tenho conta
          </Link>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <aside className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Comece agora
            </p>

            <h1 className="mt-3 text-4xl font-black leading-tight text-[#071b3a] sm:text-5xl">
              Crie a página digital da sua empresa
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              Cadastre sua empresa, configure catálogo, receba pedidos e organize solicitações em um painel próprio.
            </p>

            <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-sm font-bold text-slate-500">
                Plano selecionado
              </p>

              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">
                {planoAtual.nome}
              </h2>

              <p className="mt-1 text-3xl font-black text-[#05245c]">
                {planoAtual.preco}
              </p>

              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {planoAtual.descricao}
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {planos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlano(item.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    plano === item.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-blue-100 bg-white hover:bg-blue-50'
                  }`}
                >
                  <p className="font-black text-[#071b3a]">
                    {item.nome} • {item.preco}
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {item.descricao}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <form
            onSubmit={cadastrarEmpresa}
            className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-2xl shadow-blue-950/10"
          >
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Cadastro
            </p>

            <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
              Dados da empresa
            </h2>

            <div className="mt-6 grid gap-4">
              <input
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Nome da empresa"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-bold text-[#05245c]">
                Link público: /orcamento/{slugPreview}
              </div>

              <input
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Segmento. Ex: gráfica, locadora, clínica..."
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="WhatsApp da empresa"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="Estado"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <input
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                placeholder="Nome do responsável"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail de acesso"
                type="email"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha de acesso"
                type="password"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={carregando}
                className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {carregando ? 'Criando cadastro...' : 'Criar minha conta'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}
