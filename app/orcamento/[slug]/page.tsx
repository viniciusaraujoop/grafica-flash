'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  slug: string
  logo_url: string | null
  whatsapp: string | null
  cor_principal: string | null
  ativo: boolean
  segmento: string | null
  cidade: string | null
  estado: string | null
  pix_key: string | null
  pix_nome: string | null
  pix_cidade: string | null
  aceita_pix: boolean | null
  aceita_cartao: boolean | null
  cobrar_sinal: boolean | null
  percentual_sinal: number | null
}

type ItemCatalogo = {
  id: string
  nome: string
  descricao: string | null
  categoria: string | null
  tipo: string | null
  unidade: string | null
  preco: number
  ativo: boolean
  destaque: boolean | null
  imagem_url: string | null
  company_id: string | null
  precificacao: string | null
  unidade_label: string | null
  permite_largura: boolean | null
  permite_altura: boolean | null
  permite_comprimento: boolean | null
  permite_quantidade: boolean | null
  valor_minimo: number | null
  cobrar_sinal_personalizado: boolean | null
  percentual_sinal_produto: number | null
}

type ItemCarrinho = {
  item: ItemCatalogo
  quantidade: number
  largura: number
  altura: number
  comprimento: number
}

type CalculoItem = {
  subtotal: number
  areaM2: number | null
  detalhes: string
}

function formatarDinheiro(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function limparNomeArquivo(nome: string) {
  return nome
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
}

function numeroSeguro(valor: number | string) {
  if (typeof valor === 'number') return Number.isNaN(valor) ? 0 : valor

  const numero = Number(String(valor).replace(',', '.'))

  if (Number.isNaN(numero)) return 0

  return numero
}

function limparTextoPix(texto: string, limite: number) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .slice(0, limite)
}

function montarCampoPix(id: string, valor: string) {
  const tamanho = String(valor.length).padStart(2, '0')
  return `${id}${tamanho}${valor}`
}

function crc16(payload: string) {
  let crc = 0xffff

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }

      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function gerarPixCopiaCola({
  chave,
  nome,
  cidade,
  valor,
  txid,
}: {
  chave: string
  nome: string
  cidade: string
  valor: number
  txid: string
}) {
  const merchantAccountInfo =
    montarCampoPix('00', 'br.gov.bcb.pix') + montarCampoPix('01', chave)

  const payloadSemCRC =
    montarCampoPix('00', '01') +
    montarCampoPix('26', merchantAccountInfo) +
    montarCampoPix('52', '0000') +
    montarCampoPix('53', '986') +
    montarCampoPix('54', valor.toFixed(2)) +
    montarCampoPix('58', 'BR') +
    montarCampoPix('59', limparTextoPix(nome || 'ORCALY', 25)) +
    montarCampoPix('60', limparTextoPix(cidade || 'BRASIL', 15)) +
    montarCampoPix(
      '62',
      montarCampoPix('05', limparTextoPix(txid || 'ORCALY', 25))
    ) +
    '6304'

  return payloadSemCRC + crc16(payloadSemCRC)
}

function montarWhatsapp(telefone: string) {
  const numeros = telefone.replace(/\D/g, '')

  if (numeros.startsWith('55')) return numeros
  if (numeros.length >= 10) return `55${numeros}`

  return numeros
}

function nomePrecificacao(tipo: string | null) {
  if (tipo === 'metro_quadrado') return 'm²'
  if (tipo === 'metro_linear') return 'metro'
  if (tipo === 'milheiro') return 'milheiro'
  if (tipo === 'hora') return 'hora'
  if (tipo === 'diaria') return 'diária'
  if (tipo === 'mensalidade') return 'mês'
  if (tipo === 'sob_consulta') return 'sob consulta'

  return 'unidade'
}

function labelQuantidade(tipo: string | null) {
  if (tipo === 'milheiro') return 'Quantidade de unidades'
  if (tipo === 'hora') return 'Horas'
  if (tipo === 'diaria') return 'Diárias'
  if (tipo === 'mensalidade') return 'Meses'

  return 'Quantidade'
}

