'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { businessTypes, getBusinessTypeConfig, normalizeBusinessType, type BusinessType } from '@/lib/business-types'
import { getSubdomainSuggestions, normalizeSubdomainSlug, validateSubdomainSlug } from '@/lib/slug'

type CadastroForm = {
  nome_responsavel: string
  email: string
  whatsapp: string
  empresa_nome: string
  modelo_negocio: string
  business_type: BusinessType
  onboarding_goal: string
  subdomain_slug: string
  cidade: string
  estado: string
  plano: string
}

type Uf = {
  sigla: string
  nome: string
}

type CidadeIbge = {
  id: number
  nome: string
}

type SlugCheck = {
  status: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'
  message: string
  suggestions: string[]
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

const objetivos = [
  'Receber mais pedidos',
  'Organizar orçamentos',
  'Criar um site profissional',
  'Vender pelo WhatsApp',
  'Mostrar catálogo/cardápio',
  'Controlar atendimentos',
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

const steps = [
  { id: 1, title: 'Acesso', subtitle: 'Seus dados' },
  { id: 2, title: 'Empresa', subtitle: 'Base inicial' },
  { id: 3, title: 'Segmento', subtitle: 'Modelo ideal' },
  { id: 4, title: 'Link', subtitle: 'Endereço público' },
  { id: 5, title: 'Revisão', subtitle: 'Criar estrutura' },
]

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 13)

  if (numbers.length <= 2) return numbers
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`

  return `+${numbers.slice(0, 2)} (${numbers.slice(2, 4)}) ${numbers.slice(4, 9)}-${numbers.slice(9, 13)}`
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function CadastroContent() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<CadastroForm>({
    nome_responsavel: '',
    email: '',
    whatsapp: '',
    empresa_nome: '',
    modelo_negocio: 'services',
    business_type: 'services',
    onboarding_goal: 'Receber mais pedidos',
    subdomain_slug: '',
    cidade: '',
    estado: 'AL',
    plano: 'profissional',
  })

  const [cidades, setCidades] = useState<string[]>([])
  const [buscaCidade, setBuscaCidade] = useState('')
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({
    status: 'idle',
    message: 'Escolha o endereço público da empresa.',
    suggestions: [],
  })

  const config = useMemo(() => getBusinessTypeConfig(form.business_type), [form.business_type])

  const planoSelecionado = useMemo(() => {
    return planos.find((plano) => plano.id === form.plano) || planos[1]
  }, [form.plano])

  const cidadesFiltradas = useMemo(() => {
    const busca = buscaCidade.trim().toLowerCase()
    if (!busca) return cidades
    return cidades.filter((cidade) => cidade.toLowerCase().includes(busca))
  }, [buscaCidade, cidades])

  const progresso = (step / steps.length) * 100

  function update<K extends keyof CadastroForm>(campo: K, valor: CadastroForm[K]) {
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

  useEffect(() => {
    if (!form.empresa_nome || form.subdomain_slug) return
    update('subdomain_slug', normalizeSubdomainSlug(form.empresa_nome))
  }, [form.empresa_nome, form.subdomain_slug])

  useEffect(() => {
    const validation = validateSubdomainSlug(form.subdomain_slug)

    if (!form.subdomain_slug) {
      setSlugCheck({
        status: 'idle',
        message: 'Escolha o endereço público da empresa.',
        suggestions: getSubdomainSuggestions(form.empresa_nome, form.cidade),
      })
      return
    }

    if (!validation.ok) {
      setSlugCheck({
        status: 'invalid',
        message: validation.reason || 'Link inválido.',
        suggestions: getSubdomainSuggestions(form.empresa_nome || form.subdomain_slug, form.cidade),
      })
      return
    }

    setSlugCheck((current) => ({
      ...current,
      status: 'checking',
      message: 'Verificando disponibilidade...',
    }))

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          slug: validation.slug,
          company: form.empresa_nome || validation.slug,
          city: form.cidade || '',
        })

        const response = await fetch(`/api/company/check-subdomain?${params.toString()}`, {
          signal: controller.signal,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao verificar link.')
        }

        if (data.available) {
          setSlugCheck({
            status: 'available',
            message: 'Link disponível.',
            suggestions: [],
          })
        } else {
          setSlugCheck({
            status: 'unavailable',
            message: data.reason || 'Esse link já está em uso. Tente outro nome.',
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          })
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return

        setSlugCheck({
          status: 'invalid',
          message: error instanceof Error ? error.message : 'Erro ao verificar link.',
          suggestions: getSubdomainSuggestions(form.empresa_nome || form.subdomain_slug, form.cidade),
        })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [form.subdomain_slug, form.empresa_nome, form.cidade])

  function selectBusinessType(type: BusinessType) {
    const next = getBusinessTypeConfig(type)

    setForm((current) => ({
      ...current,
      business_type: type,
      modelo_negocio: type,
      onboarding_goal: current.onboarding_goal || 'Receber mais pedidos',
    }))

    if (!form.empresa_nome) return
    if (!form.subdomain_slug) update('subdomain_slug', normalizeSubdomainSlug(form.empresa_nome || next.publicName))
  }

  function canGoNext(currentStep = step) {
    if (currentStep === 1) {
      if (!form.nome_responsavel.trim()) return 'Informe seu nome.'
      if (!isEmail(form.email)) return 'Informe um e-mail válido.'
    }

    if (currentStep === 2) {
      if (form.empresa_nome.trim().length < 2) return 'Informe o nome da empresa.'
      if (form.whatsapp.replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido.'
      if (!form.cidade) return 'Escolha a cidade da empresa.'
      if (!form.onboarding_goal) return 'Escolha o principal objetivo da empresa.'
    }

    if (currentStep === 3 && !form.business_type) {
      return 'Escolha o tipo de negócio.'
    }

    if (currentStep === 4) {
      const validation = validateSubdomainSlug(form.subdomain_slug)
      if (!validation.ok) return validation.reason || 'Escolha um link público válido.'
      if (slugCheck.status === 'checking') return 'Aguarde a verificação do link.'
      if (slugCheck.status !== 'available') return slugCheck.message || 'Escolha um link disponível.'
    }

    return ''
  }

  function nextStep() {
    const message = canGoNext()
    setErro(message)

    if (!message) {
      setStep((current) => Math.min(current + 1, steps.length))
    }
  }

  function previousStep() {
    setErro('')
    setStep((current) => Math.max(current - 1, 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationMessage =
      canGoNext(1) ||
      canGoNext(2) ||
      canGoNext(3) ||
      canGoNext(4)

    if (validationMessage) {
      setErro(validationMessage)
      return
    }

    setLoading(true)
    setErro('')

    try {
      const response = await fetch('/api/checkout/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          modelo_negocio: form.business_type,
          segmento: config.label,
          modelo_categoria: config.siteSubheadline,
          subdomain_slug: normalizeSubdomainSlug(form.subdomain_slug),
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

  const slugValidation = validateSubdomainSlug(form.subdomain_slug)
  const publicLink = `${slugValidation.slug || 'suaempresa'}.orcaly.com.br`

  return (
    <main className="min-h-screen bg-[#f6f9ff] text-[#061a36]" style={{ colorScheme: 'light' as const }}>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-360px] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute right-[-260px] top-[360px] h-[520px] w-[520px] rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute bottom-[-280px] left-[-240px] h-[560px] w-[560px] rounded-full bg-purple-100 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex">
              <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto object-contain" />
            </Link>

            <Link href="/login" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm">
              Entrar
            </Link>
          </header>

          <div className="grid flex-1 items-start gap-6 py-8 lg:grid-cols-[1fr_390px] lg:py-10">
            <section className="rounded-[2.4rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/10 sm:p-7">
              <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
                <aside className="rounded-[2rem] bg-[#05245c] p-6 text-white">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                    Onboarding inteligente
                  </div>

                  <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.055em] sm:text-5xl">
                    Crie uma estrutura feita para o seu tipo de negócio.
                  </h1>

                  <p className="mt-4 text-base font-semibold leading-7 text-white/74">
                    O Orçaly prepara sua página, painel, textos e recursos iniciais com base no segmento da sua empresa.
                  </p>

                  <div className="mt-7 rounded-[1.7rem] bg-white/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Frase-guia</p>
                    <p className="mt-2 text-xl font-black tracking-[-0.03em]">
                      Escolha seu tipo de negócio. O Orçaly monta a estrutura inicial para você.
                    </p>
                  </div>

                  <div className="mt-7 grid gap-3">
                    {steps.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.id < step && setStep(item.id)}
                        className={`rounded-2xl p-4 text-left transition ${
                          step === item.id ? 'bg-white text-[#05245c]' : 'bg-white/8 text-white/72 hover:bg-white/12'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-black ${step === item.id ? 'bg-[#05245c] text-white' : 'bg-white/10 text-white'}`}>
                            {item.id}
                          </span>
                          <div>
                            <p className="font-black">{item.title}</p>
                            <p className="text-xs font-bold opacity-70">{item.subtitle}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                <form onSubmit={submit} className="min-w-0">
                  <div className="mb-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-[#05245c]">Etapa {step} de {steps.length}</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{steps[step - 1]?.title}</h2>
                      </div>
                      <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[#05245c]">{Math.round(progresso)}%</span>
                    </div>

                    <div className="mt-4 h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-[#05245c] transition-all" style={{ width: `${progresso}%` }} />
                    </div>
                  </div>

                  {erro ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{erro}</div> : null}

                  {step === 1 ? (
                    <div className="grid gap-4">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.035em]">Crie sua conta no Orçaly</h3>
                        <p className="mt-2 font-semibold leading-7 text-[#607895]">
                          Seu acesso será usado para gerenciar sua empresa, site, pedidos e assinatura. A senha é criada com segurança após a confirmação do pagamento, mantendo o fluxo atual do Orçaly.
                        </p>
                      </div>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-[#344d6b]">Seu nome</span>
                        <input value={form.nome_responsavel} onChange={(e) => update('nome_responsavel', e.target.value)} placeholder="Ex.: Vinicius" className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-[#344d6b]">E-mail da conta</span>
                        <input value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="voce@email.com" type="email" className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                      </label>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="grid gap-4">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.035em]">Agora vamos preparar a base da sua empresa.</h3>
                        <p className="mt-2 font-semibold leading-7 text-[#607895]">
                          Essas informações aparecem no seu site, propostas e atendimento.
                        </p>
                      </div>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-[#344d6b]">Nome da empresa</span>
                        <input value={form.empresa_nome} onChange={(e) => update('empresa_nome', e.target.value)} placeholder="Ex.: Gráfica Flash" className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-[#344d6b]">WhatsApp principal</span>
                        <input value={form.whatsapp} onChange={(e) => update('whatsapp', formatPhone(e.target.value))} placeholder="(82) 99999-9999" className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-black text-[#344d6b]">Estado</span>
                          <select value={form.estado} onChange={(e) => update('estado', e.target.value)} className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-black outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100">
                            {ufs.map((uf) => <option key={uf.sigla} value={uf.sigla}>{uf.nome} - {uf.sigla}</option>)}
                          </select>
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-black text-[#344d6b]">Cidade</span>
                          <select value={form.cidade} onChange={(e) => update('cidade', e.target.value)} disabled={carregandoCidades || cidades.length === 0} className="h-14 rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 font-black outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60">
                            <option value="">{carregandoCidades ? 'Carregando cidades...' : 'Escolha a cidade'}</option>
                            {cidadesFiltradas.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}
                          </select>
                        </label>
                      </div>

                      <input value={buscaCidade} onChange={(e) => setBuscaCidade(e.target.value)} placeholder="Buscar cidade dentro do estado escolhido" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100" />

                      <div>
                        <p className="text-sm font-black text-[#344d6b]">Qual é o principal objetivo da sua empresa agora?</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {objetivos.map((objetivo) => (
                            <button key={objetivo} type="button" onClick={() => update('onboarding_goal', objetivo)} className={`rounded-2xl border p-4 text-left text-sm font-black transition ${form.onboarding_goal === objetivo ? 'border-[#05245c] bg-blue-50 text-[#05245c]' : 'border-blue-100 bg-white text-[#607895] hover:bg-[#f8fbff]'}`}>
                              {objetivo}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="grid gap-4">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.035em]">Escolha o tipo de negócio que mais combina com sua operação.</h3>
                        <p className="mt-2 font-semibold leading-7 text-[#607895]">
                          Usaremos essa escolha para montar uma experiência inicial com categorias, status, textos e recursos recomendados. Você poderá alterar tudo depois.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {businessTypes.map((type) => (
                          <button key={type.id} type="button" onClick={() => selectBusinessType(type.id)} className={`rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-0.5 ${form.business_type === type.id ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/8' : 'border-blue-100 bg-white hover:bg-[#f8fbff]'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-[#061a36]">{type.label}</p>
                                <p className="mt-1 text-sm font-bold leading-5 text-[#607895]">{type.siteSubheadline}</p>
                              </div>
                              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${form.business_type === type.id ? 'bg-[#05245c] text-white' : 'bg-slate-100 text-[#607895]'}`}>
                                {type.label.slice(0, 1)}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {type.defaultFeatures.slice(0, 3).map((feature) => (
                                <span key={feature.titulo} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#05245c]">
                                  {feature.titulo}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="grid gap-4">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.035em]">Escolha o endereço público da sua empresa.</h3>
                        <p className="mt-2 font-semibold leading-7 text-[#607895]">
                          Esse será o link que seus clientes usarão para acessar sua página, catálogo, cardápio ou orçamento.
                        </p>
                      </div>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-[#344d6b]">Link público</span>
                        <div className="flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-[#f8fbff] transition focus-within:border-[#05245c] focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100 sm:flex-row sm:items-center">
                          <input value={form.subdomain_slug} onChange={(e) => update('subdomain_slug', normalizeSubdomainSlug(e.target.value))} placeholder="suaempresa" className="h-14 min-w-0 flex-1 bg-transparent px-4 font-black outline-none" />
                          <span className="border-t border-blue-100 px-4 py-3 text-sm font-black text-[#05245c] sm:border-l sm:border-t-0">.orcaly.com.br</span>
                        </div>
                      </label>

                      <div className={`rounded-2xl p-4 text-sm font-black ${slugCheck.status === 'available' ? 'bg-emerald-50 text-emerald-700' : slugCheck.status === 'checking' ? 'bg-blue-50 text-[#05245c]' : slugCheck.status === 'idle' ? 'bg-blue-50 text-[#05245c]' : 'bg-red-50 text-red-700'}`}>
                        {slugCheck.message}
                      </div>

                      {slugCheck.suggestions.length ? (
                        <div>
                          <p className="text-sm font-black text-[#344d6b]">Sugestões disponíveis</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {slugCheck.suggestions.map((suggestion) => (
                              <button key={suggestion} type="button" onClick={() => update('subdomain_slug', suggestion)} className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-black text-[#05245c] hover:bg-blue-50">
                                {suggestion}.orcaly.com.br
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 5 ? (
                    <div className="grid gap-5">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.035em]">Tudo pronto para criar sua estrutura.</h3>
                        <p className="mt-2 font-semibold leading-7 text-[#607895]">
                          Vamos aplicar o modelo escolhido e preparar seu painel inicial. Você poderá editar qualquer informação depois.
                        </p>
                      </div>

                      <div className="rounded-[1.5rem] border border-blue-100 bg-[#f8fbff] p-5">
                        <p className="text-sm font-black text-[#05245c]">Resumo</p>
                        <div className="mt-4 grid gap-3">
                          <p className="font-bold"><strong>Empresa:</strong> {form.empresa_nome}</p>
                          <p className="font-bold"><strong>Tipo:</strong> {config.label}</p>
                          <p className="font-bold"><strong>Link:</strong> {publicLink}</p>
                          <p className="font-bold"><strong>Objetivo:</strong> {form.onboarding_goal}</p>
                          <p className="font-bold"><strong>Plano:</strong> {planoSelecionado.nome} • {planoSelecionado.preco}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {planos.map((plano) => (
                          <button key={plano.id} type="button" onClick={() => update('plano', plano.id)} className={`rounded-2xl border p-4 text-left transition ${form.plano === plano.id ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/8' : 'border-blue-100 bg-white hover:bg-[#f8fbff]'}`}>
                            {plano.destaque ? <p className="mb-2 inline-flex rounded-full bg-[#05245c] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">Mais escolhido</p> : null}
                            <p className="font-black">{plano.nome}</p>
                            <p className="mt-1 text-xl font-black text-[#05245c]">{plano.preco}</p>
                            <p className="mt-2 text-xs font-bold leading-5 text-[#607895]">{plano.descricao}</p>
                          </button>
                        ))}
                      </div>

                      <button disabled={loading} className="rounded-2xl bg-[#05245c] px-6 py-5 text-base font-black text-white shadow-xl shadow-[#05245c]/25 transition hover:bg-[#031a43] disabled:opacity-60">
                        {loading ? 'Criando sua estrutura...' : 'Criar minha estrutura'}
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={previousStep} disabled={step === 1 || loading} className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c] disabled:cursor-not-allowed disabled:opacity-40">
                      Voltar
                    </button>

                    {step < steps.length ? (
                      <button type="button" onClick={nextStep} disabled={loading} className="rounded-2xl bg-[#05245c] px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 disabled:opacity-60">
                        Continuar
                      </button>
                    ) : null}
                  </div>

                  <Link href="/login" className="mt-5 inline-flex w-full justify-center text-center text-sm font-black text-[#05245c]">
                    Já tenho conta
                  </Link>
                </form>
              </div>
            </section>

            <aside className="sticky top-6 h-fit rounded-[2.2rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">Prévia ao vivo</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">Sua estrutura inicial</h2>

              <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-blue-100 bg-[#05245c] text-white">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{form.empresa_nome || 'Sua empresa'}</p>
                      <p className="mt-1 break-all text-xs font-bold text-white/60">{publicLink}</p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black text-[#05245c]">
                      {(form.empresa_nome || 'O').slice(0, 1)}
                    </div>
                  </div>

                  <div className="mt-8 rounded-[1.5rem] bg-white p-4 text-[#061a36]">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#05245c]">{config.publicName}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">{config.siteHeadline}</h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-[#607895]">{config.siteSubheadline}</p>
                    <button type="button" className="mt-4 rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white">
                      {config.cta}
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/10 bg-white/8 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Exemplos do segmento</p>
                  <div className="mt-3 grid gap-2">
                    {config.defaultPreviewItems.map((item) => (
                      <div key={item} className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
                        <span className="font-black">{item}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">modelo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] bg-blue-50 p-4">
                <p className="font-black text-[#05245c]">O que será preparado</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {config.defaultFeatures.slice(0, 4).map((feature) => (
                    <span key={feature.titulo} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#05245c]">
                      {feature.titulo}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
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
