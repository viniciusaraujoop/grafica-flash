'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  whatsapp: string | null
  cor_principal: string | null
  ativo: boolean
}

type Produto = {
  id: string
  nome: string
  preco: number
  ativo: boolean
  imagem_url: string | null
  company_id: string | null
}

function formatarDinheiro(valor: number) {
  return Number(valor || 0).toFixed(2).replace('.', ',')
}

function limparNomeArquivo(nome: string) {
  return nome
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
}

function montarNumeroWhatsapp(telefone: string) {
  const apenasNumeros = telefone.replace(/\D/g, '')

  if (apenasNumeros.startsWith('55')) {
    return apenasNumeros
  }

  if (apenasNumeros.length >= 10) {
    return `55${apenasNumeros}`
  }

  return apenasNumeros
}

export default function OrcamentoPorEmpresaPage() {
  const params = useParams()
  const slug = String(params.slug || '')

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoId, setProdutoId] = useState('')

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [linkWhatsapp, setLinkWhatsapp] = useState('')

  async function carregarDados() {
    if (!slug) return

    setCarregando(true)
    setMensagem('')

    const { data: empresaData, error: empresaError } = await supabase
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (empresaError) {
      console.log('ERRO EMPRESA:', empresaError)

      setMensagem(`Erro ao buscar empresa: ${empresaError.message}`)
      setCarregando(false)
      return
    }

    if (!empresaData) {
      setMensagem(`Empresa não encontrada. Slug usado: ${slug}`)
      setCarregando(false)
      return
    }

    setEmpresa(empresaData)

    if (!empresaData.ativo) {
      setMensagem('Esta empresa está temporariamente inativa.')
      setCarregando(false)
      return
    }

    const { data: produtosData, error: produtosError } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', empresaData.id)
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (produtosError) {
      console.log('ERRO PRODUTOS:', produtosError)

      setMensagem(`Erro ao carregar produtos: ${produtosError.message}`)
      setCarregando(false)
      return
    }

    setProdutos(produtosData || [])

    if (produtosData && produtosData.length > 0) {
      setProdutoId(produtosData[0].id)
    }

    setCarregando(false)
  }

  async function enviarArquivoPedido(companyId: string, arquivoSelecionado: File) {
    const nomeArquivo = limparNomeArquivo(arquivoSelecionado.name)
    const caminho = `${companyId}/${Date.now()}-${nomeArquivo}`

    const { error } = await supabase.storage
      .from('artes')
      .upload(caminho, arquivoSelecionado, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = supabase.storage.from('artes').getPublicUrl(caminho)

    return data.publicUrl
  }

  async function enviarPedido(evento: React.FormEvent) {
    evento.preventDefault()

    if (!empresa) return

    const produtoSelecionado = produtos.find(
      (produto) => produto.id === produtoId
    )

    if (!produtoSelecionado) {
      setMensagem('Selecione um produto.')
      return
    }

    const larguraNumero = Number(largura.replace(',', '.'))
    const alturaNumero = Number(altura.replace(',', '.'))
    const quantidadeNumero = Number(quantidade)

    if (
      !nome ||
      !telefone ||
      larguraNumero <= 0 ||
      alturaNumero <= 0 ||
      quantidadeNumero <= 0
    ) {
      setMensagem(
        'Preencha nome, telefone, largura, altura e quantidade corretamente.'
      )
      return
    }

    setEnviando(true)
    setMensagem('')
    setLinkWhatsapp('')

    let arquivoUrl = ''

    try {
      if (arquivo) {
        arquivoUrl = await enviarArquivoPedido(empresa.id, arquivo)
      }

      const precoEstimado =
        larguraNumero *
        alturaNumero *
        Number(produtoSelecionado.preco) *
        quantidadeNumero

      const { error } = await supabase.from('orders').insert({
        company_id: empresa.id,
        nome,
        telefone,
        produto: produtoSelecionado.nome,
        largura: larguraNumero,
        altura: alturaNumero,
        quantidade: quantidadeNumero,
        observacoes,
        preco_estimado: precoEstimado,
        arquivo_url: arquivoUrl || null,
        status: 'Recebido',
      })

      if (error) {
        console.log('ERRO AO ENVIAR PEDIDO:', error)

        setMensagem(`Erro ao enviar pedido: ${error.message}`)
        setEnviando(false)
        return
      }

      const numeroEmpresa = montarNumeroWhatsapp(empresa.whatsapp || '')

      const textoWhatsapp = `Olá! Acabei de solicitar um orçamento pelo site.

Nome: ${nome}
Produto: ${produtoSelecionado.nome}
Medidas: ${larguraNumero}m x ${alturaNumero}m
Quantidade: ${quantidadeNumero}
Valor estimado: R$ ${formatarDinheiro(precoEstimado)}

${observacoes ? `Observações: ${observacoes}` : ''}`

      const link = `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(
        textoWhatsapp
      )}`

      setLinkWhatsapp(link)
      setMensagem('Pedido enviado com sucesso.')

      setNome('')
      setTelefone('')
      setLargura('')
      setAltura('')
      setQuantidade('1')
      setObservacoes('')
      setArquivo(null)
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao enviar pedido.'

      setMensagem(`Erro: ${mensagemErro}`)
    }

    setEnviando(false)
  }

  useEffect(() => {
    carregarDados()
  }, [slug])

  const produtoSelecionado = produtos.find(
    (produto) => produto.id === produtoId
  )

  const larguraNumero = Number(largura.replace(',', '.'))
  const alturaNumero = Number(altura.replace(',', '.'))
  const quantidadeNumero = Number(quantidade)

  const precoEstimado =
    produtoSelecionado &&
    larguraNumero > 0 &&
    alturaNumero > 0 &&
    quantidadeNumero > 0
      ? larguraNumero *
        alturaNumero *
        Number(produtoSelecionado.preco) *
        quantidadeNumero
      : 0

  const corPrincipal = empresa?.cor_principal || '#fb923c'

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
          <p className="text-neutral-400">Carregando orçamento...</p>
        </div>
      </main>
    )
  }

  if (!empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
        <div className="max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-black text-red-400">
            Empresa não encontrada
          </h1>

          <p className="mt-3 text-neutral-400">
            {mensagem || 'Verifique se o link está correto.'}
          </p>
        </div>
      </main>
    )
  }

  if (!empresa.ativo) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
        <div className="max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-black text-orange-400">
            Orçamento indisponível
          </h1>

          <p className="mt-3 text-neutral-400">
            Esta empresa está temporariamente inativa.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-[2rem] border border-neutral-800 bg-neutral-900 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              {empresa.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt={empresa.nome}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div
                  className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black text-neutral-950"
                  style={{ backgroundColor: corPrincipal }}
                >
                  {empresa.nome.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div>
                <p
                  className="text-sm font-black uppercase tracking-[0.2em]"
                  style={{ color: corPrincipal }}
                >
                  Orçamento online
                </p>

                <h1 className="mt-2 text-3xl font-black md:text-5xl">
                  {empresa.nome}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 md:text-base">
                  Escolha um produto, informe as medidas e envie sua solicitação.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5">
              <p className="text-sm text-neutral-400">Valor estimado</p>

              <p
                className="mt-2 text-4xl font-black"
                style={{ color: corPrincipal }}
              >
                R$ {formatarDinheiro(precoEstimado)}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <section>
            <h2 className="mb-5 text-2xl font-black">
              Escolha o produto
            </h2>

            {produtos.length === 0 ? (
              <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
                Nenhum produto disponível no momento.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {produtos.map((produto) => {
                  const selecionado = produto.id === produtoId

                  return (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() => setProdutoId(produto.id)}
                      className="overflow-hidden rounded-[2rem] border bg-neutral-900 text-left shadow-xl transition hover:-translate-y-1"
                      style={{
                        borderColor: selecionado ? corPrincipal : '#262626',
                      }}
                    >
                      <div className="h-48 bg-neutral-800">
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-5xl">
                            🖼️
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <h3 className="text-xl font-black">
                          {produto.nome}
                        </h3>

                        <p
                          className="mt-2 font-bold"
                          style={{ color: corPrincipal }}
                        >
                          R$ {formatarDinheiro(produto.preco)}/m²
                        </p>

                        <div
                          className="mt-4 rounded-xl px-4 py-3 text-center text-sm font-black"
                          style={{
                            backgroundColor: selecionado
                              ? corPrincipal
                              : '#262626',
                            color: selecionado ? '#171717' : '#e5e5e5',
                          }}
                        >
                          {selecionado ? 'Selecionado' : 'Selecionar'}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <form
              onSubmit={enviarPedido}
              className="rounded-[2rem] border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
            >
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-500">
                Dados do pedido
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Solicitar orçamento
              </h2>

              <div className="mt-6 grid gap-4">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                />

                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Seu WhatsApp"
                  className="rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                />

                <div className="grid grid-cols-2 gap-4">
                  <input
                    value={largura}
                    onChange={(e) => setLargura(e.target.value)}
                    placeholder="Largura em m"
                    className="rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                  />

                  <input
                    value={altura}
                    onChange={(e) => setAltura(e.target.value)}
                    placeholder="Altura em m"
                    className="rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                  />
                </div>

                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Quantidade"
                  className="rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                />

                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações, acabamento, prazo..."
                  rows={4}
                  className="resize-none rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-4 outline-none focus:border-orange-400"
                />

                <label className="cursor-pointer rounded-2xl border border-dashed border-neutral-700 bg-neutral-800 px-4 py-4 text-sm text-neutral-300 hover:border-orange-400">
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate">
                      {arquivo ? arquivo.name : 'Enviar arte ou referência'}
                    </span>

                    <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold">
                      Upload
                    </span>
                  </div>

                  <input
                    type="file"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <div className="rounded-2xl bg-neutral-950 p-5">
                  <p className="text-sm text-neutral-400">Total estimado</p>

                  <p
                    className="mt-2 text-4xl font-black"
                    style={{ color: corPrincipal }}
                  >
                    R$ {formatarDinheiro(precoEstimado)}
                  </p>

                  {produtoSelecionado && (
                    <p className="mt-2 text-sm text-neutral-500">
                      Produto: {produtoSelecionado.nome}
                    </p>
                  )}
                </div>

                <button
                  disabled={enviando || produtos.length === 0}
                  className="rounded-2xl px-5 py-4 font-black text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: corPrincipal }}
                >
                  {enviando ? 'Enviando...' : 'Enviar orçamento'}
                </button>
              </div>

              {mensagem && (
                <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-neutral-300">
                  {mensagem}
                </p>
              )}

              {linkWhatsapp && (
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block rounded-2xl bg-green-500 px-5 py-4 text-center font-black text-white hover:bg-green-600"
                >
                  Enviar mensagem no WhatsApp
                </a>
              )}
            </form>
          </section>
        </div>
      </section>
    </main>
  )
}