function calcularItem(produto: ItemCarrinho): CalculoItem {
  const item = produto.item
  const preco = Number(item.preco || 0)
  const quantidade = produto.quantidade || 1
  const valorMinimo = Number(item.valor_minimo || 0)

  let subtotal = 0
  let areaM2: number | null = null
  let detalhes = ''

  if (item.precificacao === 'sob_consulta') {
    return {
      subtotal: 0,
      areaM2: null,
      detalhes: 'Sob consulta',
    }
  }

  if (item.precificacao === 'metro_quadrado') {
    areaM2 = Number(((produto.largura || 0) * (produto.altura || 0)).toFixed(4))
    subtotal = areaM2 * preco * quantidade
    detalhes = `${produto.largura || 0} x ${produto.altura || 0} m = ${areaM2} m² x ${quantidade}`
  } else if (item.precificacao === 'metro_linear') {
    subtotal = (produto.comprimento || 0) * preco * quantidade
    detalhes = `${produto.comprimento || 0} m x ${quantidade}`
  } else if (item.precificacao === 'milheiro') {
    subtotal = (quantidade / 1000) * preco
    detalhes = `${quantidade} unidades / 1000`
  } else {
    subtotal = preco * quantidade
    detalhes = `${quantidade} x ${item.unidade_label || item.unidade || nomePrecificacao(item.precificacao)}`
  }

  if (subtotal > 0 && valorMinimo > 0 && subtotal < valorMinimo) {
    subtotal = valorMinimo
    detalhes = `${detalhes} | valor mínimo aplicado`
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    areaM2,
    detalhes,
  }
}

