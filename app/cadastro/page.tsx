'use client'

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EstadoIBGE = {
  id: number
  sigla: string
  nome: string
}

type CidadeIBGE = {
  id: number
  nome: string
}

type PlanoId = 'basico' | 'profissional' | 'premium'

const planos: Record<PlanoId, { nome: string; preco: number; descricao: string }> = {
  basico: {
    nome: 'Essencial',
    preco: 49.9,
    descricao: 'Para começar com pedidos e produtos organizados.',
  },
  profissional: {
    nome: 'Profissional',
    preco: 99.9,
    descricao: 'Mais indicado para vender com CRM e histórico comercial.',
  },
  premium: {
    nome: 'Premium',
    preco: 149.9,
    descricao: 'Para empresas que querem operar com mais controle.',
  },
}

function normalizarPlano(valor: string | null): PlanoId {
  if (valor === 'basico' || valor === 'profissional' || valor === 'premium') {
    return valor
  }

  return 'profissional'
}

function criarSlug(valor: string) {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function senhaForte(senha: string) {
  const tamanho = senha.length >= 8
  const maiuscula = /[A-Z]/.test(senha)
  const letra = /[A-Za-z]/.test(senha)
  const especial = /[^A-Za-z0-9]/.test(senha)

  return {
    tamanho,
    maiuscula,
    letra,
    especial,
    valida: tamanho && maiuscula && letra && especial,
  }
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function CadastroPageContent() {
  const searchParams = useSearchParams()
  const planoInicial = normalizarPlano(searchParams.get('plano'))

  const [plano, setPlano] = useState<PlanoId>(planoInicial)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [segmento, setSegmento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [estados, setEstados] = useState<EstadoIBGE[]>([])
  const [cidades, setCidades] = useState<CidadeIBGE[]>([])
  const [carregandoEstados, setCarregandoEstados] = useState(false)
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const slug = useMemo(() => criarSlug(nomeEmpresa || 'sua-empresa'), [nomeEmpresa])
  const regraSenha = useMemo(() => senhaForte(senha), [senha])
  const planoEscolhido = planos[plano]

  useEffect(() => {
    setPlano(normalizarPlano(searchParams.get('plano')))
  }, [searchParams])

  useEffect(() => {
    async function carregarEstados() {
      setCarregandoEstados(true)

      try {
        const resposta = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
        const dados = await resposta.json()

        setEstados(dados || [])
      } catch {
        setEstados([])
      }

      setCarregandoEstados(false)
    }

    carregarEstados()
  }, [])

  useEffect(() => {
    async function carregarCidades() {
      if (!estado) {
        setCidades([])
        setCidade('')
        return
      }

      setCarregandoCidades(true)
      setCidade('')

      try {
        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)
        const dados = await resposta.json()

        setCidades(dados || [])
      } catch {
        setCidades([])
      }

      setCarregandoCidades(false)
    }

    carregarCidades()
  }, [estado])

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!nomeEmpresa.trim()) {
      alert('Informe o nome da empresa.')
      return
    }

    if (!email.trim()) {
      alert('Informe o email.')
      return
    }

    if (!regraSenha.valida) {
      alert('A senha precisa ter no mínimo 8 caracteres, 1 letra maiúscula, letras e 1 caractere especial.')
      return
    }

    if (!estado || !cidade) {
      alert('Selecione estado e cidade.')
      return
    }

    setCarregando(true)
    setMensagem('Criando sua conta e preparando o checkout...')

    try {
      const { data: cadastroData, error: cadastroError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
        })

      if (cadastroError) {
        setMensagem(`Erro ao criar login: ${cadastroError.message}`)
        setCarregando(false)
        return
      }

      const usuario = cadastroData.user

      if (!usuario) {
        setMensagem('Conta criada. Confirme seu email e faça login para continuar.')
        setCarregando(false)
        return
      }

      const estadoNome = estados.find((item) => item.sigla === estado)?.nome || estado

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .insert({
          nome: nomeEmpresa.trim(),
          slug,
          email: email.trim(),
          telefone: telefone.trim(),
          whatsapp: telefone.trim(),
          segmento: segmento.trim(),
          cidade,
          estado: estadoNome,
          owner_id: usuario.id,
          plano,
          assinatura_plano: plano,
          assinatura_status: 'pendente',
          ativo: false,
        })
        .select('id')
        .single()

      if (empresaError) {
        setMensagem(`Erro ao criar empresa: ${empresaError.message}`)
        setCarregando(false)
        return
      }

      const respostaCheckout = await fetch('/api/checkout/plano', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: empresaData.id,
          plano,
          email: email.trim(),
          nomeEmpresa: nomeEmpresa.trim(),
        }),
      })

      const checkoutData = await respostaCheckout.json()

      if (!respostaCheckout.ok) {
        setMensagem(checkoutData.error || 'Erro ao criar checkout.')
        setCarregando(false)
        return
      }

      const urlCheckout = checkoutData.init_point || checkoutData.sandbox_init_point || checkoutData.checkout_url

      if (!urlCheckout) {
        setMensagem('Checkout criado, mas não recebi o link de pagamento.')
        setCarregando(false)
        return
      }

      window.location.href = urlCheckout
    } catch (error) {
      const textoErro =
        error instanceof Error ? error.message : 'Erro desconhecido no cadastro.'

      setMensagem(`Erro: ${textoErro}`)
      setCarregando(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7fbff] text-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-180px] top-[-180px] h-[460px] w-[460px] rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute right-[-180px] top-[140px] h-[380px] w-[380px] rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute bottom-[-200px] left-[35%] h-[460px] w-[460px] rounded-full bg-orange-100/70 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[.92fr_1.08fr] lg:px-8">
        <aside className="hidden lg:flex lg:flex-col lg:justify-between">
          <Link
            href="/"
            className="inline-flex w-fit items-center rounded-3xl border border-blue-100 bg-white px-4 py-3 shadow-lg shadow-blue-950/5"
          >
            <img
              src="/logo-orcaly.png"
              alt="Orçaly"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <div className="max-w-xl py-10">
            <div className="inline-flex rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-black text-[#05245c] shadow-sm shadow-blue-950/5">
              Cadastro inteligente
            </div>

            <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight text-[#071b3a]">
              Sua empresa organizada antes do próximo cliente pedir preço.
            </h1>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Quem responde rápido parece maior. Quem organiza clientes vende mais.
              O Orçaly entrega essa percepção desde o primeiro contato.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="font-black text-[#071b3a]">Venda antes de ser esquecido</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                  Cada pedido perdido no WhatsApp pode virar oportunidade para outro concorrente.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="font-black text-[#071b3a]">Controle que passa confiança</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                  Produtos, orçamentos, clientes e pagamentos em um só painel.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm font-bold text-slate-500">
            Cadastro seguro com plano selecionado automaticamente.
          </p>
        </aside>

        <div className="mx-auto flex w-full max-w-3xl items-center">
          <form
            onSubmit={cadastrar}
            className="w-full rounded-[2rem] border border-blue-100 bg-white p-5 text-slate-950 shadow-2xl shadow-blue-950/10 sm:p-8"
          >
            <div className="mb-6 flex justify-center lg:hidden">
              <Link
                href="/"
                className="rounded-3xl border border-blue-100 bg-white px-4 py-3 shadow-lg shadow-blue-950/5"
              >
                <img
                  src="/logo-orcaly.png"
                  alt="Orçaly"
                  className="h-12 w-auto object-contain"
                />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[#05245c]">
                  Comece agora
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#071b3a] sm:text-4xl">
                  Criar conta da empresa
                </h2>

                <p className="mt-3 leading-7 text-slate-600">
                  O plano escolhido na página principal já veio selecionado aqui.
                </p>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4 md:min-w-56">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">
                  Plano escolhido
                </p>
                <p className="mt-2 text-2xl font-black text-[#071b3a]">
                  {planoEscolhido.nome}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">
                  {formatarMoeda(planoEscolhido.preco)}/mês
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(Object.keys(planos) as PlanoId[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPlano(item)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    plano === item
                      ? 'border-[#05245c] bg-[#05245c] text-white shadow-lg shadow-blue-950/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  <p className="font-black">{planos[item].nome}</p>
                  <p className={`mt-1 text-sm font-bold ${plano === item ? 'text-blue-100' : 'text-slate-500'}`}>
                    {formatarMoeda(planos[item].preco)}/mês
                  </p>
                </button>
              ))}
            </div>

            {mensagem && (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                {mensagem}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-black text-slate-700">
                  Nome da empresa
                </span>

                <input
                  value={nomeEmpresa}
                  onChange={(evento) => setNomeEmpresa(evento.target.value)}
                  placeholder="Ex: Gráfica Flash"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Segmento
                </span>

                <input
                  value={segmento}
                  onChange={(evento) => setSegmento(evento.target.value)}
                  placeholder="Ex: gráfica, loja, serviços"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  WhatsApp
                </span>

                <input
                  value={telefone}
                  onChange={(evento) => setTelefone(evento.target.value)}
                  placeholder="(82) 99999-9999"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Estado
                </span>

                <select
                  value={estado}
                  onChange={(evento) => setEstado(evento.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    {carregandoEstados ? 'Carregando estados...' : 'Selecione o estado'}
                  </option>

                  {estados.map((item) => (
                    <option key={item.id} value={item.sigla}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Cidade
                </span>

                <select
                  value={cidade}
                  onChange={(evento) => setCidade(evento.target.value)}
                  disabled={!estado || carregandoCidades}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!estado
                      ? 'Escolha o estado primeiro'
                      : carregandoCidades
                        ? 'Carregando cidades...'
                        : 'Selecione a cidade'}
                  </option>

                  {cidades.map((item) => (
                    <option key={item.id} value={item.nome}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Email
                </span>

                <input
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  type="email"
                  placeholder="voce@empresa.com"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Senha forte
                </span>

                <input
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600 sm:grid-cols-2">
              <p className={regraSenha.tamanho ? 'text-emerald-700' : ''}>✓ Mínimo 8 caracteres</p>
              <p className={regraSenha.maiuscula ? 'text-emerald-700' : ''}>✓ 1 letra maiúscula</p>
              <p className={regraSenha.letra ? 'text-emerald-700' : ''}>✓ Letras</p>
              <p className={regraSenha.especial ? 'text-emerald-700' : ''}>✓ 1 caractere especial</p>
            </div>

            <div className="mt-5 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#05245c] text-xl text-white">
                  ✨
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">
                    Quase pronto
                  </p>

                  <h3 className="mt-2 text-2xl font-black text-[#071b3a]">
                    Sua estrutura digital está a um passo de entrar no ar.
                  </h3>

                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                    Depois do pagamento, sua empresa ganha acesso ao painel para organizar produtos,
                    pedidos, clientes e processos em um só lugar.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm shadow-blue-950/5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Plano
                  </p>
                  <p className="mt-1 font-black text-[#071b3a]">
                    {planoEscolhido.nome}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm shadow-blue-950/5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Empresa
                  </p>
                  <p className="mt-1 truncate font-black text-[#071b3a]">
                    {nomeEmpresa || 'Sua empresa'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm shadow-blue-950/5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Cidade
                  </p>
                  <p className="mt-1 truncate font-black text-[#071b3a]">
                    {cidade || 'A definir'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="mt-6 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? 'Preparando pagamento...' : `Assinar plano ${planoEscolhido.nome}`}
            </button>

            <p className="mt-4 text-center text-sm font-medium leading-6 text-slate-400">
              Ao continuar, você cria a conta da empresa e segue para o pagamento seguro.
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7fbff] px-4 text-slate-950">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-2xl shadow-blue-950/10">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Orçaly
            </p>
            <h1 className="mt-3 text-3xl font-black text-[#071b3a]">
              Carregando cadastro...
            </h1>
          </div>
        </main>
      }
    >
      <CadastroPageContent />
    </Suspense>
  )
}
