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
}

type Produto = {
  id: string
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
  produto: Produto
  quantidade: number
}

function t(texto: string) {
  return texto
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function telefoneLimpo(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

function criarLinkWhatsapp(numero: string | null | undefined, texto: string) {
  const limpo = telefoneLimpo(numero)

  if (!limpo) return ''

  const final = limpo.startsWith('55') ? limpo : `55${limpo}`

  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

function obterImagem(produto: Produto) {
  if (produto.image_urls && produto.image_urls.length > 0) return produto.image_urls[0]

  return produto.imagem_url || ''
}

function obterImagens(produto: Produto) {
  if (produto.image_urls && produto.image_urls.length > 0) return produto.image_urls.slice(0, 4)
  if (produto.imagem_url) return [produto.imagem_url]

  return []
}

function obterPreco(produto: Produto) {
  return Number(produto.preco || 0)
}

export default function LojaPublicaPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')
  const [ordenacao, setOrdenacao] = useState('destaques')
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([])
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregarLoja() {
      setCarregando(true)
      setErro('')

      try {
        const { data: empresaData, error: empresaError } = await supabase
          .from('companies')
          .select('id, nome, slug, logo_url, whatsapp, cor_principal, cidade, estado, segmento')
          .eq('slug', slug)
          .eq('ativo', true)
          .maybeSingle()

        if (empresaError) throw empresaError

        if (!empresaData) {
          setErro(t('Loja não encontrada ou indisponível.'))
          setCarregando(false)
          return
        }

        const empresaAtual = empresaData as Empresa
        setEmpresa(empresaAtual)

        const { data: produtosData, error: produtosError } = await supabase
          .from('products')
          .select('id, nome, preco, categoria, descricao, imagem_url, image_urls, variacoes, prazo_medio, destaque, ativo')
          .eq('company_id', empresaAtual.id)
          .eq('ativo', true)
          .order('destaque', { ascending: false })
          .order('created_at', { ascending: false })

        if (produtosError) throw produtosError

        setProdutos((produtosData || []) as Produto[])
      } catch (error) {
        const texto = error instanceof Error ? error.message : t('Erro desconhecido ao carregar loja.')
        setErro(texto)
      }

      setCarregando(false)
    }

    if (slug) carregarLoja()
  }, [slug])

  const categorias = useMemo(() => {
    const lista = produtos.map((produto) => produto.categoria || 'Outros').filter(Boolean)
    return ['Todos', ...Array.from(new Set(lista))]
  }, [produtos])

  const produtosFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase()

    let lista = produtos.filter((produto) => {
      const categoria = produto.categoria || 'Outros'
      const bateCategoria = categoriaAtiva === 'Todos' || categoria === categoriaAtiva
      const conteudo = `${produto.nome} ${produto.descricao || ''} ${produto.categoria || ''}`.toLowerCase()
      const bateBusca = !texto || conteudo.includes(texto)

      return bateCategoria && bateBusca
    })

    if (ordenacao === 'menor-preco') lista = [...lista].sort((a, b) => obterPreco(a) - obterPreco(b))
    if (ordenacao === 'maior-preco') lista = [...lista].sort((a, b) => obterPreco(b) - obterPreco(a))
    if (ordenacao === 'destaques') lista = [...lista].sort((a, b) => Number(b.destaque) - Number(a.destaque))

    return lista
  }, [busca, categoriaAtiva, ordenacao, produtos])

  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((total, item) => total + obterPreco(item.produto) * item.quantidade, 0)
  }, [carrinho])

  const quantidadeCarrinho = useMemo(() => {
    return carrinho.reduce((total, item) => total + item.quantidade, 0)
  }, [carrinho])

  const produtoDestaque = produtos.find((produto) => produto.destaque) || produtos[0]
  const cor = empresa?.cor_principal || '#05245c'

  function adicionarProduto(produto: Produto) {
    setCarrinho((atual) => {
      const existe = atual.find((item) => item.produto.id === produto.id)

      if (existe) {
        return atual.map((item) => {
          if (item.produto.id === produto.id) {
            return { ...item, quantidade: item.quantidade + 1 }
          }

          return item
        })
      }

      return [...atual, { produto, quantidade: 1 }]
    })
  }

  function alterarQuantidade(produtoId: string, quantidade: number) {
    setCarrinho((atual) => {
      if (quantidade <= 0) return atual.filter((item) => item.produto.id !== produtoId)

      return atual.map((item) => {
        if (item.produto.id === produtoId) return { ...item, quantidade }

        return item
      })
    })
  }

  async function enviarPedido() {
    if (!empresa) return

    if (carrinho.length === 0) {
      alert(t('Adicione pelo menos um item.'))
      return
    }

    if (!nomeCliente.trim()) {
      alert(t('Informe seu nome.'))
      return
    }

    if (!telefoneCliente.trim()) {
      alert(t('Informe seu WhatsApp.'))
      return
    }

    setEnviando(true)
    setMensagem(t('Enviando pedido...'))

    const resumoItens = carrinho
      .map((item) => `${item.quantidade}x ${item.produto.nome}`)
      .join(', ')

    const textoWhatsApp = [
      `Olá, ${empresa.nome}!`,
      '',
      'Montei uma solicitação pela loja:',
      resumoItens,
      '',
      `Valor estimado: ${formatarMoeda(totalCarrinho)}`,
      `Cliente: ${nomeCliente}`,
      `WhatsApp: ${telefoneCliente}`,
      observacao ? `Observação: ${observacao}` : '',
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
          valor_total: totalCarrinho,
          preco_estimado: totalCarrinho,
          itens_resumo: resumoItens,
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
        preco_unitario: obterPreco(item.produto),
        subtotal: obterPreco(item.produto) * item.quantidade,
      }))

      if (itensPedido.length > 0) {
        const { error: itensError } = await supabase.from('order_items').insert(itensPedido)
        if (itensError) throw itensError
      }

      setMensagem(t('Pedido enviado. Abrindo WhatsApp...'))
      setCarrinho([])
      setNomeCliente('')
      setTelefoneCliente('')
      setObservacao('')

      const whatsapp = criarLinkWhatsapp(empresa.whatsapp, textoWhatsApp)
      if (whatsapp) window.open(whatsapp, '_blank')
    } catch (error) {
      const texto = error instanceof Error ? error.message : t('Erro ao enviar pedido.')
      setMensagem(`Erro: ${texto}`)
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
      <style jsx global>{`
        @keyframes lojaFadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .loja-card {
          animation: lojaFadeUp .45s ease both;
        }
      `}</style>

      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-220px] top-[-220px] h-[520px] w-[520px] rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute right-[-180px] top-[90px] h-[460px] w-[460px] rounded-full bg-cyan-100 blur-3xl" />
          <div className="absolute bottom-[-220px] left-[35%] h-[440px] w-[440px] rounded-full bg-slate-100 blur-3xl" />
        </div>

        <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-blue-950/5">
              {empresa.logo_url ? (
                <img src={empresa.logo_url} alt={empresa.nome} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black" style={{ color: cor }}>
                  {empresa.nome.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-[#071b3a]">{empresa.nome}</h1>
              <p className="truncate text-sm font-bold text-slate-500">
                {empresa.segmento || 'Loja online'} {empresa.cidade ? `• ${empresa.cidade}` : ''}
              </p>
            </div>
          </div>

          <a
            href={criarLinkWhatsapp(empresa.whatsapp, `Olá, ${empresa.nome}! Vim pela loja online.`)}
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
              Pedido rápido, resposta organizada
            </div>

            <h2 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-[#071b3a] sm:text-6xl">
              Monte seu pedido sem enrolação.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Escolha os itens, informe os detalhes e envie tudo para a empresa montar uma proposta clara, com valor, prazo e condições.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Etapa 01</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Escolha</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Veja produtos e categorias.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Etapa 02</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Detalhe</p>
                <p className="mt-1 text-sm font-bold text-slate-500">Informe quantidade e observações.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Etapa 03</p>
                <p className="mt-2 text-xl font-black text-[#071b3a]">Receba</p>
                <p className="mt-1 text-sm font-bold text-slate-500">A empresa retorna com a proposta.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-[#05245c] p-5 text-white shadow-2xl shadow-blue-950/20">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-100">Resumo da loja</p>
            <h3 className="mt-3 text-4xl font-black">{empresa.nome}</h3>
            <p className="mt-3 leading-7 text-blue-100">
              Uma vitrine direta para transformar interesse em pedido organizado.
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-3xl font-black">{produtos.length}</p>
                <p className="mt-1 text-sm font-bold text-blue-100">Produtos cadastrados</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-3xl font-black">{Math.max(categorias.length - 1, 0)}</p>
                <p className="mt-1 text-sm font-bold text-blue-100">Categorias disponíveis</p>
              </div>

              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-3xl font-black">24h</p>
                <p className="mt-1 text-sm font-bold text-blue-100">Loja aberta para pedidos</p>
              </div>
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
            Pedido: {quantidadeCarrinho}
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

          {produtosFiltrados.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-blue-200 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
              <p className="text-3xl font-black text-[#071b3a]">Nenhum produto encontrado</p>
              <p className="mt-3 font-bold text-slate-500">Tente outra busca ou categoria.</p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {produtosFiltrados.map((produto, index) => {
              const imagem = obterImagem(produto)
              const imagens = obterImagens(produto)

              return (
                <article
                  key={produto.id}
                  className="loja-card overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10"
                  style={{ animationDelay: `${Math.min(index, 8) * 0.04}s` }}
                >
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

                  {imagens.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 border-b border-slate-100 p-3">
                      {imagens.map((item) => (
                        <img key={item} src={item} alt={produto.nome} className="h-14 w-full rounded-2xl object-cover" />
                      ))}
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="text-2xl font-black text-[#071b3a]">{produto.nome}</h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">{produto.categoria || 'Produto'}</p>

                    {produto.descricao && (
                      <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">
                        {produto.descricao}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 text-sm font-bold text-slate-500">
                      {produto.variacoes && <p>Variações: {produto.variacoes}</p>}
                      {produto.prazo_medio && <p>Prazo médio: {produto.prazo_medio}</p>}
                    </div>

                    <p className="mt-4 text-3xl font-black text-[#05245c]">
                      A partir de {formatarMoeda(obterPreco(produto))}
                    </p>

                    <button
                      type="button"
                      onClick={() => adicionarProduto(produto)}
                      className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]"
                    >
                      Adicionar ao pedido
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

          {mensagem && (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
              {mensagem}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {carrinho.length === 0 && (
              <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-6 text-center">
                <p className="font-black text-[#071b3a]">Nenhum item ainda</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Adicione produtos para enviar sua solicitação.
                </p>
              </div>
            )}

            {carrinho.map((item) => (
              <div key={item.produto.id} className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#071b3a]">{item.produto.nome}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {formatarMoeda(obterPreco(item.produto))} cada
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produto.id, 0)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-600"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)}
                    className="h-10 w-10 rounded-2xl bg-white font-black text-[#05245c]"
                  >
                    -
                  </button>
                  <span className="min-w-10 text-center font-black text-[#071b3a]">{item.quantidade}</span>
                  <button
                    type="button"
                    onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)}
                    className="h-10 w-10 rounded-2xl bg-white font-black text-[#05245c]"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl bg-[#05245c] p-5 text-white">
            <p className="text-sm font-bold text-blue-100">Valor estimado</p>
            <p className="mt-1 text-4xl font-black">{formatarMoeda(totalCarrinho)}</p>
            <p className="mt-2 text-xs font-bold text-blue-100">
              O valor final pode variar conforme detalhes, acabamento e prazo.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <input
              value={nomeCliente}
              onChange={(evento) => setNomeCliente(evento.target.value)}
              placeholder="Seu nome"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <input
              value={telefoneCliente}
              onChange={(evento) => setTelefoneCliente(evento.target.value)}
              placeholder="Seu WhatsApp"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <textarea
              value={observacao}
              onChange={(evento) => setObservacao(evento.target.value)}
              placeholder="Observação, prazo desejado, medidas ou detalhes"
              rows={4}
              className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <button
              type="button"
              disabled={enviando}
              onClick={enviarPedido}
              className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Enviando...' : 'Enviar solicitação'}
            </button>

            <a
              href={criarLinkWhatsapp(empresa.whatsapp, `Olá, ${empresa.nome}! Quero tirar uma dúvida sobre a loja.`)}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center font-black text-emerald-700 transition hover:bg-emerald-100"
            >
              Negociar no WhatsApp
            </a>
          </div>
        </aside>
      </section>
    </main>
  )
}
