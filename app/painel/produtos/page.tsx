'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Produto = {
  id: string
  nome: string
  preco: number
  ativo: boolean
  imagem_url: string | null
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

function extrairCaminhoStorage(url: string | null) {
  if (!url) return null

  const marcador = '/produtos/'
  const partes = url.split(marcador)

  if (partes.length < 2) return null

  return decodeURIComponent(partes[1])
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [imagem, setImagem] = useState<File | null>(null)
  const [previewImagem, setPreviewImagem] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [produtoEnviandoImagem, setProdutoEnviandoImagem] = useState('')

  async function carregarProdutos() {
    setCarregando(true)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('nome', { ascending: true })

    if (error) {
      setMensagem(`Erro ao carregar produtos: ${error.message}`)
      setCarregando(false)
      return
    }

    setProdutos(data || [])
    setCarregando(false)
  }

  function selecionarImagemNova(arquivo: File | null) {
    setImagem(arquivo)

    if (!arquivo) {
      setPreviewImagem('')
      return
    }

    const urlTemporaria = URL.createObjectURL(arquivo)
    setPreviewImagem(urlTemporaria)
  }

  async function enviarImagemProduto(produtoId: string, arquivo: File) {
    const nomeArquivo = limparNomeArquivo(arquivo.name)
    const caminho = `${produtoId}/${Date.now()}-${nomeArquivo}`

    const { error } = await supabase.storage
      .from('produtos')
      .upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = supabase.storage
      .from('produtos')
      .getPublicUrl(caminho)

    return data.publicUrl
  }

  async function adicionarProduto(evento: React.FormEvent) {
    evento.preventDefault()

    const precoNumero = Number(preco.replace(',', '.'))

    if (!nome || precoNumero <= 0) {
      setMensagem('Preencha nome e preço corretamente.')
      return
    }

    setSalvando(true)
    setMensagem('')

    const { data, error } = await supabase
      .from('products')
      .insert({
        nome,
        preco: precoNumero,
        ativo: true,
        imagem_url: null,
      })
      .select()
      .single()

    if (error) {
      setMensagem(`Erro ao cadastrar: ${error.message}`)
      setSalvando(false)
      return
    }

    if (imagem && data) {
      try {
        const imagemUrl = await enviarImagemProduto(data.id, imagem)

        const { error: erroImagem } = await supabase
          .from('products')
          .update({ imagem_url: imagemUrl })
          .eq('id', data.id)

        if (erroImagem) {
          setMensagem(`Produto criado, mas erro na imagem: ${erroImagem.message}`)
          setSalvando(false)
          return
        }
      } catch (erro) {
        const mensagemErro =
          erro instanceof Error ? erro.message : 'Erro desconhecido ao enviar imagem.'

        setMensagem(`Produto criado, mas erro na imagem: ${mensagemErro}`)
        setSalvando(false)
        carregarProdutos()
        return
      }
    }

    setNome('')
    setPreco('')
    setImagem(null)
    setPreviewImagem('')
    setMensagem('Produto cadastrado com sucesso.')
    setSalvando(false)
    carregarProdutos()
  }

  async function editarProduto(produto: Produto) {
    const novoNome = prompt('Novo nome do produto:', produto.nome)

    if (!novoNome) return

    const novoPreco = prompt('Novo preço por m²:', String(produto.preco))

    if (!novoPreco) return

    const precoNumero = Number(novoPreco.replace(',', '.'))

    if (precoNumero <= 0) {
      alert('Preço inválido.')
      return
    }

    const { error } = await supabase
      .from('products')
      .update({
        nome: novoNome,
        preco: precoNumero,
      })
      .eq('id', produto.id)

    if (error) {
      setMensagem(`Erro ao editar: ${error.message}`)
      return
    }

    setMensagem('Produto atualizado com sucesso.')
    carregarProdutos()
  }

  async function trocarImagemProduto(produto: Produto, arquivo: File | null) {
    if (!arquivo) return

    setProdutoEnviandoImagem(produto.id)
    setMensagem('')

    try {
      const imagemAntiga = extrairCaminhoStorage(produto.imagem_url)

      if (imagemAntiga) {
        await supabase.storage.from('produtos').remove([imagemAntiga])
      }

      const imagemUrl = await enviarImagemProduto(produto.id, arquivo)

      const { error } = await supabase
        .from('products')
        .update({ imagem_url: imagemUrl })
        .eq('id', produto.id)

      if (error) {
        setMensagem(`Erro ao salvar imagem: ${error.message}`)
        setProdutoEnviandoImagem('')
        return
      }

      setMensagem('Imagem atualizada com sucesso.')
      setProdutoEnviandoImagem('')
      carregarProdutos()
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao trocar imagem.'

      setMensagem(`Erro ao trocar imagem: ${mensagemErro}`)
      setProdutoEnviandoImagem('')
    }
  }

  async function removerImagemProduto(produto: Produto) {
    const confirmar = confirm('Remover a imagem deste produto?')

    if (!confirmar) return

    const caminhoImagem = extrairCaminhoStorage(produto.imagem_url)

    if (caminhoImagem) {
      await supabase.storage.from('produtos').remove([caminhoImagem])
    }

    const { error } = await supabase
      .from('products')
      .update({ imagem_url: null })
      .eq('id', produto.id)

    if (error) {
      setMensagem(`Erro ao remover imagem: ${error.message}`)
      return
    }

    setMensagem('Imagem removida com sucesso.')
    carregarProdutos()
  }

  async function alternarAtivo(id: string, ativoAtual: boolean) {
    const { error } = await supabase
      .from('products')
      .update({ ativo: !ativoAtual })
      .eq('id', id)

    if (error) {
      setMensagem(`Erro ao alterar status: ${error.message}`)
      return
    }

    carregarProdutos()
  }

  async function excluirProduto(produto: Produto) {
    const confirmar = confirm('Tem certeza que deseja excluir este produto?')

    if (!confirmar) return

    const caminhoImagem = extrairCaminhoStorage(produto.imagem_url)

    if (caminhoImagem) {
      await supabase.storage.from('produtos').remove([caminhoImagem])
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', produto.id)

    if (error) {
      setMensagem(`Erro ao excluir: ${error.message}`)
      return
    }

    setMensagem('Produto excluído com sucesso.')
    carregarProdutos()
  }

  useEffect(() => {
    carregarProdutos()
  }, [])

  return (
    <main className="min-h-screen overflow-hidden bg-neutral-950 px-4 py-8 text-white">
      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes floatSoft {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-8px);
            }
          }

          @keyframes shine {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          .fade-up {
            animation: fadeUp .6s ease-out both;
          }

          .fade-up-delay {
            animation: fadeUp .8s ease-out .12s both;
          }

          .float-soft {
            animation: floatSoft 4s ease-in-out infinite;
          }

          .card-shine {
            position: relative;
            overflow: hidden;
          }

          .card-shine::after {
            content: '';
            position: absolute;
            inset: 0;
            width: 45%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,.10),
              transparent
            );
            transform: translateX(-120%);
            animation: shine 5s ease-in-out infinite;
          }

          .touch-button {
            transition:
              transform .2s ease,
              background-color .2s ease,
              border-color .2s ease,
              box-shadow .2s ease;
          }

          .touch-button:hover {
            transform: translateY(-3px);
          }

          .touch-button:active {
            transform: scale(.97);
          }

          @media (prefers-reduced-motion: reduce) {
            .fade-up,
            .fade-up-delay,
            .float-soft,
            .card-shine::after {
              animation: none !important;
            }

            .touch-button {
              transition: none !important;
            }
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-96 w-96 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute left-[45%] top-[25%] h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-7xl">
        <div className="fade-up mb-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl md:p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">
                  Catálogo da gráfica
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Produtos e preços
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300 md:text-base">
                Cadastre produtos, defina preços por metro quadrado e gerencie
                imagens como um catálogo profissional para seus clientes.
              </p>
            </div>

            <Link
              href="/painel"
              className="touch-button rounded-2xl border border-white/10 px-5 py-3 text-center font-bold text-neutral-200 hover:bg-white/10"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>

        <form
          onSubmit={adicionarProduto}
          className="fade-up-delay mb-8 grid gap-5 rounded-[2rem] border border-white/10 bg-neutral-900/80 p-5 shadow-2xl backdrop-blur-xl lg:grid-cols-[1fr_180px_260px_160px]"
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-neutral-300">
              Nome do produto
            </label>

            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Banner em lona"
              className="w-full rounded-2xl border border-white/10 bg-neutral-800 px-4 py-4 outline-none transition focus:border-orange-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-neutral-300">
              Preço por m²
            </label>

            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Ex: 60"
              className="w-full rounded-2xl border border-white/10 bg-neutral-800 px-4 py-4 outline-none transition focus:border-orange-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-neutral-300">
              Imagem do produto
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-white/20 bg-neutral-800 px-4 py-4 text-sm text-neutral-300 transition hover:border-orange-400 hover:bg-neutral-800/70">
              <span className="truncate">
                {imagem ? imagem.name : 'Selecionar imagem'}
              </span>

              <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold">
                Upload
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => selecionarImagemNova(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <button
            disabled={salvando}
            className="touch-button self-end rounded-2xl bg-orange-400 px-5 py-4 font-black text-neutral-950 shadow-lg shadow-orange-500/20 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>

          {previewImagem && (
            <div className="lg:col-span-4">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 p-3">
                <p className="mb-3 text-sm font-bold text-neutral-300">
                  Prévia da imagem
                </p>

                <img
                  src={previewImagem}
                  alt="Prévia do produto"
                  className="h-48 w-full rounded-2xl object-cover"
                />
              </div>
            </div>
          )}
        </form>

        {mensagem && (
          <div className="fade-up mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-bold text-neutral-200 backdrop-blur">
            {mensagem}
          </div>
        )}

        {carregando ? (
          <div className="rounded-[2rem] border border-white/10 bg-neutral-900 p-8 text-center text-neutral-400">
            Carregando produtos...
          </div>
        ) : produtos.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-neutral-900 p-8 text-center text-neutral-400">
            Nenhum produto cadastrado ainda.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {produtos.map((produto, index) => (
              <div
                key={produto.id}
                className="fade-up card-shine group overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-900 shadow-2xl transition hover:-translate-y-2 hover:border-orange-400/50 hover:shadow-orange-500/10"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="relative h-56 overflow-hidden bg-neutral-800">
                  {produto.imagem_url ? (
                    <img
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 p-6 text-center">
                      <div className="float-soft mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-orange-400/15 text-3xl">
                        🖼️
                      </div>

                      <p className="font-black text-neutral-200">
                        Sem imagem
                      </p>

                      <p className="mt-2 text-sm text-neutral-500">
                        Adicione uma imagem para deixar o catálogo mais atrativo.
                      </p>
                    </div>
                  )}

                  <div className="absolute left-4 top-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        produto.ativo
                          ? 'bg-green-500 text-white'
                          : 'bg-neutral-700 text-neutral-300'
                      }`}
                    >
                      {produto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <div className="absolute bottom-4 right-4 rounded-2xl bg-neutral-950/90 px-4 py-2 backdrop-blur">
                    <p className="text-sm font-black text-orange-300">
                      R$ {formatarDinheiro(produto.preco)}/m²
                    </p>
                  </div>
                </div>

                <div className="relative p-5">
                  <h2 className="text-2xl font-black tracking-tight">
                    {produto.nome}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    Produto disponível no catálogo da gráfica para orçamento rápido.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <label className="touch-button cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/10">
                      {produtoEnviandoImagem === produto.id
                        ? 'Enviando imagem...'
                        : produto.imagem_url
                          ? 'Trocar imagem'
                          : 'Adicionar imagem'}

                      <input
                        type="file"
                        accept="image/*"
                        disabled={produtoEnviandoImagem === produto.id}
                        onChange={(e) =>
                          trocarImagemProduto(
                            produto,
                            e.target.files?.[0] || null
                          )
                        }
                        className="hidden"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => editarProduto(produto)}
                        className="touch-button rounded-2xl bg-neutral-800 px-4 py-3 text-sm font-bold hover:bg-neutral-700"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() =>
                          alternarAtivo(produto.id, produto.ativo)
                        }
                        className="touch-button rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold hover:bg-white/10"
                      >
                        {produto.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => removerImagemProduto(produto)}
                        disabled={!produto.imagem_url}
                        className="touch-button rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-neutral-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remover imagem
                      </button>

                      <button
                        onClick={() => excluirProduto(produto)}
                        className="touch-button rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}