'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Product = {
  id: string
  nome: string
  preco: number
  descricao?: string
  categoria?: string
  tipo?: string
  unidade?: string
  imagem_url?: string | null
  image_urls?: string[]
  destaque?: boolean
  precificacao?: string
  unidade_label?: string
  permite_largura?: boolean
  permite_altura?: boolean
  permite_comprimento?: boolean
  permite_quantidade?: boolean
  valor_minimo?: number
  configuracoes?: any
  prazo_medio?: string | null
}

type CartItem = {
  product: Product
  quantidade: number
  largura?: number
  altura?: number
  comprimento?: number
  respostas: Record<string, string>
  opcoes_selecionadas: Record<string, string>
  observacoes?: string
}

function moeda(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cleanPhone(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function getSelectedOptions(product: Product, selections: Record<string, string> = {}) {
  const groups = Array.isArray(product.configuracoes?.opcoes) ? product.configuracoes.opcoes : []
  const selected: any[] = []

  groups.forEach((group: any) => {
    const id = selections[group.id]
    const value = Array.isArray(group.valores) ? group.valores.find((option: any) => option.id === id) : null
    if (value) selected.push({ group, value })
  })

  return selected
}

function calcItem(item: CartItem) {
  const product = item.product
  const quantidade = Math.max(1, Number(item.quantidade || 1))
  const preco = Number(product.preco || 0)
  const largura = Number(item.largura || 0)
  const altura = Number(item.altura || 0)
  const comprimento = Number(item.comprimento || 0)
  const valorMinimo = Number(product.valor_minimo || 0)

  let base = preco * quantidade

  if (product.precificacao === 'm2' || product.precificacao === 'metro_quadrado') {
    base = Math.max(0, largura) * Math.max(0, altura) * preco * quantidade
  }

  if (product.precificacao === 'metro_linear') {
    base = Math.max(largura, altura, comprimento, 0) * preco * quantidade
  }

  let ajustes = 0

  getSelectedOptions(product, item.opcoes_selecionadas).forEach(({ value }) => {
    const ajusteValor = Number(value.ajuste_valor || 0)
    if (value.ajuste_tipo === 'percentual') ajustes += base * (ajusteValor / 100)
    else ajustes += ajusteValor * quantidade
  })

  let subtotal = base + ajustes
  if (valorMinimo > 0 && subtotal < valorMinimo) subtotal = valorMinimo

  return subtotal
}

function getQuestions(company: any, product: Product) {
  const productQuestions = product.configuracoes?.perguntas
  if (Array.isArray(productQuestions) && productQuestions.length > 0) return productQuestions

  const companyQuestions = company?.modelo_perguntas
  if (Array.isArray(companyQuestions) && companyQuestions.length > 0) return companyQuestions

  return ['O que você precisa?', 'Qual prazo desejado?', 'Alguma observação importante?']
}

function getOptionGroups(product: Product) {
  return Array.isArray(product.configuracoes?.opcoes) ? product.configuracoes.opcoes : []
}

export default function SitePublicoEmpresaPage() {
  const params = useParams()
  const slugParam = params?.slug
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

  const [company, setCompany] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [sort, setSort] = useState('relevancia')
  const [activeTab, setActiveTab] = useState<'inicio' | 'loja' | 'sobre' | 'contato'>('inicio')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeImage, setActiveImage] = useState('')
  const [draft, setDraft] = useState<CartItem | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  const [cliente, setCliente] = useState({
    nome: '',
    telefone: '',
    email: '',
    empresa: '',
    endereco: '',
    observacoes: '',
  })

  async function loadSite() {
    if (!slug) return

    setLoading(true)
    setErro('')

    const res = await fetch(`/api/public-site/${encodeURIComponent(slug)}`)
    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Site não encontrado.')
      setLoading(false)
      return
    }

    setCompany(payload.company)
    setProducts(payload.products || [])
    setLoading(false)
  }

  useEffect(() => {
    loadSite()
  }, [slug])

  const primary = company?.site_primary_color || company?.cor_principal || '#05245c'
  const accent = company?.site_accent_color || '#22c55e'
  const bg = company?.site_background_color || '#f5f8ff'

  const categories = useMemo(() => {
    return ['Todos', ...Array.from(new Set(products.map((p) => p.categoria || 'Geral')))]
  }, [products])

  const filtered = useMemo(() => {
    let list = [...products]

    if (category !== 'Todos') list = list.filter((p) => (p.categoria || 'Geral') === category)

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        p.nome.toLowerCase().includes(q) ||
        String(p.descricao || '').toLowerCase().includes(q) ||
        String(p.categoria || '').toLowerCase().includes(q)
      )
    }

    if (sort === 'menor') list.sort((a, b) => Number(a.preco || 0) - Number(b.preco || 0))
    if (sort === 'maior') list.sort((a, b) => Number(b.preco || 0) - Number(a.preco || 0))
    if (sort === 'destaque') list.sort((a, b) => Number(b.destaque) - Number(a.destaque))

    return list
  }, [products, category, search, sort])

  const featured = useMemo(() => {
    const destacados = products.filter((p) => p.destaque)
    return destacados.length > 0 ? destacados.slice(0, 4) : products.slice(0, 4)
  }, [products])

  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + calcItem(item), 0), [cart])
  const pixValue = useMemo(() => {
    const percent = company?.cobrar_sinal ? Number(company?.percentual_sinal || 0) : 0
    return percent > 0 ? cartTotal * percent / 100 : cartTotal
  }, [cartTotal, company])

  function openProduct(product: Product) {
    const questions = getQuestions(company, product)
    const optionGroups = getOptionGroups(product)
    const defaultOptions: Record<string, string> = {}

    optionGroups.forEach((group: any) => {
      if (group.obrigatorio && Array.isArray(group.valores) && group.valores[0]) {
        defaultOptions[group.id] = group.valores[0].id
      }
    })

    setSelectedProduct(product)
    setActiveImage(product.image_urls?.[0] || product.imagem_url || '')
    setDraft({
      product,
      quantidade: 1,
      largura: product.permite_largura ? 1 : undefined,
      altura: product.permite_altura ? 1 : undefined,
      comprimento: product.permite_comprimento ? 1 : undefined,
      respostas: Object.fromEntries(questions.map((q: string) => [q, ''])),
      opcoes_selecionadas: defaultOptions,
      observacoes: '',
    })
  }

  function updateDraft(field: string, value: any) {
    setDraft((current) => current ? { ...current, [field]: value } : current)
  }

  function updateAnswer(question: string, value: string) {
    setDraft((current) => current ? { ...current, respostas: { ...current.respostas, [question]: value } } : current)
  }

  function updateOption(groupId: string, valueId: string) {
    setDraft((current) => current ? {
      ...current,
      opcoes_selecionadas: {
        ...current.opcoes_selecionadas,
        [groupId]: valueId,
      },
    } : current)
  }

  function addDraftToCart() {
    if (!draft) return
    setCart((current) => [...current, draft])
    setSelectedProduct(null)
    setDraft(null)
  }

  function removeCart(index: number) {
    setCart((current) => current.filter((_, i) => i !== index))
  }

  async function copyPix() {
    if (!orderResult?.pix_payload) return
    await navigator.clipboard.writeText(orderResult.pix_payload)
  }

  async function finishOrder() {
    setErro('')
    setOrderResult(null)

    if (!cliente.nome.trim() || cleanPhone(cliente.telefone).length < 10) {
      setErro('Informe nome e WhatsApp válido.')
      return
    }

    if (cart.length === 0) {
      setErro('Adicione pelo menos um item ao carrinho.')
      return
    }

    setSending(true)

    const res = await fetch('/api/marketplace/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: company.id,
        cliente,
        observacoes: cliente.observacoes,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantidade: item.quantidade,
          largura: item.largura,
          altura: item.altura,
          comprimento: item.comprimento,
          respostas: item.respostas,
          opcoes_selecionadas: item.opcoes_selecionadas,
          observacoes: item.observacoes,
        })),
      }),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao finalizar pedido.')
      setSending(false)
      return
    }

    setOrderResult(payload)
    setCart([])
    setCheckoutOpen(false)
    setActiveTab('loja')
    setSending(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: bg }}>
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando site...</div>
      </main>
    )
  }

  if (erro && !company) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4" style={{ background: bg }}>
        <div className="max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Site indisponível</h1>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
        </div>
      </main>
    )
  }

  const heroTitle = company?.site_headline || company?.marketplace_titulo || `${company?.nome} online`
  const heroSubtitle = company?.site_subheadline || company?.marketplace_subtitulo || 'Conheça a empresa, veja produtos e serviços, personalize seu pedido e fale direto pelo WhatsApp.'

  return (
    <main className="min-h-screen text-slate-950" style={{ background: bg, colorScheme: 'light' }}>
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur">
        <section className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.nome} className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl font-black text-white" style={{ background: primary }}>
                {String(company?.nome || 'O').slice(0, 1)}
              </div>
            )}

            <div>
              <h1 className="text-2xl font-black tracking-[-0.03em] text-[#071b3a]">{company?.nome}</h1>
              <p className="text-sm font-bold text-slate-500">{company?.segmento || company?.modelo_nome || 'Empresa'} {company?.cidade ? `• ${company.cidade}` : ''}</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto">
            {[
              ['inicio', 'Início', true],
              ['loja', 'Loja', company?.site_show_store !== false],
              ['sobre', 'Sobre', company?.site_show_about !== false],
              ['contato', 'Contato', company?.site_show_contact !== false],
            ].filter((item) => item[2]).map(([id, label]) => (
              <button
                key={String(id)}
                onClick={() => setActiveTab(id as any)}
                className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black ${activeTab === id ? 'text-white' : 'bg-[#f5f8ff] text-slate-600'}`}
                style={activeTab === id ? { background: primary } : undefined}
              >
                {label}
              </button>
            ))}
            <button onClick={() => setCheckoutOpen(true)} className="whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: primary }}>
              Carrinho • {cart.length}
            </button>
          </nav>
        </section>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'inicio' && (
          <div className="grid gap-6">
            <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl shadow-blue-950/8">
              <div className="relative min-h-[460px] p-6 sm:p-8 lg:p-10">
                {(company?.site_banner_url || company?.marketplace_banner_url) && (
                  <img src={company.site_banner_url || company.marketplace_banner_url} alt="Banner" className="absolute inset-0 h-full w-full object-cover opacity-20" />
                )}
                <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-100 blur-3xl" />
                <div className="absolute bottom-0 right-44 h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />

                <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                  <div>
                    <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">
                      Site oficial
                    </span>
                    <h2 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-6xl">
                      {heroTitle}
                    </h2>
                    <p className="mt-4 max-w-2xl font-bold leading-8 text-slate-500">
                      {heroSubtitle}
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button onClick={() => setActiveTab('loja')} className="rounded-2xl px-6 py-4 font-black text-white" style={{ background: primary }}>
                        {company?.site_cta_text || 'Ver loja'}
                      </button>
                      <button onClick={() => setActiveTab('contato')} className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-4 font-black text-[#05245c]">
                        Falar com a empresa
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-blue-100 bg-[#f8fbff] p-5">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Destaques</p>
                    <div className="mt-4 grid gap-3">
                      {(company.site_features?.length ? company.site_features : [
                        { titulo: 'Atendimento direto', texto: 'Envie seu pedido e fale com a empresa.' },
                        { titulo: 'Loja integrada', texto: 'Escolha produtos e serviços em poucos cliques.' },
                        { titulo: 'PIX rápido', texto: 'Pague com QR Code ou copia e cola quando disponível.' },
                      ]).slice(0, 4).map((feature: any, index: number) => (
                        <div key={index} className="rounded-2xl bg-white p-4">
                          <p className="font-black text-[#071b3a]">{feature.titulo || feature.title || 'Destaque'}</p>
                          <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{feature.texto || feature.description || ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {company?.site_show_featured !== false && (
              <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-blue-950/5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Loja</p>
                    <h2 className="mt-1 text-3xl font-black text-[#071b3a]">Produtos e serviços em destaque</h2>
                  </div>
                  <button onClick={() => setActiveTab('loja')} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Ver loja</button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {featured.map((product) => (
                    <button key={product.id} onClick={() => openProduct(product)} className="overflow-hidden rounded-2xl border border-blue-100 bg-white text-left shadow-lg shadow-blue-950/5">
                      <div className="aspect-[4/3] bg-[#f5f8ff]">
                        {(product.image_urls?.[0] || product.imagem_url) ? <img src={product.image_urls?.[0] || product.imagem_url || ''} alt={product.nome} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="p-4">
                        <p className="line-clamp-2 font-black">{product.nome}</p>
                        <p className="mt-2 text-xl font-black text-[#05245c]">{moeda(product.preco)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'sobre' && (
          <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[2.5rem] bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Sobre</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#071b3a]">{company?.site_about_title || `Sobre ${company?.nome}`}</h2>
              <p className="mt-5 max-w-3xl whitespace-pre-line font-bold leading-8 text-slate-500">
                {company?.site_about_text || company?.marketplace_sobre || 'Esta empresa ainda não adicionou uma descrição pública. Mesmo assim, a loja já está disponível para pedidos e orçamentos.'}
              </p>
            </div>

            <div className="rounded-[2.5rem] bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Informações</p>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Segmento</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.segmento || company?.modelo_nome || 'Não informado'}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Cidade</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.cidade ? `${company.cidade}/${company.estado || ''}` : 'Não informado'}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Atendimento</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.atendimento_horario || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'contato' && (
          <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[2.5rem] bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Contato</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[#071b3a]">{company?.site_contact_title || 'Fale com a empresa'}</h2>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">WhatsApp</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.whatsapp || 'Não informado'}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Instagram</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.instagram || 'Não informado'}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Endereço</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{company?.marketplace_endereco || 'Não informado'}</p>
                </div>
              </div>

              {company?.whatsapp && (
                <a href={`https://wa.me/${String(company.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-2xl px-5 py-4 font-black text-white" style={{ background: primary }}>
                  Chamar no WhatsApp
                </a>
              )}
            </div>

            <div className="rounded-[2.5rem] bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Observações</p>
              <p className="mt-4 whitespace-pre-line font-bold leading-8 text-slate-500">
                {company?.atendimento_observacao || company?.marketplace_termos || 'Envie seu pedido pela loja e a empresa entrará em contato para confirmar os detalhes.'}
              </p>
              {company?.marketplace_mapa_url && (
                <a href={company.marketplace_mapa_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-2xl px-5 py-4 font-black text-white" style={{ background: primary }}>
                  Abrir localização
                </a>
              )}
            </div>
          </section>
        )}

        {activeTab === 'loja' && (
          <>
            <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl shadow-blue-950/8">
              <div className="relative p-6 sm:p-8 lg:p-10">
                <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-100 blur-3xl" />
                <div className="absolute bottom-0 right-44 h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />

                <div className="relative">
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">
                    Loja integrada
                  </span>
                  <h2 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">
                    {company?.marketplace_titulo || 'Escolha, personalize e envie seu pedido.'}
                  </h2>
                  <p className="mt-4 max-w-2xl font-bold leading-7 text-slate-500">
                    {company?.marketplace_subtitulo || 'Selecione produtos e serviços, escolha opcionais e finalize com PIX quando disponível.'}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto, serviço ou categoria" className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-5 py-4 font-bold outline-none focus:border-[#05245c]" />
                    <button className="rounded-2xl px-6 py-4 font-black text-white" style={{ background: primary }}>Buscar</button>
                  </div>
                </div>
              </div>
            </div>

            {orderResult && (
              <div className="mt-6 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 shadow-xl shadow-emerald-950/5">
                <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Pedido recebido</p>
                    <h2 className="mt-2 text-3xl font-black text-emerald-900">Seu pedido foi enviado.</h2>
                    <p className="mt-2 font-bold text-emerald-800">Total: {moeda(orderResult.total)} • Pagamento: {orderResult.forma_pagamento}</p>
                    {orderResult.valor_sinal > 0 && <p className="mt-1 font-bold text-emerald-800">Sinal para confirmar: {moeda(orderResult.valor_pix)}</p>}
                    {orderResult.pix_payload && (
                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <p className="font-black text-[#071b3a]">PIX copia e cola</p>
                        <textarea readOnly value={orderResult.pix_payload} className="mt-3 h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold outline-none" />
                        <button onClick={copyPix} className="mt-3 rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white">Copiar PIX</button>
                      </div>
                    )}
                  </div>

                  {orderResult.pix_payload && (
                    <div className="rounded-[2rem] bg-white p-5 text-center">
                      <img alt="QR Code Pix" className="mx-auto h-56 w-56 rounded-2xl" src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(orderResult.pix_payload)}`} />
                      <p className="mt-3 text-sm font-bold text-slate-500">Escaneie o QR Code para pagar.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {erro && <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

            <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
              <aside className="h-fit rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 lg:sticky lg:top-24">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Categorias</p>
                <div className="mt-4 grid gap-2">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setCategory(cat)} className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${category === cat ? 'text-white' : 'bg-[#f5f8ff] text-slate-600 hover:bg-blue-50'}`} style={category === cat ? { background: primary } : undefined}>{cat}</button>
                  ))}
                </div>

                <div className="mt-5">
                  <p className="text-sm font-black text-slate-700">Ordenar</p>
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none">
                    <option value="relevancia">Relevância</option>
                    <option value="destaque">Destaques</option>
                    <option value="menor">Menor preço</option>
                    <option value="maior">Maior preço</option>
                  </select>
                </div>

                <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black text-[#071b3a]">Carrinho</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{cart.length} item(ns)</p>
                  <p className="mt-3 text-2xl font-black text-[#05245c]">{moeda(cartTotal)}</p>
                  <button onClick={() => setCheckoutOpen(true)} className="mt-4 w-full rounded-2xl px-4 py-3 font-black text-white" style={{ background: primary }}>Finalizar</button>
                </div>
              </aside>

              <section>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Catálogo</p>
                    <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{filtered.length} opções</h2>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((product) => (
                    <article key={product.id} className="group overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl">
                      <div className="relative aspect-[4/3] bg-[#f5f8ff]">
                        {(product.image_urls?.[0] || product.imagem_url) ? (
                          <img src={product.image_urls?.[0] || product.imagem_url || ''} alt={product.nome} className="h-full w-full object-cover transition group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-5xl font-black text-blue-100">{product.nome.slice(0, 1)}</div>
                        )}
                        {product.destaque && <span className="absolute left-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-yellow-950">Destaque</span>}
                      </div>

                      <div className="p-5">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{product.categoria || 'Geral'}</p>
                        <h3 className="mt-2 line-clamp-2 text-xl font-black text-[#071b3a]">{product.nome}</h3>
                        <p className="mt-2 line-clamp-2 min-h-[44px] text-sm font-bold leading-6 text-slate-500">{product.descricao || 'Informe os detalhes no pedido para receber o atendimento correto.'}</p>
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-400">A partir de</p>
                            <p className="text-2xl font-black text-[#05245c]">{moeda(product.preco)}</p>
                            <p className="text-xs font-bold text-slate-400">por {product.unidade_label || product.unidade || 'unidade'}</p>
                          </div>
                          <button onClick={() => openProduct(product)} className="rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: primary }}>Adicionar</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </section>

      {selectedProduct && draft && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section>
                <div className="aspect-square overflow-hidden rounded-[2rem] bg-[#f5f8ff]">
                  {activeImage ? <img src={activeImage} alt={selectedProduct.nome} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {(selectedProduct.image_urls || []).slice(0, 4).map((url) => (
                    <button key={url} onClick={() => setActiveImage(url)} className={`aspect-square overflow-hidden rounded-xl border ${activeImage === url ? 'border-[#05245c]' : 'border-slate-200'}`}>
                      <img src={url} alt="Foto" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">{selectedProduct.categoria || 'Item'}</p>
                    <h2 className="mt-1 text-2xl font-black text-[#071b3a]">{selectedProduct.nome}</h2>
                    <p className="mt-2 font-bold text-slate-500">{selectedProduct.descricao}</p>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-600">X</button>
                </div>

                <div className="mt-5 grid gap-4">
                  {selectedProduct.permite_quantidade !== false && (
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Quantidade</span>
                      <input type="number" min={1} value={draft.quantidade} onChange={(e) => updateDraft('quantidade', Number(e.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                    </label>
                  )}

                  {getOptionGroups(selectedProduct).map((group: any) => (
                    <div key={group.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                      <p className="font-black text-[#071b3a]">{group.nome} {group.obrigatorio && <span className="text-red-600">*</span>}</p>
                      <div className="mt-3 grid gap-2">
                        {(group.valores || []).map((option: any) => (
                          <label key={option.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white p-3">
                            <div className="flex items-center gap-3">
                              <input type="radio" name={group.id} checked={draft.opcoes_selecionadas[group.id] === option.id} onChange={() => updateOption(group.id, option.id)} />
                              <span className="font-bold text-slate-700">{option.nome}</span>
                            </div>
                            <span className="text-sm font-black text-[#05245c]">
                              {Number(option.ajuste_valor || 0) === 0 ? 'incluído' : option.ajuste_tipo === 'percentual' ? `+${option.ajuste_valor}%` : `+ ${moeda(option.ajuste_valor)}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="grid gap-4 sm:grid-cols-3">
                    {selectedProduct.permite_largura && <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Largura/m</span><input value={draft.largura || ''} onChange={(e) => updateDraft('largura', Number(e.target.value.replace(',', '.')))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" /></label>}
                    {selectedProduct.permite_altura && <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Altura/m</span><input value={draft.altura || ''} onChange={(e) => updateDraft('altura', Number(e.target.value.replace(',', '.')))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" /></label>}
                    {selectedProduct.permite_comprimento && <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Comprimento/m</span><input value={draft.comprimento || ''} onChange={(e) => updateDraft('comprimento', Number(e.target.value.replace(',', '.')))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" /></label>}
                  </div>

                  {Object.keys(draft.respostas).map((question) => (
                    <label key={question} className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">{question}</span>
                      <input value={draft.respostas[question]} onChange={(e) => updateAnswer(question, e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                    </label>
                  ))}

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Observações deste item</span>
                    <textarea value={draft.observacoes || ''} onChange={(e) => updateDraft('observacoes', e.target.value)} rows={3} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                  </label>

                  <div className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="text-sm font-bold text-slate-500">Subtotal estimado</p>
                    <p className="text-3xl font-black text-[#05245c]">{moeda(calcItem(draft))}</p>
                  </div>

                  <button onClick={addDraftToCart} className="rounded-2xl px-5 py-4 font-black text-white" style={{ background: primary }}>Adicionar ao carrinho</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Finalizar pedido</p>
                <h2 className="mt-1 text-3xl font-black text-[#071b3a]">Carrinho</h2>
              </div>
              <button onClick={() => setCheckoutOpen(false)} className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-600">X</button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <section className="grid gap-3">
                {cart.map((item, index) => (
                  <article key={`${item.product.id}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#071b3a]">{item.product.nome}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">Qtd: {item.quantidade} • {moeda(calcItem(item))}</p>
                        {getSelectedOptions(item.product, item.opcoes_selecionadas).length > 0 && (
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {getSelectedOptions(item.product, item.opcoes_selecionadas).map(({ group, value }: any) => `${group.nome}: ${value.nome}`).join(' • ')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => removeCart(index)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Remover</button>
                    </div>
                  </article>
                ))}

                {cart.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-4 font-bold text-slate-500">Carrinho vazio.</p>}
              </section>

              <section className="rounded-[2rem] bg-[#f5f8ff] p-5">
                <p className="text-xl font-black text-[#071b3a]">Seus dados</p>
                <div className="mt-4 grid gap-3">
                  <input value={cliente.nome} onChange={(e) => setCliente((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                  <input value={cliente.telefone} onChange={(e) => setCliente((v) => ({ ...v, telefone: e.target.value }))} placeholder="WhatsApp" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                  <input value={cliente.email} onChange={(e) => setCliente((v) => ({ ...v, email: e.target.value }))} placeholder="E-mail opcional" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                  <input value={cliente.empresa} onChange={(e) => setCliente((v) => ({ ...v, empresa: e.target.value }))} placeholder="Empresa opcional" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                  <input value={cliente.endereco} onChange={(e) => setCliente((v) => ({ ...v, endereco: e.target.value }))} placeholder="Endereço/retirada opcional" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                  <textarea value={cliente.observacoes} onChange={(e) => setCliente((v) => ({ ...v, observacoes: e.target.value }))} placeholder="Observações gerais" rows={3} className="resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-sm font-bold text-slate-500">Total estimado</p>
                  <p className="text-3xl font-black text-[#05245c]">{moeda(cartTotal)}</p>
                  {company?.cobrar_sinal && <p className="mt-2 text-sm font-bold text-slate-500">PIX para confirmar: {moeda(pixValue)}</p>}
                </div>

                <button disabled={sending || cart.length === 0} onClick={finishOrder} className="mt-4 w-full rounded-2xl px-5 py-4 font-black text-white disabled:opacity-60" style={{ background: primary }}>
                  {sending ? 'Enviando...' : 'Enviar pedido e gerar PIX'}
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
