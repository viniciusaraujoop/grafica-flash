'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type CadastroForm = {
  nome_responsavel: string
  email: string
  whatsapp: string
  empresa_nome: string
  modelo_negocio: string
  cidade: string
  estado: string
  plano: string
}

type ModeloNegocio = {
  id: string
  nome: string
  chamada: string
  exemplo: string
  perguntas: string[]
}

type Uf = {
  sigla: string
  nome: string
}

type CidadeIbge = {
  id: number
  nome: string
}

const ufs: Uf[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

const modelos: ModeloNegocio[] = [
  {
    id: 'grafica',
    nome: 'Gráfica e personalizados',
    chamada: 'Medidas, quantidades, acabamento e envio de arte.',
    exemplo: 'Banner, cartão, adesivo, camisa, caneca e fachada.',
    perguntas: ['Produto', 'Medidas', 'Quantidade', 'Prazo'],
  },
  {
    id: 'assistencia_tecnica',
    nome: 'Assistência técnica',
    chamada: 'Diagnóstico, defeito, urgência e aprovação de orçamento.',
    exemplo: 'Celular, notebook, videogame, eletrodoméstico e eletrônicos.',
    perguntas: ['Aparelho', 'Defeito', 'Urgência', 'Modelo'],
  },
  {
    id: 'beleza_estetica',
    nome: 'Beleza e estética',
    chamada: 'Serviços, horários, atendimento e apresentação visual.',
    exemplo: 'Salão, barbearia, unha, sobrancelha, estética e maquiagem.',
    perguntas: ['Serviço', 'Data', 'Horário', 'Objetivo'],
  },
  {
    id: 'alimenticio',
    nome: 'Alimentício e encomendas',
    chamada: 'Cardápio, sabores, tamanhos, datas e retirada ou entrega.',
    exemplo: 'Bolos, doces, salgados, marmitas, lanches e kits festa.',
    perguntas: ['Produto', 'Quantidade', 'Data', 'Entrega'],
  },
  {
    id: 'automotivo',
    nome: 'Automotivo',
    chamada: 'Veículo, serviço desejado, fotos e detalhes do orçamento.',
    exemplo: 'Oficina, estética automotiva, som, elétrica, peças e lavagem.',
    perguntas: ['Veículo', 'Serviço', 'Ano', 'Detalhes'],
  },
  {
    id: 'construcao_reformas',
    nome: 'Construção e reformas',
    chamada: 'Medidas, fotos, local do serviço e escopo do orçamento.',
    exemplo: 'Pintura, reforma, marcenaria, elétrica, hidráulica e gesso.',
    perguntas: ['Serviço', 'Medidas', 'Local', 'Prazo'],
  },
  {
    id: 'eventos',
    nome: 'Eventos e festas',
    chamada: 'Data, local, quantidade de pessoas e pacote desejado.',
    exemplo: 'Buffet, decoração, fotografia, cerimonial, som e locação.',
    perguntas: ['Evento', 'Data', 'Pessoas', 'Local'],
  },
  {
    id: 'moda_varejo',
    nome: 'Moda e varejo',
    chamada: 'Vitrine de produtos, variações, tamanhos e pedidos.',
    exemplo: 'Roupas, acessórios, calçados, bolsas, perfumaria e loja local.',
    perguntas: ['Produto', 'Tamanho', 'Variação', 'Entrega'],
  },
  {
    id: 'pet_shop',
    nome: 'Pet shop e banho/tosa',
    chamada: 'Dados do pet, serviço desejado e melhor horário.',
    exemplo: 'Banho, tosa, acessórios, ração e estética pet.',
    perguntas: ['Pet', 'Porte', 'Serviço', 'Data'],
  },
  {
    id: 'educacao_cursos',
    nome: 'Cursos e aulas',
    chamada: 'Cursos, turmas, horários e interessados em matrícula.',
    exemplo: 'Reforço escolar, idiomas, cursos livres e aulas particulares.',
    perguntas: ['Curso', 'Nível', 'Horário', 'Objetivo'],
  },
  {
    id: 'consultoria',
    nome: 'Consultoria e serviços profissionais',
    chamada: 'Briefing, objetivo, prazo e proposta consultiva.',
    exemplo: 'Contabilidade, marketing, RH, arquitetura, jurídico e negócios.',
    perguntas: ['Serviço', 'Objetivo', 'Prazo', 'Empresa'],
  },
  {
    id: 'fotografia_video',
    nome: 'Fotografia e vídeo',
    chamada: 'Data, local, estilo, pacote e detalhes da produção.',
    exemplo: 'Ensaios, eventos, produtos, vídeos comerciais e edição.',
    perguntas: ['Serviço', 'Data', 'Local', 'Estilo'],
  },
  {
    id: 'saude_bem_estar',
    nome: 'Saúde e bem-estar',
    chamada: 'Serviços, horários e solicitações gerais de atendimento.',
    exemplo: 'Clínicas, terapias, nutrição, pilates, fisioterapia e bem-estar.',
    perguntas: ['Serviço', 'Horário', 'Local', 'Observações'],
  },
  {
    id: 'tecnologia',
    nome: 'Tecnologia e digital',
    chamada: 'Briefing, escopo, objetivo e prazo do projeto.',
    exemplo: 'Sites, sistemas, automações, suporte, social media e design.',
    perguntas: ['Serviço', 'Objetivo', 'Prazo', 'Referências'],
  },
  {
    id: 'servicos_gerais',
    nome: 'Serviços gerais',
    chamada: 'Local, prazo, fotos e detalhes para orçamento.',
    exemplo: 'Limpeza, instalação, manutenção, frete, montagem e assistência.',
    perguntas: ['Serviço', 'Local', 'Prazo', 'Detalhes'],
  },
  {
    id: 'outros',
    nome: 'Outro tipo de negócio',
    chamada: 'Modelo flexível para adaptar depois no painel.',
    exemplo: 'Qualquer empresa que precise de site, pedidos e propostas.',
    perguntas: ['Produto', 'Atendimento', 'Prazo', 'Detalhes'],
  },
]

const planos = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 'R$ 49,90',
    descricao: 'Site, catálogo e pedidos.',
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 'R$ 99,90',
    descricao: 'Site, pedidos, propostas e oportunidades.',
    destaque: true,
  },
  {
    id: 'premium',
    nome: 'Premium',
    preco: 'R$ 149,90',
    descricao: 'Mais recursos para operação comercial.',
  },
]

