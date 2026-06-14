'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Produto = {
  id: string
  nome: string
  preco: number
  ativo: boolean
}

export default function OrcamentoPage() {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [produto, setProduto] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [largura, setLargura] = useState('')
  const [altura, setAltura] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [observacoes, setObservacoes] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [linkWhatsapp, setLinkWhatsapp] = useState('')

  const larguraNumero = Number(largura)
  const alturaNumero = Number(altura)
  const quantidadeNumero = Number(quantidade)

  async function carregarProdutos() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

    if (error) {
      setMensagem(`Erro ao carregar produtos: ${error.message}`)
      return
    }

    setProdutos(data || [])

    if (data && data.length > 0) {
      setProduto(data[0].nome)
    }
  }

  useEffect(() => {
    carregarProdutos()
  }, [])

  const produtoSelecionado = produtos.find((item) => item.nome === produto)

  const precoEstimado =
    larguraNumero > 0 && alturaNumero > 0 && produtoSelecionado
      ? larguraNumero * alturaNumero * Number(produtoSelecionado.preco) * quantidadeNumero
      : 0

  async function enviarPedido(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setMensagem('')

    let arquivoUrl = ''

    if (arquivo) {
        const nomeArquivo = `${Date.now()}-${arquivo.name}`

        const { error: uploadError } = await supabase.storage
            .from('artes')
            .upload(nomeArquivo, arquivo)

    if (uploadError) {
        setMensagem(`Erro ao enviar arte: ${uploadError.message}`)
        setEnviando(false)
        return
    }

    const { data: publicUrlData } = supabase.storage
        .from('artes')
        .getPublicUrl(nomeArquivo)

    arquivoUrl = publicUrlData.publicUrl
    }

    const { error } = await supabase.from('orders').insert({
      nome,
      telefone,
      produto,
      largura: larguraNumero,
      altura: alturaNumero,
      quantidade: quantidadeNumero,
      observacoes,
      preco_estimado: precoEstimado,
      arquivo_url: arquivoUrl,
    })

    if (error) {
        console.log('ERRO DO SUPABASE:', error)
        setMensagem(`Erro: ${error.message}`)
        setEnviando(false)
        return
    }

    const mensagemWhatsapp = `Olá, fiz um orçamento no site da Gráfica Flash.

    Nome: ${nome}
    WhatsApp: ${telefone}
    Produto: ${produto}
    Medida: ${larguraNumero}m x ${alturaNumero}m
    Quantidade: ${quantidadeNumero}
    Valor estimado: R$ ${precoEstimado.toFixed(2).replace('.', ',')}
    Observações: ${observacoes || 'Nenhuma'}`

    const numeroGrafica = '5582993810879'

    const link = `https://wa.me/${numeroGrafica}?text=${encodeURIComponent(
  mensagemWhatsapp
)}`

    setLinkWhatsapp(link)
    setMensagem('Pedido enviado com sucesso! Agora você pode enviar pelo WhatsApp.')

    setNome('')
    setTelefone('')
    setLargura('')
    setAltura('')
    setQuantidade('1')
    setObservacoes('')
    setArquivo(null)
    setEnviando(false)
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-12 text-white">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black">Pedir orçamento</h1>

        <p className="mt-3 text-neutral-300">
          Preencha os dados abaixo. O valor mostrado é apenas uma estimativa.
        </p>

        <form
          onSubmit={enviarPedido}
          className="mt-8 space-y-5 rounded-2xl bg-neutral-900 p-6"
        >
          <div>
            <label className="mb-2 block font-bold">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex: João Silva"
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold">WhatsApp</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
              placeholder="Ex: 82 99999-9999"
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold">Produto</label>
            <select
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
            >
              {produtos.map((item) => (
                <option key={item.id} value={item.nome}>
                  {item.nome} - R$ {Number(item.preco).toFixed(2).replace('.', ',')}/m²
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-2 block font-bold">Largura em metros</label>
              <input
                type="number"
                step="0.01"
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                required
                placeholder="2"
                className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">Altura em metros</label>
              <input
                type="number"
                step="0.01"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                required
                placeholder="1"
                className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold">Quantidade</label>
              <input
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
                placeholder="1"
                className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
              />
            </div>
          </div>

            <label className="mb-2 block font-bold">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: com ilhós, entrega urgente, arte já pronta..."
              className="min-h-28 w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
            />
           <div>
<div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl">
  <div className="mb-6 flex items-center gap-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-3xl">
      ⬆️
    </div>

    <div>
      <label className="block text-xl font-black">Enviar arte</label>
      <p className="mt-1 text-sm text-neutral-400">
        Anexe sua arte para o orçamento, se já tiver pronta.
      </p>
    </div>
  </div>

  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900/70 px-6 py-10 text-center transition hover:border-orange-400 hover:bg-neutral-800">
    <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15 text-3xl">
      📤
    </span>

    <span className="text-lg font-black">
      Clique para escolher um arquivo
    </span>

    <span className="mt-2 text-sm text-neutral-400">
      PNG, JPG ou PDF
    </span>

    <input
      type="file"
      accept=".png,.jpg,.jpeg,.pdf"
      onChange={(e) => setArquivo(e.target.files?.[0] || null)}
      className="hidden"
    />
  </label>

  <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-4">
    <p className="text-sm text-neutral-400">Arquivo selecionado</p>

    <p className="mt-1 font-bold text-white">
      {arquivo ? arquivo.name : 'Nenhum arquivo escolhido'}
    </p>
  </div>

  <p className="mt-4 text-sm text-green-400">
    ✅ Aceitamos arquivos PNG, JPG e PDF.
  </p>
</div>

<div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl">
  <div className="mb-5 flex items-center gap-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-3xl">
      💰
    </div>

    <div>
      <p className="text-xl font-black">Valor estimado</p>
      <p className="mt-1 text-sm text-neutral-400">
        Este é apenas um valor aproximado.
      </p>
    </div>
  </div>

  <div className="rounded-2xl bg-neutral-900 p-5">
    <p className="text-4xl font-black text-orange-400">
      R$ {precoEstimado.toFixed(2).replace('.', ',')}
    </p>

    <p className="mt-2 text-sm text-neutral-400">
      O valor pode variar após análise final da arte.
    </p>
  </div>
</div>
        

            <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) =>
                setArquivo(e.target.files?.[0] || null)
                }
                className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
            />

            <p className="mt-2 text-sm text-neutral-400">
                Aceitamos PNG, JPG e PDF.
            </p>
          </div>

          <div className="rounded-xl bg-neutral-800 p-4">
            <p className="text-sm text-neutral-400">Valor estimado</p>
            <p className="text-2xl font-black text-orange-400">
              R$ {precoEstimado.toFixed(2).replace('.', ',')}
            </p>
          </div>

          <button
            disabled={enviando}
            className="w-full rounded-xl bg-orange-400 px-6 py-3 font-black text-neutral-950 disabled:opacity-60"
          >
            {enviando ? 'Enviando...' : 'Enviar pedido'}
          </button>

          {mensagem && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-neutral-300">{mensagem}</p>
              {linkWhatsapp && (
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-xl bg-orange-400 px-6 py-3 font-black text-neutral-950 hover:bg-orange-500"
                >
                  Enviar pelo WhatsApp
                </a>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  )
}