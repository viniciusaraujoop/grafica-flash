'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  whatsapp: string | null
  cor_principal: string | null
  cidade: string | null
  estado: string | null
  segmento: string | null
  modelo_negocio: string | null
  modelo_nome: string | null
  modelo_perguntas: string[] | null
}

type Produto = {
  id: string
  company_id: string
  nome: string
  preco: number | null
  categoria: string | null
  descricao: string | null
  imagem_url: string | null
  image_urls: string[] | null
  variacoes: string | null
  prazo_medio: string | null
  destaque: boolean | null
  ativo: boolean | null
}

type CarrinhoItem = {
  id: string
  produto: Produto
  quantidade: number
  respostas: Record<string, string>
}

const perguntasFallback = [
  'O que você precisa?',
  'Quantidade',
  'Prazo desejado',
  'Detalhes importantes',
  'Observação',
]

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function limparTelefone(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

function whatsappLink(numero: string | null | undefined, texto: string) {
  const limpo = limparTelefone(numero)
  if (!limpo) return ''
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

function precoProduto(produto: Produto) {
  return Number(produto.preco || 0)
}

function imagensProduto(produto: Produto) {
  if (produto.image_urls?.length) return produto.image_urls.slice(0, 4)
  if (produto.imagem_url) return [produto.imagem_url]
  return []
}

function limparPerguntas(perguntas: string[] | null | undefined) {
  const lista = (perguntas || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return lista.length > 0 ? lista : perguntasFallback
}

export default function LojaPublicaPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')
  const [ordenacao, setOrdenacao] = useState('destaques')
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [quantidade, setQuantidade] = useState(1)
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([])
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregar() {
      if (!slug) return

      setCarregando(true)
      setErro('')

      try {
        const { data: empresaData, error: empresaError } = await supabase
          .from('public_company_profiles')
          .select('id, nome, slug, logo_url, whatsapp, cor_principal, cidade, estado, segmento, modelo_negocio, modelo_nome, modelo_perguntas')
          .eq('slug', slug)
          .eq('ativo', true)
          .maybeSingle()

        if (empresaError) throw empresaError

        if (!empresaData) {
          setErro('Loja não encontrada ou indisponível.')
          setCarregando(false)
          return
        }

        const empresaAtual = empresaData as Empresa
        setEmpresa(empresaAtual)

        const { data: produtosData, error: produtosError } = await supabase
          .from('public_store_products')
          .select('id, company_id, nome, preco, categoria, descricao, imagem_url, image_urls, variacoes, prazo_medio, destaque, ativo')
          .eq('company_id', empresaAtual.id)
          .eq('ativo', true)
          .order('destaque', { ascending: false })

        if (produtosError) throw produtosError

        setProdutos((produtosData || []) as Produto[])
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar loja.')
      }

      setCarregando(false)
    }

    carregar()
  }, [slug])

  const perguntasDoModelo = useMemo(() => limparPerguntas(empresa?.modelo_perguntas), [empresa])

  const categorias = useMemo(() => {
    return ['Todos', ...Array.from(new Set(produtos.map((p) => p.categoria || 'Outros')))]
  }, [produtos])

  const produtosFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase()

    let lista = produtos.filter((produto) => {
      const categoria = produto.categoria || 'Outros'
      const bateCategoria = categoriaAtiva === 'Todos' || categoriaAtiva === categoria
      const conteudo = `${produto.nome} ${produto.descricao || ''} ${produto.categoria || ''}`.toLowerCase()
      return bateCategoria && (!texto || conteudo.includes(texto))
    })

    if (ordenacao === 'menor-preco') lista = [...lista].sort((a, b) => precoProduto(a) - precoProduto(b))
    if (ordenacao === 'maior-preco') lista = [...lista].sort((a, b) => precoProduto(b) - precoProduto(a))
    if (ordenacao === 'destaques') lista = [...lista].sort((a, b) => Number(b.destaque) - Number(a.destaque))

    return lista
  }, [busca, categoriaAtiva, ordenacao, produtos])

  const total = useMemo(() => {
    return carrinho.reduce((soma, item) => soma + precoProduto(item.produto) * item.quantidade, 0)
  }, [carrinho])

  const quantidadeItens = useMemo(() => {
    return carrinho.reduce((soma, item) => soma + item.quantidade, 0)
  }, [carrinho])

  function abrirConfigurador(produto: Produto) {
    setProdutoAberto(produto)
    setQuantidade(1)

    const respostasIniciais: Record<string, string> = {}
    perguntasDoModelo.forEach((pergunta) => {
      if (pergunta.toLowerCase().includes('quantidade')) respostasIniciais[pergunta] = '1'
    })

    setRespostas(respostasIniciais)
  }

  function adicionarConfigurado() {
    if (!produtoAberto) return

    setCarrinho((atual) => [
      ...atual,
      {
        id: `${produtoAberto.id}-${Date.now()}`,
        produto: produtoAberto,
        quantidade,
        respostas,
      },
    ])

    setProdutoAberto(null)
    setRespostas({})
    setQuantidade(1)
  }

  function removerItem(id: string) {
    setCarrinho((atual) => atual.filter((item) => item.id !== id))
  }

  async function enviarPedido() {
    if (!empresa) return

    if (carrinho.length === 0) {
      alert('Adicione pelo menos um item.')
      return
    }

    if (!nomeCliente.trim()) {
      alert('Informe seu nome.')
      return
    }

    if (!telefoneCliente.trim()) {
      alert('Informe seu WhatsApp.')
      return
    }

    setEnviando(true)
    setMensagem('Enviando solicitação...')

    const resumoItens = carrinho.map((item) => `${item.quantidade}x ${item.produto.nome}`).join(', ')

    const linhasItens = carrinho
      .map((item) => {
        const detalhes = Object.entries(item.respostas)
          .filter(([, valor]) => valor)
          .map(([chave, valor]) => `  - ${chave}: ${valor}`)
          .join('\n')

        return `${item.quantidade}x ${item.produto.nome}${detalhes ? `\n${detalhes}` : ''}`
      })
      .join('\n\n')

    const textoWhatsApp = [
      `Olá, ${empresa.nome}!`,
      '',
      'Montei uma solicitação pela loja:',
      '',
      linhasItens,
      '',
      `Valor estimado: ${moeda(total)}`,
      `Cliente: ${nomeCliente}`,
      `WhatsApp: ${telefoneCliente}`,
      observacao ? `Observação geral: ${observacao}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('orders')
        .insert({
          company_id: empresa.id,
          nome: nomeCliente.trim(),
          telefone: telefoneCliente.trim(),
          produto: resumoItens,
          observacoes: observacao.trim() || null,
          status: 'Recebido',
          valor_total: total,
          preco_estimado: total,
          itens_resumo: resumoItens,
          dados_inteligentes: {
            origem: 'loja_publica',
            modelo_negocio: empresa.modelo_negocio,
            modelo_nome: empresa.modelo_nome,
            perguntas_modelo: perguntasDoModelo,
            itens: carrinho.map((item) => ({
              produto_id: item.produto.id,
              produto: item.produto.nome,
              quantidade: item.quantidade,
              respostas: item.respostas,
            })),
          },
        })
        .select('id')
        .single()

      if (pedidoError) throw pedidoError

      const itensPedido = carrinho.map((item) => ({
        order_id: pedidoData.id,
        company_id: empresa.id,
        product_id: item.produto.id,
        nome: item.produto.nome,
        tipo: 'produto',
        unidade: 'unidade',
        quantidade: item.quantidade,
        preco_unitario: precoProduto(item.produto),
        subtotal: precoProduto(item.produto) * item.quantidade,
        respostas: item.respostas,
        detalhes_calculo: JSON.stringify(item.respostas),
      }))

      const { error: itensError } = await supabase.from('order_items').insert(itensPedido)
      if (itensError) throw itensError

      setMensagem('Solicitação enviada. Abrindo WhatsApp...')
      setCarrinho([])
      setNomeCliente('')
      setTelefoneCliente('')
      setObservacao('')

      const link = whatsappLink(empresa.whatsapp, textoWhatsApp)
      if (link) window.open(link, '_blank')
    } catch (error) {
      setMensagem(error instanceof Error ? `Erro: ${error.message}` : 'Erro ao enviar solicitação.')
    }

    setEnviando(false)
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <p className="text-3xl font-black text-[#071b3a]">Carregando loja...</p>
        </div>
      </main>
    )
  }

  if (erro || !empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <p className="text-3xl font-black text-[#071b3a]">Loja indisponível</p>
          <p className="mt-3 font-bold text-slate-500">{erro}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-220px] top-[-220px] h-[520px] w-[520px] rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute right-[-180px] top-[90px] h-[460px] w-[460px] rounded-full bg-cyan-100 blur-3xl" />
        </div>

        <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-blue-950/5">
              {empresa.logo_url ? (
                <img src={empresa.logo_url} alt={empresa.nome} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-[#05245c]">{empresa.nome.slice(0, 1)}</span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-[#071b3a]">{empresa.nome}</h1>
              <p className="truncate text-sm font-bold text-slate-500">
                {empresa.modelo_nome || empresa.segmento || 'Loja online'} {empresa.cidade ? `• ${empresa.cidade}` : ''}
              </p>
            </div>
          </div>

          <a
            href={whatsappLink(empresa.whatsapp, `Olá, ${empresa.nome}! Vim pela loja online.`)}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-700 sm:block"
          >
            WhatsApp
          </a>
        </header>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:pb-14">
          <div>
            <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-black text-[#05245c]">
              Loja adaptada para {empresa.modelo_nome || 'seu tipo de negócio'}
            </div>

            <h2 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-[#071b3a] sm:text-6xl">
              Monte seu pedido do jeito certo.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Escolha os itens, responda perguntas específicas do serviço e envie tudo organizado para a empresa montar uma proposta clara.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">01</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Escolha</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Produto ou serviço.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">02</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Configure</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Responda as perguntas certas.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">03</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Receba</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Proposta pelo WhatsApp.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-[#05245c] p-5 text-white shadow-2xl shadow-blue-950/20">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-100">Pedido inteligente</p>
            <h3 className="mt-3 text-4xl font-black">{empresa.modelo_nome || 'Modelo personalizado'}</h3>
            <p className="mt-3 leading-7 text-blue-100">As perguntas abaixo são usadas para deixar seu pedido completo.</p>

            <div className="mt-6 grid gap-2">
              {perguntasDoModelo.slice(0, 7).map((pergunta) => (
                <div key={pergunta} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">
                  {pergunta}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm shadow-blue-950/5 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_220px_190px] lg:items-center">
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar produto, categoria ou descrição..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
          />

          <select
            value={ordenacao}
            onChange={(evento) => setOrdenacao(evento.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-black text-[#05245c] outline-none"
          >
            <option value="destaques">Destaques</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
          </select>

          <button
            type="button"
            onClick={() => document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth' })}
            className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]"
          >
            Pedido: {quantidadeItens}
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1">
          {categorias.map((categoria) => (
            <button
              key={categoria}
              type="button"
              onClick={() => setCategoriaAtiva(categoria)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                categoriaAtiva === categoria
                  ? 'bg-[#05245c] text-white'
                  : 'border border-slate-200 bg-white text-[#05245c] hover:bg-blue-50'
              }`}
            >
              {categoria}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_390px] lg:px-8">
        <div>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#05245c]">Catálogo</p>
              <h2 className="mt-2 text-4xl font-black text-[#071b3a]">Produtos disponíveis</h2>
            </div>

            <p className="font-bold text-slate-500">{produtosFiltrados.length} resultados</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {produtosFiltrados.map((produto) => {
              const imagens = imagensProduto(produto)
              const imagem = imagens[0]

              return (
                <article key={produto.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {imagem ? (
                      <img src={imagem} alt={produto.nome} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl font-black text-[#05245c]">
                        {produto.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    {produto.destaque && (
                      <span className="absolute left-4 top-4 rounded-full bg-[#05245c] px-4 py-2 text-xs font-black text-white">
                        Destaque
                      </span>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-2xl font-black text-[#071b3a]">{produto.nome}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{produto.categoria || 'Produto'}</p>

                    {produto.descricao && (
                      <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{produto.descricao}</p>
                    )}

                    <div className="mt-4 grid gap-2 text-sm font-bold text-slate-500">
                      {produto.variacoes && <p>Variações: {produto.variacoes}</p>}
                      {produto.prazo_medio && <p>Prazo médio: {produto.prazo_medio}</p>}
                    </div>

                    <p className="mt-4 text-3xl font-black text-[#05245c]">
                      A partir de {moeda(precoProduto(produto))}
                    </p>

                    <button type="button" onClick={() => abrirConfigurador(produto)} className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]">
                      Configurar pedido
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <aside id="pedido" className="h-fit rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-blue-950/10 lg:sticky lg:top-28">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Pedido</p>
          <h2 className="mt-2 text-3xl font-black text-[#071b3a]">Sua solicitação</h2>

          {mensagem && <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">{mensagem}</div>}

          <div className="mt-5 grid gap-3">
            {carrinho.length === 0 && (
              <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-6 text-center">
                <p className="font-black text-[#071b3a]">Nenhum item ainda</p>
                <p className="mt-2 text-sm font-bold text-slate-500">Configure produtos para enviar sua solicitação.</p>
              </div>
            )}

            {carrinho.map((item) => (
              <div key={item.id} className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#071b3a]">{item.produto.nome}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {item.quantidade}x • {moeda(precoProduto(item.produto))}
                    </p>
                  </div>

                  <button type="button" onClick={() => removerItem(item.id)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-600">
                    Remover
                  </button>
                </div>

                {Object.entries(item.respostas).filter(([, valor]) => valor).length > 0 && (
                  <div className="mt-3 grid gap-1 text-xs font-bold text-slate-600">
                    {Object.entries(item.respostas)
                      .filter(([, valor]) => valor)
                      .slice(0, 4)
                      .map(([chave, valor]) => (
                        <p key={chave}>{chave}: {valor}</p>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl bg-[#05245c] p-5 text-white">
            <p className="text-sm font-bold text-blue-100">Valor estimado</p>
            <p className="mt-1 text-4xl font-black">{moeda(total)}</p>
            <p className="mt-2 text-xs font-bold text-blue-100">O valor final pode variar conforme detalhes e prazo.</p>
          </div>

          <div className="mt-5 grid gap-3">
            <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Seu nome" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
            <input value={telefoneCliente} onChange={(e) => setTelefoneCliente(e.target.value)} placeholder="Seu WhatsApp" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação geral, prazo desejado ou dúvidas" rows={4} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
            <button type="button" disabled={enviando} onClick={enviarPedido} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:opacity-60">
              {enviando ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </div>
        </aside>
      </section>

      {produtoAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur sm:items-center">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Configurar pedido</p>
                <h3 className="mt-2 text-3xl font-black text-[#071b3a]">{produtoAberto.nome}</h3>
                <p className="mt-2 font-bold text-slate-500">
                  Perguntas adaptadas para {empresa.modelo_nome || 'este tipo de negócio'}.
                </p>
              </div>

              <button type="button" onClick={() => setProdutoAberto(null)} className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-600">
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="overflow-hidden rounded-3xl bg-slate-100">
                {imagensProduto(produtoAberto)[0] ? (
                  <img src={imagensProduto(produtoAberto)[0]} alt={produtoAberto.nome} className="h-full min-h-72 w-full object-cover" />
                ) : (
                  <div className="flex min-h-72 items-center justify-center text-5xl font-black text-[#05245c]">
                    {produtoAberto.nome.slice(0, 2)}
                  </div>
                )}

                <div className="bg-[#05245c] p-4 text-white">
                  <p className="text-sm font-bold text-blue-100">Estimativa</p>
                  <p className="text-3xl font-black">{moeda(precoProduto(produtoAberto) * quantidade)}</p>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Quantidade</span>
                  <input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value || 1)))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </label>

                {perguntasDoModelo.map((pergunta) => (
                  <label key={pergunta} className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">{pergunta}</span>
                    <input value={respostas[pergunta] || ''} onChange={(e) => setRespostas((atual) => ({ ...atual, [pergunta]: e.target.value }))} placeholder={`Informe: ${pergunta}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setProdutoAberto(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>

              <button type="button" onClick={adicionarConfigurado} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]">
                Adicionar ao pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