function CadastroContent() {
  const [form, setForm] = useState<CadastroForm>({
    nome_responsavel: '',
    email: '',
    whatsapp: '',
    empresa_nome: '',
    modelo_negocio: 'grafica',
    cidade: '',
    estado: 'AL',
    plano: 'profissional',
  })

  const [cidades, setCidades] = useState<string[]>([])
  const [buscaCidade, setBuscaCidade] = useState('')
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const modeloSelecionado = useMemo(() => {
    return modelos.find((modelo) => modelo.id === form.modelo_negocio) || modelos[0]
  }, [form.modelo_negocio])

  const planoSelecionado = useMemo(() => {
    return planos.find((plano) => plano.id === form.plano) || planos[1]
  }, [form.plano])

  const cidadesFiltradas = useMemo(() => {
    const busca = buscaCidade.trim().toLowerCase()

    if (!busca) return cidades

    return cidades.filter((cidade) => cidade.toLowerCase().includes(busca))
  }, [buscaCidade, cidades])

  function update(campo: keyof CadastroForm, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  useEffect(() => {
    async function carregarCidades() {
      setCarregandoCidades(true)
      setCidades([])
      setBuscaCidade('')
      update('cidade', '')

      try {
        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.estado}/municipios?orderBy=nome`)
        const dados = (await resposta.json()) as CidadeIbge[]
        const nomes = dados.map((cidade: CidadeIbge) => cidade.nome).filter(Boolean)

        setCidades(nomes)
      } catch {
        setCidades([])
      }

      setCarregandoCidades(false)
    }

    if (form.estado) carregarCidades()
  }, [form.estado])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErro('')

    try {
      if (!form.cidade) {
        throw new Error('Escolha a cidade da empresa.')
      }

      const response = await fetch('/api/checkout/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          segmento: modeloSelecionado.nome,
          modelo_categoria: modeloSelecionado.chamada,
          marketing_opt_in: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar checkout.')
      }

      window.location.href = data.checkout_url
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao continuar.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#061a36]" style={{ colorScheme: 'light' as const }}>
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-360px] h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[#e7f1ff] blur-3xl" />
          <div className="absolute right-[-260px] top-[380px] h-[520px] w-[520px] rounded-full bg-[#e1faee] blur-3xl" />
          <div className="absolute bottom-[-260px] left-[-240px] h-[560px] w-[560px] rounded-full bg-[#f0f6ff] blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex">
              <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto object-contain" />
            </Link>

            <Link href="/login" className="rounded-2xl border border-[#d7e3f3] bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm">
              Entrar
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.88fr_1.12fr] lg:py-10">
            <aside className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e3f3] bg-white px-4 py-2 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">
                  Site profissional por segmento
                </span>
              </div>

              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.06em] text-[#061a36] sm:text-6xl">
                Comece com um site feito para o seu negócio.
              </h1>

              <p className="mt-5 text-lg font-semibold leading-8 text-[#607895]">
                Escolha o tipo de empresa, o plano e siga para ativar. O Orçaly prepara a base do site, catálogo, pedidos e propostas.
              </p>

              <div className="mt-8 rounded-[2rem] border border-[#d7e3f3] bg-white p-5 text-left shadow-xl shadow-[#05245c]/8">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Prévia do modelo</p>
                <h2 className="mt-3 text-3xl font-black text-[#061a36]">{modeloSelecionado.nome}</h2>
                <p className="mt-3 font-semibold leading-7 text-[#607895]">{modeloSelecionado.chamada}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {modeloSelecionado.perguntas.map((pergunta: string) => (
                    <span key={pergunta} className="rounded-full bg-[#f4f8ff] px-3 py-2 text-xs font-black text-[#05245c]">
                      {pergunta}
                    </span>
                  ))}
                </div>
              </div>
            </aside>

            <form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-[2.4rem] border border-[#d7e3f3] bg-white p-5 shadow-2xl shadow-[#05245c]/12 sm:p-7">
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Cadastro</p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#061a36]">Monte sua estrutura</h2>
                <p className="mx-auto mt-3 max-w-lg font-semibold leading-7 text-[#607895]">
                  Informe os dados principais da empresa e avance para o pagamento.
                </p>
              </div>

              {erro && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{erro}</div>}

              <div className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#344d6b]">Seu nome</span>
                    <input
                      value={form.nome_responsavel}
                      onChange={(e) => update('nome_responsavel', e.target.value)}
                      placeholder="Ex.: Vinicius"
                      className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-bold text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#344d6b]">WhatsApp</span>
                    <input
                      value={form.whatsapp}
                      onChange={(e) => update('whatsapp', e.target.value)}
                      placeholder="(82) 99999-9999"
                      className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-bold text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#344d6b]">E-mail</span>
                  <input
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="voce@email.com"
                    type="email"
                    className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-bold text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#344d6b]">Nome da empresa</span>
                  <input
                    value={form.empresa_nome}
                    onChange={(e) => update('empresa_nome', e.target.value)}
                    placeholder="Ex.: Gráfica Flash"
                    className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-bold text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#344d6b]">Tipo de empresa</span>
                  <select
                    value={form.modelo_negocio}
                    onChange={(e) => update('modelo_negocio', e.target.value)}
                    className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-black text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                  >
                    {modelos.map((modelo: ModeloNegocio) => (
                      <option key={modelo.id} value={modelo.id}>
                        {modelo.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#344d6b]">Estado</span>
                    <select
                      value={form.estado}
                      onChange={(e) => update('estado', e.target.value)}
                      className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-black text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe]"
                    >
                      {ufs.map((uf: Uf) => (
                        <option key={uf.sigla} value={uf.sigla}>
                          {uf.nome} - {uf.sigla}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#344d6b]">Cidade</span>
                    <select
                      value={form.cidade}
                      onChange={(e) => update('cidade', e.target.value)}
                      disabled={carregandoCidades || cidades.length === 0}
                      className="h-14 rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] px-4 font-black text-[#061a36] outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-[#dbeafe] disabled:opacity-60"
                    >
                      <option value="">{carregandoCidades ? 'Carregando cidades...' : 'Escolha a cidade'}</option>
                      {cidadesFiltradas.map((cidade: string) => (
                        <option key={cidade} value={cidade}>
                          {cidade}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <input
                  value={buscaCidade}
                  onChange={(e) => setBuscaCidade(e.target.value)}
                  placeholder="Buscar cidade dentro do estado escolhido"
                  className="h-13 rounded-2xl border border-[#d7e3f3] bg-white px-4 py-3 text-sm font-bold text-[#061a36] outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-[#dbeafe]"
                />

                <div className="grid gap-3 md:grid-cols-3">
                  {planos.map((plano) => (
                    <button
                      type="button"
                      key={plano.id}
                      onClick={() => update('plano', plano.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        form.plano === plano.id
                          ? 'border-[#05245c] bg-[#f4f8ff] shadow-lg shadow-[#05245c]/10'
                          : 'border-[#d7e3f3] bg-white hover:bg-[#f8fbff]'
                      }`}
                    >
                      {plano.destaque && <p className="mb-2 inline-flex rounded-full bg-[#05245c] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Mais escolhido</p>}
                      <p className="font-black text-[#061a36]">{plano.nome}</p>
                      <p className="mt-1 text-xl font-black text-[#05245c]">{plano.preco}</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-[#607895]">{plano.descricao}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-[#d7e3f3] bg-[#f8fbff] p-4">
                  <p className="text-sm font-black text-[#05245c]">Resumo</p>
                  <p className="mt-2 font-bold leading-6 text-[#607895]">
                    {form.empresa_nome || 'Sua empresa'} • {modeloSelecionado.nome} • {form.cidade || 'Cidade'} / {form.estado} • Plano {planoSelecionado.nome}
                  </p>
                </div>

                <button
                  disabled={loading}
                  className="rounded-2xl bg-[#05245c] px-6 py-5 text-base font-black text-white shadow-xl shadow-[#05245c]/25 transition hover:bg-[#031a43] disabled:opacity-60"
                >
                  {loading ? 'Abrindo checkout...' : 'Ir para o pagamento'}
                </button>

                <Link href="/login" className="text-center text-sm font-black text-[#05245c]">
                  Já tenho conta
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-white font-black text-[#05245c]">Carregando...</main>}>
      <CadastroContent />
    </Suspense>
  )
}
