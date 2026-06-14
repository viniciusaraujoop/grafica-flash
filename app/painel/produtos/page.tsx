'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Produto = {
  id: string
  nome: string
  preco: number
  ativo: boolean
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function carregarProdutos() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('nome', { ascending: true })

    if (error) {
      setMensagem(`Erro ao carregar produtos: ${error.message}`)
      return
    }

    setProdutos(data || [])
  }

  async function adicionarProduto(evento: React.FormEvent) {
    evento.preventDefault()

    const precoNumero = Number(preco.replace(',', '.'))

    if (!nome || precoNumero <= 0) {
      setMensagem('Preencha nome e preço corretamente.')
      return
    }

    const { error } = await supabase.from('products').insert({
      nome,
      preco: precoNumero,
      ativo: true,
    })

    if (error) {
      setMensagem(`Erro ao cadastrar: ${error.message}`)
      return
    }

    setNome('')
    setPreco('')
    setMensagem('Produto cadastrado com sucesso.')
    carregarProdutos()
  }

  async function editarPreco(id: string, precoAtual: number) {
    const novoPreco = prompt('Novo preço por m²:', String(precoAtual))

    if (!novoPreco) return

    const precoNumero = Number(novoPreco.replace(',', '.'))

    if (precoNumero <= 0) {
      alert('Preço inválido.')
      return
    }

    const { error } = await supabase
      .from('products')
      .update({ preco: precoNumero })
      .eq('id', id)

    if (error) {
      setMensagem(`Erro ao editar: ${error.message}`)
      return
    }

    carregarProdutos()
  }

  async function alternarAtivo(id: string, ativoAtual: boolean) {
    await supabase
      .from('products')
      .update({ ativo: !ativoAtual })
      .eq('id', id)

    carregarProdutos()
  }

  async function excluirProduto(id: string) {
    const confirmar = confirm('Tem certeza que deseja excluir este produto?')

    if (!confirmar) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      setMensagem(`Erro ao excluir: ${error.message}`)
      return
    }

    carregarProdutos()
  }

  useEffect(() => {
    carregarProdutos()
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-orange-400">Gráfica Flash</p>
            <h1 className="mt-2 text-3xl font-black">Produtos e preços</h1>
            <p className="mt-2 text-neutral-400">
              Cadastre, edite, ative ou exclua produtos.
            </p>
          </div>

          <Link
            href="/painel"
            className="rounded-xl border border-neutral-700 px-5 py-3 font-bold hover:bg-neutral-800"
          >
            Voltar ao painel
          </Link>
        </div>

        <form
          onSubmit={adicionarProduto}
          className="mb-8 grid gap-4 rounded-2xl bg-neutral-900 p-6 md:grid-cols-[1fr_180px_160px]"
        >
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do produto"
            className="rounded-xl bg-neutral-800 px-4 py-3 outline-none"
          />

          <input
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Preço por m²"
            className="rounded-xl bg-neutral-800 px-4 py-3 outline-none"
          />

          <button className="rounded-xl bg-orange-400 px-5 py-3 font-black text-neutral-950 hover:bg-orange-500">
            Adicionar
          </button>
        </form>

        {mensagem && (
          <p className="mb-6 rounded-xl bg-neutral-900 p-4 text-sm text-neutral-300">
            {mensagem}
          </p>
        )}

        <div className="space-y-4">
          {produtos.map((produto) => (
            <div
              key={produto.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-xl font-black">{produto.nome}</h2>

                  <p className="mt-1 text-orange-400">
                    R$ {Number(produto.preco).toFixed(2).replace('.', ',')}/m²
                  </p>

                  <p className="mt-1 text-sm text-neutral-400">
                    Status: {produto.ativo ? 'Ativo' : 'Inativo'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => editarPreco(produto.id, produto.preco)}
                    className="rounded-xl bg-neutral-800 px-4 py-3 font-bold hover:bg-neutral-700"
                  >
                    Editar preço
                  </button>

                  <button
                    onClick={() => alternarAtivo(produto.id, produto.ativo)}
                    className="rounded-xl border border-neutral-700 px-4 py-3 font-bold hover:bg-neutral-800"
                  >
                    {produto.ativo ? 'Desativar' : 'Ativar'}
                  </button>

                  <button
                    onClick={() => excluirProduto(produto.id)}
                    className="rounded-xl bg-red-500 px-4 py-3 font-bold text-white hover:bg-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}