export default function PaginaPublicaEmpresa() {
  const params = useParams()
  const slug = String(params.slug || '')

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)

  const [formaPagamento, setFormaPagamento] = useState('combinar')
  const [parcelas, setParcelas] = useState('1')

  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [linkWhatsapp, setLinkWhatsapp] = useState('')
  const [pixCopiaCola, setPixCopiaCola] = useState('')
  const [pixQrCode, setPixQrCode] = useState('')
  const [valorPixGerado, setValorPixGerado] = useState(0)

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
      setMensagem(`Erro ao buscar empresa: ${empresaError.message}`)
      setCarregando(false)
      return
    }

    if (!empresaData) {
      setMensagem('Empresa não encontrada. Verifique se o link está correto.')
      setCarregando(false)
      return
    }

    setEmpresa(empresaData)

    if (!empresaData.ativo) {
      setMensagem('Esta empresa está temporariamente indisponível.')
      setCarregando(false)
      return
    }

    const { data: itensData, error: itensError } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', empresaData.id)
      .eq('ativo', true)
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })

    if (itensError) {
      setMensagem(`Erro ao carregar catálogo: ${itensError.message}`)
      setCarregando(false)
      return
    }

    setItens(itensData || [])

    if (empresaData.aceita_pix) {
      setFormaPagamento('pix')
    } else if (empresaData.aceita_cartao) {
      setFormaPagamento('cartao_credito')
    } else {
      setFormaPagamento('combinar')
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

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('artes').getPublicUrl(caminho)

    return data.publicUrl
  }

  function limparResultadoPagamento() {
    setPedidoEnviado(false)
    setLinkWhatsapp('')
    setPixCopiaCola('')
    setPixQrCode('')
    setValorPixGerado(0)
  }

  function adicionarAoCarrinho(item: ItemCatalogo) {
    setMensagem('')
    limparResultadoPagamento()

    setCarrinho((listaAtual) => {
      const itemExiste = listaAtual.find((produto) => produto.item.id === item.id)

      if (itemExiste) {
        return listaAtual.map((produto) =>
          produto.item.id === item.id
            ? { ...produto, quantidade: produto.quantidade + 1 }
            : produto
        )
      }

      return [
        ...listaAtual,
        {
          item,
          quantidade: item.permite_quantidade === false ? 1 : 1,
          largura: item.permite_largura ? 1 : 0,
          altura: item.permite_altura ? 1 : 0,
          comprimento: item.permite_comprimento ? 1 : 0,
        },
      ]
    })
  }

  function atualizarItemCarrinho(
    itemId: string,
    campo: 'quantidade' | 'largura' | 'altura' | 'comprimento',
    valor: number
  ) {
    limparResultadoPagamento()

    const numero = Math.max(0, numeroSeguro(valor))

    setCarrinho((listaAtual) =>
      listaAtual.map((produto) =>
        produto.item.id === itemId
          ? {
              ...produto,
              [campo]: numero,
            }
          : produto
      )
    )
  }

  function removerDoCarrinho(itemId: string) {
    limparResultadoPagamento()

    setCarrinho((listaAtual) =>
      listaAtual.filter((produto) => produto.item.id !== itemId)
    )
  }

  const totais = useMemo(() => {
    const total = carrinho.reduce((soma, produto) => {
      return soma + calcularItem(produto).subtotal
    }, 0)

    const totalSobConsulta = carrinho.some(
      (produto) => produto.item.precificacao === 'sob_consulta'
    )

    const sinal = carrinho.reduce((soma, produto) => {
      const calculo = calcularItem(produto)
      const percentualProduto = Number(produto.item.percentual_sinal_produto || 0)

      let percentual = 0

      if (produto.item.cobrar_sinal_personalizado && percentualProduto > 0) {
        percentual = percentualProduto
      } else if (empresa?.cobrar_sinal) {
        percentual = Number(empresa.percentual_sinal || 0)
      }

      if (percentual <= 0) return soma

      return soma + (calculo.subtotal * percentual) / 100
    }, 0)

    return {
      total: Number(total.toFixed(2)),
      sinal: Number(sinal.toFixed(2)),
      restante: Number((total - sinal).toFixed(2)),
      temSobConsulta: totalSobConsulta,
    }
  }, [carrinho, empresa])

  async function gerarPixDoPedido(orderId: string, valorPix: number) {
    if (!empresa?.pix_key) return

    const codigoPix = gerarPixCopiaCola({
      chave: empresa.pix_key,
      nome: empresa.pix_nome || empresa.nome || 'ORCALY',
      cidade: empresa.pix_cidade || empresa.cidade || 'BRASIL',
      valor: valorPix,
      txid: orderId.replace(/-/g, '').slice(0, 25),
    })

    const qrCode = await QRCode.toDataURL(codigoPix, {
      margin: 2,
      width: 260,
    })

    setPixCopiaCola(codigoPix)
    setPixQrCode(qrCode)
    setValorPixGerado(valorPix)
  }

  async function enviarSolicitacao(evento: React.FormEvent) {
    evento.preventDefault()

    if (!empresa) return

    if (carrinho.length === 0) {
      setMensagem('Adicione pelo menos um item ao carrinho.')
      return
    }

    if (!nome || !telefone) {
      setMensagem('Preencha nome e WhatsApp para continuar.')
      return
    }

    if (formaPagamento === 'pix' && !empresa.pix_key) {
      setMensagem('Esta empresa ainda não configurou uma chave Pix.')
      return
    }

    if (formaPagamento === 'pix' && totais.total <= 0) {
      setMensagem('Esse pedido está sob consulta. Escolha combinar pagamento com a empresa.')
      return
    }

    setEnviando(true)
    setMensagem('')
    limparResultadoPagamento()

    let arquivoUrl = ''

    try {
      if (arquivo) {
        arquivoUrl = await enviarArquivoPedido(empresa.id, arquivo)
      }

      const itensResumo = carrinho
        .map((produto) => {
          const calculo = calcularItem(produto)
          return `${produto.quantidade}x ${produto.item.nome} (${calculo.detalhes})`
        })
        .join(', ')

      const totalQuantidade = carrinho.reduce((total, produto) => {
        return total + produto.quantidade
      }, 0)

      const valorSinal = totais.sinal > 0 ? totais.sinal : null
      const percentualSinalMedio =
        totais.total > 0 && totais.sinal > 0
          ? Number(((totais.sinal / totais.total) * 100).toFixed(2))
          : null

      const { data: pedidoData, error: pedidoError } = await supabase
        .from('orders')
        .insert({
          company_id: empresa.id,
          nome,
          telefone,
          produto: `Pedido com ${carrinho.length} item(ns)`,
          quantidade: totalQuantidade,
          observacoes,
          preco_estimado: totais.total,
          valor_total: totais.total,
          valor_sinal: valorSinal,
          percentual_sinal: percentualSinalMedio,
          forma_pagamento: formaPagamento,
          parcelas: formaPagamento === 'cartao_credito' ? Number(parcelas) : null,
          itens_resumo: itensResumo,
          arquivo_url: arquivoUrl || null,
          status: 'Recebido',
        })
        .select('id')
        .single()

      if (pedidoError || !pedidoData) {
        setMensagem(`Erro ao enviar pedido: ${pedidoError?.message}`)
        setEnviando(false)
        return
      }

      const itensPedido = carrinho.map((produto) => {
        const calculo = calcularItem(produto)

        return {
          order_id: pedidoData.id,
          company_id: empresa.id,
          product_id: produto.item.id,
          nome: produto.item.nome,
          tipo: produto.item.tipo,
          unidade: produto.item.unidade_label || produto.item.unidade,
          quantidade: produto.quantidade,
          preco_unitario: Number(produto.item.preco || 0),
          subtotal: calculo.subtotal,
          largura: produto.largura || null,
          altura: produto.altura || null,
          comprimento: produto.comprimento || null,
          area_m2: calculo.areaM2,
          precificacao: produto.item.precificacao || 'unidade',
          detalhes_calculo: calculo.detalhes,
        }
      })

      const { error: itensError } = await supabase
        .from('order_items')
        .insert(itensPedido)

      if (itensError) {
        setMensagem(
          `Pedido criado, mas houve erro ao salvar itens: ${itensError.message}`
        )
        setEnviando(false)
        return
      }

      if (formaPagamento === 'pix') {
        await gerarPixDoPedido(pedidoData.id, totais.sinal > 0 ? totais.sinal : totais.total)
      }

      const numeroEmpresa = montarWhatsapp(empresa.whatsapp || '')

      if (numeroEmpresa) {
        const textoWhatsapp = `Olá! Acabei de enviar uma solicitação pelo site.

Nome: ${nome}
Itens: ${itensResumo}
Total: ${totais.temSobConsulta ? 'há item sob consulta' : formatarDinheiro(totais.total)}
${totais.sinal > 0 ? `Sinal: ${formatarDinheiro(totais.sinal)}` : ''}
Pagamento: ${formaPagamento}
${formaPagamento === 'cartao_credito' ? `Parcelas: ${parcelas}x` : ''}

${observacoes ? `Observações: ${observacoes}` : ''}`

        const link = `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(textoWhatsapp)}`
        setLinkWhatsapp(link)
      }

      setMensagem('Pedido enviado com sucesso.')
      setPedidoEnviado(true)
      setArquivo(null)
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido ao enviar pedido.'

      setMensagem(`Erro: ${mensagemErro}`)
    }

    setEnviando(false)
  }

  async function copiarPix() {
    if (!pixCopiaCola) return

    await navigator.clipboard.writeText(pixCopiaCola)
    setMensagem('Código Pix copiado com sucesso.')
  }

  function novoPedido() {
    setCarrinho([])
    setNome('')
    setTelefone('')
    setObservacoes('')
    setArquivo(null)
    limparResultadoPagamento()
    setMensagem('')
  }

  useEffect(() => {
    carregarDados()
  }, [slug])

  const corPrincipal = empresa?.cor_principal || '#05245c'

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <p className="font-bold text-slate-500">
            Carregando página...
          </p>
        </div>
      </main>
    )
  }

  if (!empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <h1 className="text-3xl font-black text-[#071b3a]">
            Empresa não encontrada
          </h1>

          <p className="mt-3 text-slate-600">
            {mensagem || 'Verifique se o link está correto.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-8 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="rounded-[2rem] border border-blue-50 bg-white/90 p-5 shadow-xl shadow-blue-950/5 backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              {empresa.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt={empresa.nome}
                  className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-blue-950/10"
                />
              ) : (
                <img
                  src="/icone-orcaly.png"
                  alt="Orçaly"
                  className="h-16 w-16 rounded-2xl bg-blue-50 object-contain p-2"
                />
              )}

              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.25em]"
                  style={{ color: corPrincipal }}
                >
                  Marketplace digital
                </p>

                <h1 className="mt-1 text-3xl font-black text-[#071b3a]">
                  {empresa.nome}
                </h1>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  {empresa.segmento || 'Produtos, serviços e solicitações'}
                  {empresa.cidade ? ` • ${empresa.cidade}` : ''}
                  {empresa.estado ? `/${empresa.estado}` : ''}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
              <p className="text-sm font-bold text-slate-500">
                Carrinho
              </p>

              <p className="mt-1 text-2xl font-black text-[#071b3a]">
                {carrinho.length} item(ns)
              </p>
            </div>
          </div>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section>
            <div className="mb-5">
              <p
                className="text-sm font-black uppercase tracking-[0.25em]"
                style={{ color: corPrincipal }}
              >
                Catálogo
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Escolha produtos ou serviços
              </h2>

              <p className="mt-2 text-slate-600">
                O valor pode ser calculado por unidade, metragem, milheiro, hora, diária ou orçamento.
              </p>
            </div>

            {itens.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
                <h3 className="text-2xl font-black text-[#071b3a]">
                  Nenhum item disponível
                </h3>

                <p className="mt-2 text-slate-600">
                  Esta empresa ainda não cadastrou produtos ou serviços ativos.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {itens.map((item) => (
                  <article
                    key={item.id}
                    className="group overflow-hidden rounded-[2rem] border border-blue-50 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl"
                  >
                    <div className="h-44 bg-blue-50">
                      {item.imagem_url ? (
                        <img
                          src={item.imagem_url}
                          alt={item.nome}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-5xl">
                          🧩
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">
                          {nomePrecificacao(item.precificacao)}
                        </span>

                        {item.destaque && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            Destaque
                          </span>
                        )}

                        {item.categoria && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            {item.categoria}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-xl font-black text-[#071b3a]">
                        {item.nome}
                      </h3>

                      {item.descricao && (
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                          {item.descricao}
                        </p>
                      )}

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-500">
                            {item.precificacao === 'sob_consulta'
                              ? 'Preço'
                              : 'A partir de'}
                          </p>

                          <p
                            className="text-2xl font-black"
                            style={{ color: corPrincipal }}
                          >
                            {item.precificacao === 'sob_consulta'
                              ? 'Sob consulta'
                              : formatarDinheiro(Number(item.preco || 0))}
                          </p>

                          {item.precificacao !== 'sob_consulta' && (
                            <p className="text-xs font-bold text-slate-400">
                              por {item.unidade_label || item.unidade || nomePrecificacao(item.precificacao)}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => adicionarAoCarrinho(item)}
                          className="rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:-translate-y-1"
                          style={{ backgroundColor: corPrincipal }}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <form
              onSubmit={enviarSolicitacao}
              className="rounded-[2rem] border border-blue-50 bg-white p-5 shadow-2xl shadow-blue-950/10 sm:p-6"
            >
              <p
                className="text-sm font-black uppercase tracking-[0.25em]"
                style={{ color: corPrincipal }}
              >
                Carrinho
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Resumo do pedido
              </h2>

              {carrinho.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-blue-100 bg-blue-50 p-6 text-center">
                  <p className="font-black text-[#071b3a]">
                    Seu carrinho está vazio
                  </p>

                  <p className="mt-2 text-sm text-slate-600">
                    Adicione um item do catálogo para continuar.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {carrinho.map((produto) => {
                    const calculo = calcularItem(produto)

                    return (
                      <div
                        key={produto.item.id}
                        className="rounded-3xl border border-blue-100 bg-blue-50 p-4"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="font-black text-[#071b3a]">
                              {produto.item.nome}
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-500">
                              {produto.item.precificacao === 'sob_consulta'
                                ? 'Valor sob consulta'
                                : `${formatarDinheiro(Number(produto.item.preco || 0))} por ${
                                    produto.item.unidade_label ||
                                    produto.item.unidade ||
                                    nomePrecificacao(produto.item.precificacao)
                                  }`}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removerDoCarrinho(produto.item.id)}
                            className="h-9 rounded-xl bg-white px-3 text-sm font-black text-red-600"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {produto.item.permite_largura && (
                            <input
                              value={produto.largura || ''}
                              onChange={(e) =>
                                atualizarItemCarrinho(
                                  produto.item.id,
                                  'largura',
                                  numeroSeguro(e.target.value)
                                )
                              }
                              placeholder="Largura em metros"
                              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-medium outline-none"
                            />
                          )}

                          {produto.item.permite_altura && (
                            <input
                              value={produto.altura || ''}
                              onChange={(e) =>
                                atualizarItemCarrinho(
                                  produto.item.id,
                                  'altura',
                                  numeroSeguro(e.target.value)
                                )
                              }
                              placeholder="Altura em metros"
                              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-medium outline-none"
                            />
                          )}

                          {produto.item.permite_comprimento && (
                            <input
                              value={produto.comprimento || ''}
                              onChange={(e) =>
                                atualizarItemCarrinho(
                                  produto.item.id,
                                  'comprimento',
                                  numeroSeguro(e.target.value)
                                )
                              }
                              placeholder="Comprimento em metros"
                              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-medium outline-none"
                            />
                          )}

                          {produto.item.permite_quantidade !== false && (
                            <input
                              value={produto.quantidade || ''}
                              onChange={(e) =>
                                atualizarItemCarrinho(
                                  produto.item.id,
                                  'quantidade',
                                  numeroSeguro(e.target.value)
                                )
                              }
                              placeholder={labelQuantidade(produto.item.precificacao)}
                              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-medium outline-none"
                            />
                          )}
                        </div>

                        <div className="mt-4 rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold text-slate-500">
                            Cálculo
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-600">
                            {calculo.detalhes}
                          </p>

                          <p className="mt-2 text-lg font-black text-[#05245c]">
                            {produto.item.precificacao === 'sob_consulta'
                              ? 'Sob consulta'
                              : formatarDinheiro(calculo.subtotal)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-5 rounded-3xl bg-[#f7fbff] p-5">
                <div className="flex justify-between gap-3">
                  <p className="font-bold text-slate-500">
                    Total calculado
                  </p>

                  <p className="text-2xl font-black text-[#071b3a]">
                    {totais.temSobConsulta
                      ? `${formatarDinheiro(totais.total)} + consulta`
                      : formatarDinheiro(totais.total)}
                  </p>
                </div>

                {totais.sinal > 0 && (
                  <>
                    <div className="mt-3 flex justify-between gap-3">
                      <p className="font-bold text-slate-500">
                        Sinal inicial
                      </p>

                      <p className="text-xl font-black text-emerald-700">
                        {formatarDinheiro(totais.sinal)}
                      </p>
                    </div>

                    <div className="mt-3 flex justify-between gap-3">
                      <p className="font-bold text-slate-500">
                        Restante
                      </p>

                      <p className="text-xl font-black text-[#05245c]">
                        {formatarDinheiro(totais.restante)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 grid gap-4">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Seu WhatsApp"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Descreva detalhes, prazo, endereço, dúvidas ou personalizações..."
                  rows={4}
                  className="resize-none rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <label className="grid cursor-pointer gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Arquivo de referência
                  </span>

                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-bold text-[#05245c] transition hover:bg-blue-100">
                    {arquivo ? arquivo.name : 'Clique para enviar imagem, PDF ou referência'}
                  </div>

                  <input
                    type="file"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <div>
                  <p className="mb-3 text-sm font-black text-[#071b3a]">
                    Forma de pagamento
                  </p>

                  <div className="grid gap-3">
                    {empresa.aceita_pix && (
                      <button
                        type="button"
                        onClick={() => setFormaPagamento('pix')}
                        className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                          formaPagamento === 'pix'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-blue-100 bg-white text-[#05245c]'
                        }`}
                      >
                        Pix {totais.sinal > 0 ? '- sinal inicial' : '- pagamento total'}
                      </button>
                    )}

                    {empresa.aceita_cartao && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFormaPagamento('cartao_credito')}
                          className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                            formaPagamento === 'cartao_credito'
                              ? 'border-blue-300 bg-blue-50 text-[#05245c]'
                              : 'border-blue-100 bg-white text-[#05245c]'
                          }`}
                        >
                          Cartão de crédito
                        </button>

                        {formaPagamento === 'cartao_credito' && (
                          <select
                            value={parcelas}
                            onChange={(e) => setParcelas(e.target.value)}
                            className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold text-[#071b3a] outline-none"
                          >
                            {Array.from({ length: 12 }).map((_, index) => (
                              <option key={index + 1} value={index + 1}>
                                {index + 1}x de{' '}
                                {formatarDinheiro(totais.total / (index + 1))}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => setFormaPagamento('cartao_debito')}
                          className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                            formaPagamento === 'cartao_debito'
                              ? 'border-blue-300 bg-blue-50 text-[#05245c]'
                              : 'border-blue-100 bg-white text-[#05245c]'
                          }`}
                        >
                          Cartão de débito
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setFormaPagamento('combinar')}
                      className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                        formaPagamento === 'combinar'
                          ? 'border-slate-300 bg-slate-50 text-slate-700'
                          : 'border-blue-100 bg-white text-[#05245c]'
                      }`}
                    >
                      Combinar pagamento com a empresa
                    </button>
                  </div>
                </div>

                <button
                  disabled={enviando || carrinho.length === 0 || pedidoEnviado}
                  className="rounded-2xl px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: corPrincipal }}
                >
                  {enviando
                    ? 'Enviando...'
                    : pedidoEnviado
                      ? 'Pedido enviado'
                      : 'Enviar pedido'}
                </button>

                {pixQrCode && (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                    <p className="font-black text-emerald-700">
                      Pix gerado com sucesso
                    </p>

                    <p className="mt-2 text-sm text-emerald-700">
                      Pague {formatarDinheiro(valorPixGerado)} para confirmar.
                    </p>

                    <img
                      src={pixQrCode}
                      alt="QR Code Pix"
                      className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white p-3"
                    />

                    <button
                      type="button"
                      onClick={copiarPix}
                      className="mt-4 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white"
                    >
                      Copiar código Pix
                    </button>
                  </div>
                )}

                {linkWhatsapp && (
                  <a
                    href={linkWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-center font-black text-white transition hover:-translate-y-1 hover:bg-emerald-600"
                  >
                    Continuar no WhatsApp
                  </a>
                )}

                {pedidoEnviado && (
                  <button
                    type="button"
                    onClick={novoPedido}
                    className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] transition hover:bg-blue-50"
                  >
                    Fazer novo pedido
                  </button>
                )}

                {formaPagamento.includes('cartao') && (
                  <p className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                    Pagamento por cartão será confirmado pela empresa. A integração automática com gateway entra na próxima etapa.
                  </p>
                )}
              </div>
            </form>
          </aside>
        </section>
      </section>
    </main>
  )
}
