'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
}

type Produto = {
  id: string
  nome: string
  preco: number | null
  categoria: string | null
  descricao: string | null
  prazo_medio: string | null
  variacoes: string | null
  imagem_url: string | null
  image_urls: string[] | null
  ativo: boolean | null
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseMoeda(valor: string) {
  const normalizado = valor
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const numero = Number(normalizado)

  return Number.isFinite(numero) ? numero : 0
}

function limparNomeArquivo(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .toLowerCase()
}

export default function CatalogoPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [variacoes, setVariacoes] = useState('')
  const [prazoMedio, setPrazoMedio] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])

  async function carregarDados() {
    setCarregando(true)
    setErro('')

    try {
      const { data: sessaoData } = await supabase.auth.getSession()
      const usuario = sessaoData.session?.user

      if (!usuario) {
        setErro('Voc&ecirc; precisa estar logado.')
        setCarregando(false)
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome')
        .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
        .maybeSingle()

      if (empresaError) throw empresaError

      if (!empresaData) {
        setErro('Empresa n&atilde;o encontrada.')
        setCarregando(false)
        return
      }

      const empresaAtual = empresaData as Empresa
      setEmpresa(empresaAtual)

      const { data: produtosData, error: produtosError } = await supabase
        .from('products')
        .select('id, nome, preco, categoria, descricao, prazo_medio, variacoes, imagem_url, image_urls, ativo')
        .eq('company_id', empresaAtual.id)
        .order('created_at', { ascending: false })

      if (produtosError) throw produtosError

      setProdutos((produtosData || []) as Produto[])
    } catch (error) {
      const texto = error instanceof Error ? error.message : 'Erro desconhecido ao carregar cat&aacute;logo.'
      setErro(texto)
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregarDados()
  }, [])

  async function uploadImagens() {
    if (!empresa) return []

    const selecionados = arquivos.slice(0, 4)
    const urls: string[] = []

    for (let index = 0; index < selecionados.length; index++) {
      const arquivo = selecionados[index]
      const nomeArquivo = limparNomeArquivo(arquivo.name)
      const caminho = `${empresa.id}/${Date.now()}-${index}-${nomeArquivo}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(caminho, arquivo, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(caminho)

      urls.push(data.publicUrl)
    }

    return urls
  }

  async function cadastrarProduto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!empresa) return

    if (!nome.trim()) {
      alert('Informe o nome do produto.')
      return
    }

    const precoNumero = parseMoeda(preco)

    if (precoNumero <= 0) {
      alert('Informe um pre&ccedil;o inicial v&aacute;lido.')
      return
    }

    setSalvando(true)
    setMensagem('Salvando produto...')

    try {
      const urls = await uploadImagens()

      const { error } = await supabase.from('products').insert({
        company_id: empresa.id,
        nome: nome.trim(),
        preco: precoNumero,
        categoria: categoria.trim() || null,
        descricao: descricao.trim() || null,
        variacoes: variacoes.trim() || null,
        prazo_medio: prazoMedio.trim() || null,
        imagem_url: urls[0] || null,
        image_urls: urls,
        ativo: true,
        destaque: false,
        tipo: 'produto',
        unidade: 'unidade',
      })

      if (error) throw error

      setMensagem('Produto cadastrado com sucesso.')
      setNome('')
      setPreco('')
      setCategoria('')
      setDescricao('')
      setVariacoes('')
      setPrazoMedio('')
      setArquivos([])
      await carregarDados()
    } catch (error) {
      const texto = error instanceof Error ? error.message : 'Erro ao salvar produto.'
      setMensagem(`Erro: ${texto}`)
    }

    setSalvando(false)
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] text-slate-950">
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[420px_1fr]">
        <aside className="h-fit rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">
            ← Voltar ao painel
          </Link>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
            Cat&aacute;logo
          </p>

          <h1 className="mt-3 text-4xl font-black text-[#071b3a]">
            Produtos com at&eacute; 4 imagens
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Cadastre produtos com pre&ccedil;o inicial, descri&ccedil;&atilde;o,
            varia&ccedil;&otilde;es e prazo m&eacute;dio. O cliente entende melhor antes de pedir.
          </p>

          {mensagem && (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
              {mensagem}
            </div>
          )}

          <form onSubmit={cadastrarProduto} className="mt-6 grid gap-3">
            <input
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Nome do produto"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={preco}
                onChange={(evento) => setPreco(evento.target.value)}
                placeholder="Pre&ccedil;o inicial"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <input
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                placeholder="Categoria"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <textarea
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder="Descri&ccedil;&atilde;o"
              rows={4}
              className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <input
              value={variacoes}
              onChange={(evento) => setVariacoes(evento.target.value)}
              placeholder="Varia&ccedil;&otilde;es. Ex: P, M, G ou 100g, 250g"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <input
              value={prazoMedio}
              onChange={(evento) => setPrazoMedio(evento.target.value)}
              placeholder="Prazo m&eacute;dio. Ex: 3 dias &uacute;teis"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <label className="rounded-3xl border border-dashed border-blue-200 bg-blue-50 p-5">
              <span className="block font-black text-[#071b3a]">
                Imagens do an&uacute;ncio
              </span>
              <span className="mt-1 block text-sm font-bold text-slate-500">
                Selecione at&eacute; 4 imagens.
              </span>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(evento) => {
                  const lista = Array.from(evento.target.files || []).slice(0, 4)
                  setArquivos(lista)
                }}
                className="mt-4 block w-full text-sm font-bold text-slate-600"
              />

              {arquivos.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {arquivos.map((arquivo) => (
                    <div key={arquivo.name} className="rounded-2xl bg-white p-2 text-center text-xs font-bold text-slate-500">
                      {arquivo.name.slice(0, 14)}
                    </div>
                  ))}
                </div>
              )}
            </label>

            <button
              type="submit"
              disabled={salvando}
              className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Salvar produto'}
            </button>
          </form>
        </aside>

        <section>
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
              Produtos cadastrados
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
              {empresa?.nome || 'Sua empresa'}
            </h2>
          </div>

          {erro && (
            <div className="mt-5 rounded-3xl border border-red-100 bg-red-50 p-5 font-bold text-red-700">
              {erro}
            </div>
          )}

          {carregando && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-72 animate-pulse rounded-[2rem] bg-white shadow-xl shadow-blue-950/5" />
              ))}
            </div>
          )}

          {!carregando && produtos.length === 0 && (
            <div className="mt-5 rounded-[2rem] border border-dashed border-blue-200 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
              <p className="text-5xl">📦</p>
              <h3 className="mt-4 text-3xl font-black text-[#071b3a]">
                Nenhum produto cadastrado
              </h3>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
                Cadastre os principais produtos para acelerar pedidos e deixar a empresa mais profissional.
              </p>
            </div>
          )}

          {!carregando && produtos.length > 0 && (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {produtos.map((produto) => {
                const imagens = produto.image_urls?.length
                  ? produto.image_urls
                  : produto.imagem_url
                    ? [produto.imagem_url]
                    : []

                return (
                  <article key={produto.id} className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
                    <div className="aspect-[4/3] bg-blue-50">
                      {imagens[0] ? (
                        <img src={imagens[0]} alt={produto.nome} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl">
                          🛍️
                        </div>
                      )}
                    </div>

                    {imagens.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 p-3">
                        {imagens.slice(0, 4).map((imagem) => (
                          <img key={imagem} src={imagem} alt={produto.nome} className="h-16 rounded-2xl object-cover" />
                        ))}
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-black text-[#071b3a]">
                            {produto.nome}
                          </h3>
                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {produto.categoria || 'Sem categoria'}
                          </p>
                        </div>

                        <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
                          {produto.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <p className="mt-4 text-3xl font-black text-[#05245c]">
                        A partir de {formatarMoeda(Number(produto.preco ?? 0))}
                      </p>

                      {produto.descricao && (
                        <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">
                          {produto.descricao}
                        </p>
                      )}

                      <div className="mt-4 grid gap-2 text-sm font-bold text-slate-500">
                        {produto.variacoes && <p>Varia&ccedil;&otilde;es: {produto.variacoes}</p>}
                        {produto.prazo_medio && <p>Prazo: {produto.prazo_medio}</p>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
