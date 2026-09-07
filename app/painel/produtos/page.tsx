'use client'

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadPanelFile } from '@/lib/panel-storage'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import { getCatalogLabels, normalizeCatalogBusinessType } from '@/lib/catalog-labels'
import { getCompanyPublicUrl } from '@/lib/company-url'
import CommercialOfferModal from '@/components/catalog/CommercialOfferModal'
import ProductOptionsModal from '@/components/catalog/ProductOptionsModal'

type Empresa = {
  id: string
  nome: string
  slug: string
  business_type?: string | null
  site_template?: string | null
}

type ProdutoExtras = Record<string, unknown>

type ItemCatalogo = {
  id: string
  nome: string
  descricao: string | null
  categoria: string | null
  tipo: string | null
  unidade: string | null
  preco: number | null
  ativo: boolean | null
  destaque: boolean | null
  imagem_url: string | null
  image_urls?: string[] | null
  video_url?: string | null
  business_type?: string | null
  available?: boolean | null
  addons?: unknown[] | null
  variations?: unknown[] | null
  extras?: ProdutoExtras | null
  company_id: string | null
  created_at: string
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

type TipoPrecificacao = {
  id: string
  nome: string
  descricao: string
  unidade: string
  largura: boolean
  altura: boolean
  comprimento: boolean
  quantidade: boolean
}

type StatusFiltro = 'todos' | 'ativos' | 'inativos' | 'sem_foto' | 'com_video' | 'destaque' | 'promocao' | 'sob_consulta'

type Visualizacao = 'cards' | 'tabela'

const tiposPrecificacao: TipoPrecificacao[] = [
  {
    id: 'unidade',
    nome: 'Unidade',
    descricao: 'Preço x quantidade.',
    unidade: 'unidade',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'metro_quadrado',
    nome: 'Metro quadrado',
    descricao: 'Largura x altura x preço x quantidade.',
    unidade: 'm²',
    largura: true,
    altura: true,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'metro_linear',
    nome: 'Metro linear',
    descricao: 'Comprimento x preço x quantidade.',
    unidade: 'metro',
    largura: false,
    altura: false,
    comprimento: true,
    quantidade: true,
  },
  {
    id: 'milheiro',
    nome: 'Milheiro',
    descricao: 'Quantidade / 1000 x preço do milheiro.',
    unidade: 'milheiro',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'hora',
    nome: 'Hora',
    descricao: 'Horas x preço.',
    unidade: 'hora',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'diaria',
    nome: 'Diária',
    descricao: 'Diárias x preço.',
    unidade: 'diária',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'mensalidade',
    nome: 'Mensalidade',
    descricao: 'Meses x preço.',
    unidade: 'mês',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: true,
  },
  {
    id: 'sob_consulta',
    nome: 'Sob consulta',
    descricao: 'Não calcula automático. O cliente envia o pedido para orçamento.',
    unidade: 'orçamento',
    largura: false,
    altura: false,
    comprimento: false,
    quantidade: false,
  },
]

const statusFilters: Array<{ id: StatusFiltro; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'ativos', label: 'Ativos' },
  { id: 'inativos', label: 'Inativos' },
  { id: 'sem_foto', label: 'Sem foto' },
  { id: 'com_video', label: 'Com vídeo' },
  { id: 'destaque', label: 'Destaque' },
  { id: 'promocao', label: 'Promoção' },
  { id: 'sob_consulta', label: 'Sob consulta' },
]

function formatarDinheiro(valor: number) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function numeroDoCampo(valor: string) {
  const numero = Number(valor.replace(',', '.'))

  if (Number.isNaN(numero)) return 0

  return numero
}

function nomePrecificacao(id: string | null) {
  return tiposPrecificacao.find((tipo) => tipo.id === id)?.nome || 'Unidade'
}

function limitarTexto(texto: string | null | undefined, limite = 112) {
  const limpo = String(texto || '').trim()
  if (limpo.length <= limite) return limpo

  return `${limpo.slice(0, limite).trim()}...`
}

function extrasDoItem(item: ItemCatalogo) {
  return item.extras && typeof item.extras === 'object' && !Array.isArray(item.extras) ? item.extras : {}
}

function imagensDoItem(item: ItemCatalogo) {
  const urls = Array.isArray(item.image_urls) ? item.image_urls.filter(Boolean) : []
  const legado = item.imagem_url ? [item.imagem_url] : []

  return Array.from(new Set([...urls, ...legado])).slice(0, 4)
}

function imagemPrincipal(item: ItemCatalogo) {
  return imagensDoItem(item)[0] || ''
}

function temFoto(item: ItemCatalogo) {
  return Boolean(imagemPrincipal(item))
}

function temVideo(item: ItemCatalogo) {
  return Boolean(String(item.video_url || '').trim())
}

function itemAtivo(item: ItemCatalogo) {
  return item.ativo !== false && item.available !== false
}

function itemDestaque(item: ItemCatalogo) {
  const extras = extrasDoItem(item)

  return Boolean(item.destaque || extras.destaque || extras.featured || extras.highlight)
}

function itemPromocao(item: ItemCatalogo) {
  const extras = extrasDoItem(item)

  return Boolean(extras.promocao || extras.promotion || extras.oferta || extras.offer)
}

function itemSobConsulta(item: ItemCatalogo) {
  const extras = extrasDoItem(item)

  return Boolean(item.precificacao === 'sob_consulta' || extras.sob_consulta === true)
}

function labelPreco(item: ItemCatalogo) {
  if (itemSobConsulta(item)) return 'Sob consulta'

  return formatarDinheiro(Number(item.preco || 0))
}

function camposDoItem(item: ItemCatalogo) {
  return [
    item.permite_quantidade !== false ? 'quantidade' : '',
    item.permite_largura ? 'largura' : '',
    item.permite_altura ? 'altura' : '',
    item.permite_comprimento ? 'comprimento' : '',
  ].filter(Boolean)
}

function painelCopy(businessType: unknown) {
  const normalized = normalizeCatalogBusinessType(businessType)
  const labels = getCatalogLabels(normalized)

  if (normalized === 'food') {
    return {
      titulo: 'Cardápio',
      subtitulo: 'Gerencie itens, combos, bebidas e adicionais que aparecem para seus clientes.',
      novo: 'Novo item do cardápio',
      publico: 'Ver cardápio público',
      vazioTitulo: 'Seu cardápio ainda está vazio.',
      vazioTexto: 'Cadastre seu primeiro item para começar a receber pedidos pelo seu site.',
      vazioBotao: 'Adicionar item do cardápio',
      formulario: 'Novo item',
    }
  }

  if (normalized === 'graphic' || normalized === 'custom_products') {
    return {
      titulo: 'Produtos gráficos',
      subtitulo: 'Cadastre serviços, impressos, personalizados e produtos sob orçamento.',
      novo: 'Novo produto gráfico',
      publico: 'Ver catálogo público',
      vazioTitulo: 'Seus produtos gráficos ainda não foram cadastrados.',
      vazioTexto: 'Cadastre impressos, personalizados ou serviços sob orçamento para apresentar aos seus clientes.',
      vazioBotao: 'Adicionar produto gráfico',
      formulario: 'Novo produto gráfico',
    }
  }

  if (normalized === 'beauty' || normalized === 'barber') {
    return {
      titulo: 'Serviços',
      subtitulo: 'Gerencie serviços, pacotes e atendimentos disponíveis para seus clientes.',
      novo: 'Novo serviço',
      publico: 'Ver página pública',
      vazioTitulo: 'Seus serviços ainda não foram cadastrados.',
      vazioTexto: 'Cadastre serviços, pacotes ou atendimentos para que seus clientes possam agendar ou solicitar informações.',
      vazioBotao: 'Adicionar serviço',
      formulario: 'Novo serviço',
    }
  }

  if (normalized === 'technical_assistance') {
    return {
      titulo: 'Serviços técnicos',
      subtitulo: 'Gerencie serviços técnicos, diagnósticos e opções de atendimento.',
      novo: 'Novo serviço técnico',
      publico: 'Ver catálogo público',
      vazioTitulo: 'Seus serviços técnicos ainda não foram cadastrados.',
      vazioTexto: 'Cadastre seu primeiro serviço técnico para orientar seus clientes.',
      vazioBotao: 'Adicionar serviço técnico',
      formulario: 'Novo serviço técnico',
    }
  }

  if (normalized === 'auto') {
    return {
      titulo: 'Serviços automotivos',
      subtitulo: 'Gerencie serviços, pacotes e orçamentos automotivos exibidos aos clientes.',
      novo: 'Novo serviço automotivo',
      publico: 'Ver catálogo público',
      vazioTitulo: 'Seus serviços automotivos ainda não foram cadastrados.',
      vazioTexto: 'Cadastre serviços para sua oficina apresentar opções e receber orçamentos.',
      vazioBotao: 'Adicionar serviço automotivo',
      formulario: 'Novo serviço automotivo',
    }
  }

  if (normalized === 'store') {
    return {
      titulo: 'Produtos',
      subtitulo: 'Gerencie os produtos exibidos no catálogo da sua loja.',
      novo: 'Novo produto',
      publico: 'Ver loja pública',
      vazioTitulo: 'Sua loja ainda não tem produtos.',
      vazioTexto: 'Cadastre o primeiro produto para começar a montar sua vitrine.',
      vazioBotao: 'Adicionar produto',
      formulario: 'Novo produto',
    }
  }

  return {
    titulo: labels.catalogTitle || 'Catálogo',
    subtitulo: 'Gerencie os produtos, serviços e itens que aparecem no site da sua empresa.',
    novo: labels.itemLabel ? `Novo ${labels.itemLabel.toLowerCase()}` : 'Novo item',
    publico: 'Ver página pública',
    vazioTitulo: 'Seu catálogo ainda está vazio.',
    vazioTexto: 'Cadastre produtos ou serviços para que seus clientes possam conhecer, pedir ou solicitar orçamento pelo seu site.',
    vazioBotao: 'Adicionar primeiro item',
    formulario: 'Novo item',
  }
}

function badgeClass(kind: 'blue' | 'green' | 'red' | 'slate' | 'amber') {
  const classes = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
  }

  return classes[kind]
}

export default function ProdutosPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [itens, setItens] = useState<ItemCatalogo[]>([])

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tipo, setTipo] = useState('produto')
  const [unidade, setUnidade] = useState('unidade')
  const [preco, setPreco] = useState('')
  const [destaque, setDestaque] = useState(false)
  const [arquivosImagens, setArquivosImagens] = useState<File[]>([])
  const [arquivoVideo, setArquivoVideo] = useState<File | null>(null)

  const [precificacao, setPrecificacao] = useState('unidade')
  const [unidadeLabel, setUnidadeLabel] = useState('unidade')
  const [permiteLargura, setPermiteLargura] = useState(false)
  const [permiteAltura, setPermiteAltura] = useState(false)
  const [permiteComprimento, setPermiteComprimento] = useState(false)
  const [permiteQuantidade, setPermiteQuantidade] = useState(true)
  const [valorMinimo, setValorMinimo] = useState('')
  const [cobrarSinalPersonalizado, setCobrarSinalPersonalizado] = useState(false)
  const [percentualSinalProduto, setPercentualSinalProduto] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('cards')
  const [ofertaItem, setOfertaItem] = useState<ItemCatalogo | null>(null)
  const [opcoesItem, setOpcoesItem] = useState<ItemCatalogo | null>(null)

  async function carregarDados() {
    setCarregando(true)
    setMensagem('')

    const { data: sessaoData } = await supabase.auth.getSession()
    const usuario = sessaoData.session?.user

    if (!usuario) {
      router.push('/login')
      return
    }

    let empresaData: Empresa

    try {
      const current = await getCurrentCompanyClient()
      empresaData = current.company as Empresa
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Nenhuma empresa vinculada a esta conta.')
      setCarregando(false)
      return
    }

    setEmpresa(empresaData)

    const { data: itensData, error: itensError } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', empresaData.id)
      .eq('arquivado', false)
      .order('created_at', { ascending: false })

    if (itensError) {
      setMensagem(`Erro ao carregar catálogo: ${itensError.message}`)
      setCarregando(false)
      return
    }

    setItens((itensData || []) as ItemCatalogo[])
    setCarregando(false)
  }

  async function enviarImagem(arquivo: File) {
    // ORCALY_PRODUCT_STORAGE_V1
    if (!empresa?.id) throw new Error('Empresa não carregada.')

    const upload = await uploadPanelFile({
      companyId: empresa.id,
      file: arquivo,
      purpose: 'product-image',
    })

    if (!upload.url) throw new Error('A URL pública da imagem não foi criada.')
    return upload.url
  }

  async function enviarVideo(arquivo: File) {
    if (!arquivo.type.startsWith('video/')) {
      throw new Error('Envie um vídeo válido.')
    }

    if (arquivo.size > 25 * 1024 * 1024) {
      throw new Error('O vídeo precisa ter até 25 MB.')
    }

    const duracao = await obterDuracaoVideo(arquivo)

    if (duracao > 30.5) {
      throw new Error('O vídeo precisa ter no máximo 30 segundos.')
    }

    if (!empresa?.id) throw new Error('Empresa não carregada.')

    const upload = await uploadPanelFile({
      companyId: empresa.id,
      file: arquivo,
      purpose: 'product-video',
    })

    if (!upload.url) throw new Error('A URL pública do vídeo não foi criada.')
    return upload.url
  }

  function obterDuracaoVideo(arquivo: File) {
    return new Promise<number>((resolve, reject) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(arquivo)

      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(video.duration || 0)
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Não foi possível validar a duração do vídeo.'))
      }
      video.src = url
    })
  }

  function selecionarImagens(files: FileList | null) {
    const selecionadas = Array.from(files || []).filter((file) => file.type.startsWith('image/'))

    if (selecionadas.length > 4) {
      setMensagem('Você pode selecionar no máximo 4 fotos por item.')
    }

    setArquivosImagens(selecionadas.slice(0, 4))
  }

  function aplicarTipoPrecificacao(id: string) {
    const tipoSelecionado = tiposPrecificacao.find((item) => item.id === id)

    setPrecificacao(id)

    if (!tipoSelecionado) return

    setUnidadeLabel(tipoSelecionado.unidade)
    setUnidade(tipoSelecionado.unidade)
    setPermiteLargura(tipoSelecionado.largura)
    setPermiteAltura(tipoSelecionado.altura)
    setPermiteComprimento(tipoSelecionado.comprimento)
    setPermiteQuantidade(tipoSelecionado.quantidade)
  }

  function limparFormulario() {
    setNome('')
    setDescricao('')
    setCategoria('')
    setTipo('produto')
    setUnidade('unidade')
    setPreco('')
    setDestaque(false)
    setArquivosImagens([])
    setArquivoVideo(null)

    setPrecificacao('unidade')
    setUnidadeLabel('unidade')
    setPermiteLargura(false)
    setPermiteAltura(false)
    setPermiteComprimento(false)
    setPermiteQuantidade(true)
    setValorMinimo('')
    setCobrarSinalPersonalizado(false)
    setPercentualSinalProduto('')

    setEditandoId(null)
  }

  function preencherEdicao(item: ItemCatalogo) {
    setEditandoId(item.id)
    setNome(item.nome || '')
    setDescricao(item.descricao || '')
    setCategoria(item.categoria || '')
    setTipo(item.tipo || 'produto')
    setUnidade(item.unidade || item.unidade_label || 'unidade')
    setPreco(String(item.preco || ''))
    setDestaque(Boolean(item.destaque))

    setPrecificacao(item.precificacao || 'unidade')
    setUnidadeLabel(item.unidade_label || item.unidade || 'unidade')
    setPermiteLargura(Boolean(item.permite_largura))
    setPermiteAltura(Boolean(item.permite_altura))
    setPermiteComprimento(Boolean(item.permite_comprimento))
    setPermiteQuantidade(item.permite_quantidade !== false)
    setValorMinimo(String(item.valor_minimo || ''))
    setCobrarSinalPersonalizado(Boolean(item.cobrar_sinal_personalizado))
    setPercentualSinalProduto(String(item.percentual_sinal_produto || ''))

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function salvarItem(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!empresa) return

    const precoNumero = numeroDoCampo(preco)
    const valorMinimoNumero = numeroDoCampo(valorMinimo)
    const percentualSinalNumero = numeroDoCampo(percentualSinalProduto)

    if (!nome || !tipo || Number.isNaN(precoNumero)) {
      setMensagem('Preencha nome, tipo e preço corretamente.')
      return
    }

    if (cobrarSinalPersonalizado && (percentualSinalNumero <= 0 || percentualSinalNumero > 100)) {
      setMensagem('O sinal do produto precisa ficar entre 1% e 100%.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      const itemAtual = editandoId ? itens.find((item) => item.id === editandoId) : null
      const imagensAtuais = Array.isArray(itemAtual?.image_urls)
        ? itemAtual?.image_urls?.filter(Boolean) || []
        : itemAtual?.imagem_url
          ? [itemAtual.imagem_url]
          : []
      const novasImagens = arquivosImagens.length
        ? await Promise.all(arquivosImagens.slice(0, 4).map((arquivo) => enviarImagem(arquivo)))
        : []
      const imageUrls = [...imagensAtuais, ...novasImagens].slice(0, 4)
      const videoUrl = arquivoVideo ? await enviarVideo(arquivoVideo) : itemAtual?.video_url || null
      const imagemUrl = imageUrls[0] || ''

      const dadosProduto = {
        nome,
        descricao,
        categoria,
        tipo,
        unidade: unidadeLabel || unidade,
        unidade_label: unidadeLabel || unidade,
        preco: precoNumero,
        destaque,
        imagem_url: imagemUrl || undefined,
        image_urls: imageUrls,
        video_url: videoUrl,
        precificacao,
        permite_largura: permiteLargura,
        permite_altura: permiteAltura,
        permite_comprimento: permiteComprimento,
        permite_quantidade: permiteQuantidade,
        valor_minimo: valorMinimoNumero,
        cobrar_sinal_personalizado: cobrarSinalPersonalizado,
        percentual_sinal_produto: cobrarSinalPersonalizado ? percentualSinalNumero : null,
        business_type: empresa.business_type || empresa.site_template || 'services',
        available: true,
      }

      if (editandoId) {
        const { error } = await supabase
          .from('products')
          .update({
            ...dadosProduto,
            imagem_url: imagemUrl || itemAtual?.imagem_url || null,
            image_urls: imageUrls,
            video_url: videoUrl,
          })
          .eq('id', editandoId)
          .eq('company_id', empresa.id)

        if (error) {
          setMensagem(`Erro ao atualizar item: ${error.message}`)
          setSalvando(false)
          return
        }

        setMensagem('Item atualizado com sucesso.')
      } else {
        const { error } = await supabase.from('products').insert({
          company_id: empresa.id,
          ...dadosProduto,
          imagem_url: imagemUrl || null,
          ativo: true,
        })

        if (error) {
          setMensagem(`Erro ao cadastrar item: ${error.message}`)
          setSalvando(false)
          return
        }

        setMensagem('Item cadastrado com sucesso.')
      }

      limparFormulario()
      await carregarDados()
    } catch (erro) {
      const textoErro = erro instanceof Error ? erro.message : 'Erro desconhecido.'

      setMensagem(`Erro: ${textoErro}`)
    }

    setSalvando(false)
  }

  async function alternarAtivo(item: ItemCatalogo) {
    if (!empresa) return

    const proximoStatus = !Boolean(item.ativo)
    const { error } = await supabase
      .from('products')
      .update({ ativo: proximoStatus })
      .eq('id', item.id)
      .eq('company_id', empresa.id)

    if (error) {
      setMensagem(`Erro ao alterar status: ${error.message}`)
      return
    }

    setItens((listaAtual) =>
      listaAtual.map((produto) => (produto.id === item.id ? { ...produto, ativo: proximoStatus } : produto))
    )
  }

  async function excluirItem(itemId: string) {
    if (!empresa) return

    const confirmar = confirm('Remover este item do catálogo? O histórico de pedidos será preservado.')

    if (!confirmar) return

    const { error } = await supabase
      .from('products')
      .update({
        ativo: false,
        arquivado: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('company_id', empresa.id)

    if (error) {
      setMensagem(`Erro ao remover item: ${error.message}`)
      return
    }

    setItens((listaAtual) => listaAtual.filter((item) => item.id !== itemId))
    setMensagem('Item removido do catálogo.')
  }

  useEffect(() => {
    void carregarDados()
  }, [])

  const copy = useMemo(() => painelCopy(empresa?.business_type || empresa?.site_template), [empresa?.business_type, empresa?.site_template])
  const categorias = useMemo(() => {
    return Array.from(new Set(itens.map((item) => String(item.categoria || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [itens])

  const resumo = useMemo(() => {
    const ativos = itens.filter(itemAtivo).length
    const semFoto = itens.filter((item) => !temFoto(item)).length
    const comVideo = itens.filter(temVideo).length
    const destaques = itens.filter(itemDestaque).length
    const indisponiveis = itens.length - ativos

    return { ativos, semFoto, comVideo, destaques, indisponiveis }
  }, [itens])

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      const textoBusca = [item.nome, item.descricao, item.categoria].filter(Boolean).join(' ').toLowerCase()
      const bateBusca = !termo || textoBusca.includes(termo)
      const bateCategoria = filtroCategoria === 'Todas' || item.categoria === filtroCategoria
      const bateStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativos' && itemAtivo(item)) ||
        (filtroStatus === 'inativos' && !itemAtivo(item)) ||
        (filtroStatus === 'sem_foto' && !temFoto(item)) ||
        (filtroStatus === 'com_video' && temVideo(item)) ||
        (filtroStatus === 'destaque' && itemDestaque(item)) ||
        (filtroStatus === 'promocao' && itemPromocao(item)) ||
        (filtroStatus === 'sob_consulta' && itemSobConsulta(item))

      return bateBusca && bateCategoria && bateStatus
    })
  }, [busca, filtroCategoria, filtroStatus, itens])

  const publicUrl = empresa ? getCompanyPublicUrl(empresa.slug) : '#'

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto mb-6 h-14 w-auto object-contain" />
          <p className="font-bold text-slate-500">Carregando catálogo...</p>
        </div>
      </main>
    )
  }

  // ORCALY_PRODUCTS_MARKETPLACE_UI_V3
  function scrollToForm() {
    document.getElementById('editor-item')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const activeFilterCount = [
    filtroStatus !== 'todos',
    filtroCategoria !== 'Todas',
    Boolean(busca.trim()),
  ].filter(Boolean).length

  function clearFilters() {
    setBusca('')
    setFiltroCategoria('Todas')
    setFiltroStatus('todos')
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f5f5] pb-24 text-slate-950">
      <section className="border-b border-amber-200 bg-gradient-to-r from-[#fff1b8] via-[#fff8de] to-white">
        <div className="mx-auto grid w-full max-w-[1540px] gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-800">
              <span>Minha Vitrine</span>
              <span aria-hidden="true">/</span>
              <span>Central de anúncios</span>
            </div>

            <div className="mt-3 flex min-w-0 items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-2xl text-white shadow-lg shadow-blue-950/20">
                🛒
              </div>

              <div className="min-w-0">
                <h1 className="break-words text-3xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-4xl">
                  Produtos e serviços
                </h1>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600 sm:text-base">
                  Gerencie os anúncios exibidos na sua vitrine, com preço, mídia, estoque, ofertas e opções comerciais no mesmo lugar.
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[430px]">
            <button
              type="button"
              onClick={scrollToForm}
              className="flex min-h-12 items-center justify-center rounded-xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
            >
              + {copy.novo}
            </button>

            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-[#05245c] transition hover:-translate-y-0.5 hover:border-[#05245c]"
            >
              Ver como cliente ↗
            </a>

            <Link
              href="/painel/site"
              className="flex min-h-11 items-center justify-center rounded-xl border border-amber-200 bg-white/80 px-4 py-2 text-center text-sm font-black text-amber-900 transition hover:bg-white"
            >
              Personalizar vitrine
            </Link>

            <button
              type="button"
              onClick={carregarDados}
              className="flex min-h-11 items-center justify-center rounded-xl border border-amber-200 bg-white/80 px-4 py-2 text-center text-sm font-black text-amber-900 transition hover:bg-white"
            >
              Atualizar anúncios
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8">
        {mensagem ? (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-[#05245c]">
            {mensagem}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MarketplaceMetric
            label="Anúncios cadastrados"
            value={itens.length}
            detail="Total da sua operação"
            icon="📦"
          />
          <MarketplaceMetric
            label="Ativos na vitrine"
            value={resumo.ativos}
            detail="Visíveis para clientes"
            icon="✅"
            tone="green"
          />
          <MarketplaceMetric
            label="Precisam de atenção"
            value={resumo.semFoto + resumo.indisponiveis}
            detail="Sem foto ou indisponíveis"
            icon="⚠️"
            tone="amber"
          />
          <MarketplaceMetric
            label="Em destaque"
            value={resumo.destaques}
            detail="Com maior evidência"
            icon="⭐"
            tone="purple"
          />
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="relative block min-w-0">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-slate-400" aria-hidden="true">
                🔎
              </span>
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, descrição ou categoria..."
                className="h-13 w-full rounded-xl border border-slate-200 bg-[#f7f7f7] py-3 pl-12 pr-4 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setVisualizacao('cards')}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${visualizacao === 'cards' ? 'bg-[#05245c] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizacao('tabela')}
                  className={`rounded-lg px-4 py-2 text-xs font-black transition ${visualizacao === 'tabela' ? 'bg-[#05245c] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  Tabela
                </button>
              </div>

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black text-red-700 transition hover:bg-red-100"
                >
                  Limpar filtros ({activeFilterCount})
                </button>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusFilters.map((filter) => (
                <FilterChip
                  key={filter.id}
                  active={filtroStatus === filter.id}
                  onClick={() => setFiltroStatus(filter.id)}
                >
                  {filter.label}
                </FilterChip>
              ))}
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {['Todas', ...categorias].map((categoriaItem) => (
                <FilterChip
                  key={categoriaItem}
                  active={filtroCategoria === categoriaItem}
                  onClick={() => setFiltroCategoria(categoriaItem)}
                  secondary
                >
                  {categoriaItem}
                </FilterChip>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Seus anúncios</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
                  {itensFiltrados.length} resultado(s)
                </h2>
              </div>

              <p className="text-sm font-bold text-slate-500">
                Edite, publique, destaque ou ajuste o estoque sem sair desta tela.
              </p>
            </div>

            {itens.length === 0 ? (
              <MarketplaceEmptyState
                title={copy.vazioTitulo}
                text={copy.vazioTexto}
                button={copy.vazioBotao}
                onClick={scrollToForm}
              />
            ) : itensFiltrados.length === 0 ? (
              <MarketplaceEmptyState
                title="Nenhum anúncio encontrado"
                text="Ajuste a busca, a categoria ou o status para encontrar outros itens."
                button="Limpar filtros"
                onClick={clearFilters}
              />
            ) : visualizacao === 'cards' ? (
              <div className="grid gap-4">
                {itensFiltrados.map((item) => (
                  <MarketplaceProductCard
                    key={item.id}
                    item={item}
                    empresaSlug={empresa?.slug || ''}
                    onEdit={preencherEdicao}
                    onOffer={setOfertaItem}
                    onOptions={setOpcoesItem}
                    onToggle={alternarAtivo}
                    onDelete={excluirItem}
                  />
                ))}
              </div>
            ) : (
              <ProductTable
                items={itensFiltrados}
                empresaSlug={empresa?.slug || ''}
                onEdit={preencherEdicao}
                onOffer={setOfertaItem}
                onOptions={setOpcoesItem}
                onToggle={alternarAtivo}
                onDelete={excluirItem}
              />
            )}
          </div>

          <aside id="editor-item" className="scroll-mt-6 min-w-0">
            <form
              onSubmit={salvarItem}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5 2xl:sticky 2xl:top-6"
            >
              <div className="border-b border-slate-100 bg-[#fafafa] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                      {editandoId ? 'Editando anúncio' : 'Novo anúncio'}
                    </p>
                    <h2 className="mt-1 break-words text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
                      {editandoId ? nome || 'Produto ou serviço' : copy.formulario}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Preencha os dados essenciais e publique na sua vitrine.
                    </p>
                  </div>

                  {editandoId ? (
                    <button
                      type="button"
                      onClick={limparFormulario}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="max-h-none divide-y divide-slate-100 2xl:max-h-[calc(100vh-190px)] 2xl:overflow-y-auto">
                <EditorSection title="Informações do anúncio" icon="📝" open>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Nome</span>
                    <input
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      placeholder="Nome do produto ou serviço"
                      className="rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Descrição</span>
                    <textarea
                      value={descricao}
                      onChange={(event) => setDescricao(event.target.value)}
                      placeholder="Explique o item para o cliente"
                      rows={4}
                      className="resize-none rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold leading-6 outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-700">Categoria</span>
                      <input
                        value={categoria}
                        onChange={(event) => setCategoria(event.target.value)}
                        placeholder="Ex.: Camisetas"
                        className="min-w-0 rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-700">Tipo</span>
                      <select
                        value={tipo}
                        onChange={(event) => setTipo(event.target.value)}
                        className="min-w-0 rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-black outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="produto">Produto</option>
                        <option value="servico">Serviço</option>
                        <option value="locacao">Locação</option>
                        <option value="assinatura">Assinatura</option>
                      </select>
                    </label>
                  </div>
                </EditorSection>

                <EditorSection title="Preço e cobrança" icon="💰" open>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Tipo de precificação</span>
                    <select
                      value={precificacao}
                      onChange={(event) => aplicarTipoPrecificacao(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-black outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      {tiposPrecificacao.map((item) => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                    <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-[#05245c]">
                      {tiposPrecificacao.find((item) => item.id === precificacao)?.descricao}
                    </span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-700">Preço base</span>
                      <input
                        value={preco}
                        onChange={(event) => setPreco(event.target.value)}
                        placeholder="Ex.: 99,90"
                        inputMode="decimal"
                        className="min-w-0 rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-700">Unidade</span>
                      <input
                        value={unidadeLabel}
                        onChange={(event) => {
                          setUnidadeLabel(event.target.value)
                          setUnidade(event.target.value)
                        }}
                        placeholder="unidade, m², hora..."
                        className="min-w-0 rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Valor mínimo</span>
                    <input
                      value={valorMinimo}
                      onChange={(event) => setValorMinimo(event.target.value)}
                      placeholder="Ex.: 50,00"
                      inputMode="decimal"
                      className="rounded-xl border border-slate-200 bg-[#f7f7f7] px-4 py-3 font-bold outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </EditorSection>

                <EditorSection title="Configuração do pedido" icon="⚙️">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <ToggleChoice active={permiteQuantidade} onClick={() => setPermiteQuantidade(!permiteQuantidade)} label="Quantidade" />
                    <ToggleChoice active={permiteLargura} onClick={() => setPermiteLargura(!permiteLargura)} label="Largura" />
                    <ToggleChoice active={permiteAltura} onClick={() => setPermiteAltura(!permiteAltura)} label="Altura" />
                    <ToggleChoice active={permiteComprimento} onClick={() => setPermiteComprimento(!permiteComprimento)} label="Comprimento" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setCobrarSinalPersonalizado(!cobrarSinalPersonalizado)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                      cobrarSinalPersonalizado
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-[#f7f7f7] text-slate-600'
                    }`}
                  >
                    <span>{cobrarSinalPersonalizado ? 'Sinal personalizado ativado' : 'Usar sinal padrão da empresa'}</span>
                    <span>{cobrarSinalPersonalizado ? '✓' : '○'}</span>
                  </button>

                  {cobrarSinalPersonalizado ? (
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Percentual do sinal</span>
                      <input
                        value={percentualSinalProduto}
                        onChange={(event) => setPercentualSinalProduto(event.target.value)}
                        placeholder="Ex.: 50"
                        inputMode="decimal"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-bold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setDestaque(!destaque)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                      destaque
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-[#f7f7f7] text-slate-600'
                    }`}
                  >
                    <span>{destaque ? 'Anúncio em destaque' : 'Marcar como destaque'}</span>
                    <span>{destaque ? '★' : '☆'}</span>
                  </button>
                </EditorSection>

                <EditorSection title="Fotos e vídeo" icon="🖼️" open>
                  <label className="grid cursor-pointer gap-2">
                    <span className="text-sm font-black text-slate-700">Fotos, até 4 imagens</span>
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-[#fafafa] px-4 py-5 text-center text-sm font-bold leading-6 text-slate-600 transition hover:border-[#05245c] hover:bg-blue-50">
                      {arquivosImagens.length
                        ? `${arquivosImagens.length} foto(s) selecionada(s)`
                        : 'Clique para selecionar fotos do anúncio'}
                    </div>
                    <input type="file" accept="image/*" multiple onChange={(event) => selecionarImagens(event.target.files)} className="hidden" />
                  </label>

                  <label className="grid cursor-pointer gap-2">
                    <span className="text-sm font-black text-slate-700">Vídeo curto, opcional</span>
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-[#fafafa] px-4 py-5 text-center text-sm font-bold leading-6 text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50">
                      {arquivoVideo ? arquivoVideo.name : 'Clique para selecionar MP4, WEBM ou MOV'}
                    </div>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      onChange={(event) => setArquivoVideo(event.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </EditorSection>
              </div>

              <div className="grid gap-2 border-t border-slate-100 bg-white p-4 sm:grid-cols-2">
                <button
                  type="submit"
                  disabled={salvando}
                  className="min-h-12 rounded-xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Publicar anúncio'}
                </button>

                <button
                  type="button"
                  onClick={limparFormulario}
                  className="min-h-12 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                >
                  Limpar formulário
                </button>
              </div>
            </form>
          </aside>
        </section>
      </section>

      {empresa && ofertaItem ? (
        <CommercialOfferModal
          item={ofertaItem}
          companyId={empresa.id}
          onClose={() => setOfertaItem(null)}
          onSaved={carregarDados}
        />
      ) : null}

      {empresa && opcoesItem ? (
        <ProductOptionsModal
          item={opcoesItem}
          companyId={empresa.id}
          onClose={() => setOpcoesItem(null)}
          onSaved={carregarDados}
        />
      ) : null}
    </main>
  )
}

function MarketplaceMetric({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
}: {
  label: string
  value: number
  detail: string
  icon: string
  tone?: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const classes = {
    blue: 'bg-blue-50 text-[#05245c]',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    purple: 'bg-violet-50 text-violet-700',
  }[tone]

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">{value}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{detail}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${classes}`}>{icon}</span>
      </div>
    </article>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  secondary = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-black transition ${
        active
          ? secondary
            ? 'border-amber-300 bg-amber-100 text-amber-900'
            : 'border-[#05245c] bg-[#05245c] text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function EditorSection({
  title,
  icon,
  children,
  open = false,
}: {
  title: string
  icon: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-base">{icon}</span>
          <span className="min-w-0 font-black text-[#071b3a]">{title}</span>
        </span>
        <span className="text-lg font-black text-slate-400 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="grid gap-4 px-5 pb-5">{children}</div>
    </details>
  )
}

function ToggleChoice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-black transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-[#05245c]'
          : 'border-slate-200 bg-[#f7f7f7] text-slate-500'
      }`}
    >
      <span>{label}</span>
      <span>{active ? '✓' : '○'}</span>
    </button>
  )
}

function productQualityScore(item: ItemCatalogo) {
  let score = 20
  if (item.nome?.trim()) score += 15
  if (item.descricao?.trim()) score += 15
  if (item.categoria?.trim()) score += 10
  if (temFoto(item)) score += 25
  if (temVideo(item)) score += 5
  if (Number(item.preco || 0) > 0 || itemSobConsulta(item)) score += 10
  return Math.min(score, 100)
}

function inventoryLabel(item: ItemCatalogo) {
  const extras = extrasDoItem(item)
  const controlled = extras.controle_estoque === true || extras.stock_control === true
  const quantity = Math.max(0, Math.floor(Number(extras.estoque ?? extras.stock ?? extras.stock_quantity ?? 0)))

  if (!controlled) return 'Estoque não controlado'
  if (quantity <= 0) return 'Sem estoque'
  return `${quantity} em estoque`
}

function MarketplaceProductCard({
  item,
  empresaSlug,
  onEdit,
  onOffer,
  onOptions,
  onToggle,
  onDelete,
}: {
  item: ItemCatalogo
  empresaSlug: string
  onEdit: (item: ItemCatalogo) => void
  onOffer: (item: ItemCatalogo) => void
  onOptions: (item: ItemCatalogo) => void
  onToggle: (item: ItemCatalogo) => void
  onDelete: (itemId: string) => void
}) {
  const image = imagemPrincipal(item)
  const quality = productQualityScore(item)
  const active = itemAtivo(item)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-lg hover:shadow-slate-950/5">
      <div className="grid min-w-0 md:grid-cols-[190px_minmax(0,1fr)]">
        <div className="relative min-h-52 overflow-hidden bg-[#f7f7f7] md:min-h-full">
          {image ? (
            <img src={image} alt={item.nome} className="h-full min-h-52 w-full object-cover" />
          ) : (
            <div className="grid h-full min-h-52 place-items-center p-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">🖼️</span>
                <p className="mt-3 text-sm font-black text-slate-500">Adicione uma foto</p>
              </div>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <StatusBadge label={active ? 'Ativo' : 'Pausado'} tone={active ? 'green' : 'red'} />
            {itemDestaque(item) ? <StatusBadge label="Destaque" tone="amber" /> : null}
          </div>
        </div>

        <div className="min-w-0 p-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={item.categoria || 'Sem categoria'} tone="blue" />
                {itemPromocao(item) ? <StatusBadge label="Promoção" tone="amber" /> : null}
                {itemSobConsulta(item) ? <StatusBadge label="Sob consulta" tone="slate" /> : null}
              </div>

              <h3 className="mt-3 break-words text-xl font-black tracking-[-0.03em] text-[#071b3a]">
                {item.nome}
              </h3>
              <p className="mt-2 line-clamp-2 break-words text-sm font-bold leading-6 text-slate-500">
                {limitarTexto(item.descricao, 150) || 'Adicione uma descrição para melhorar a apresentação do anúncio.'}
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Preço</p>
              <p className="mt-1 break-words text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
                {labelPreco(item)}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-400">por {item.unidade_label || item.unidade || 'unidade'}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 rounded-xl bg-[#f7f7f7] p-3 text-xs font-bold text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <p>📷 {imagensDoItem(item).length} foto(s)</p>
            <p>{temVideo(item) ? '🎬 Com vídeo' : '🎬 Sem vídeo'}</p>
            <p>📦 {inventoryLabel(item)}</p>
            <p>💳 Mínimo {formatarDinheiro(Number(item.valor_minimo || 0))}</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs font-black">
              <span className="text-slate-500">Qualidade do anúncio</span>
              <span className={quality >= 80 ? 'text-emerald-700' : quality >= 55 ? 'text-amber-700' : 'text-red-700'}>{quality}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${quality >= 80 ? 'bg-emerald-500' : quality >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${quality}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="min-h-11 whitespace-normal rounded-xl bg-[#05245c] px-4 py-3 text-center text-sm font-black leading-tight text-white transition hover:bg-[#031a43]"
            >
              Editar anúncio
            </button>

            <button
              type="button"
              onClick={() => onOffer(item)}
              className="min-h-11 whitespace-normal rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-black leading-tight text-amber-900 transition hover:bg-amber-100"
            >
              Oferta e estoque
            </button>

            <button
              type="button"
              onClick={() => onOptions(item)}
              className="min-h-11 whitespace-normal rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black leading-tight text-emerald-800 transition hover:bg-emerald-100"
            >
              Variações e opções
            </button>

            <a
              href={empresaSlug ? getCompanyPublicUrl(empresaSlug) : '#'}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center whitespace-normal rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black leading-tight text-[#05245c] transition hover:bg-slate-50"
            >
              Ver na vitrine
            </a>

            <button
              type="button"
              onClick={() => onToggle(item)}
              className="min-h-11 whitespace-normal rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black leading-tight text-slate-600 transition hover:bg-slate-50"
            >
              {active ? 'Pausar anúncio' : 'Ativar anúncio'}
            </button>

            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="min-h-11 whitespace-normal rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-black leading-tight text-red-700 transition hover:bg-red-100"
            >
              Arquivar anúncio
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function StatusBadge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'red' | 'slate' | 'amber' }) {
  const classes = {
    blue: 'border-blue-100 bg-blue-50 text-[#05245c]',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone]

  return <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${classes}`}>{label}</span>
}

function MarketplaceEmptyState({ title, text, button, onClick }: { title: string; text: string; button: string; onClick: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-3xl">🛍️</span>
      <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">{text}</p>
      <button type="button" onClick={onClick} className="mt-6 rounded-xl bg-[#05245c] px-5 py-3 font-black text-white">
        {button}
      </button>
    </div>
  )
}

function ProductTable({
  items,
  empresaSlug,
  onEdit,
  onOffer,
  onOptions,
  onToggle,
  onDelete,
}: {
  items: ItemCatalogo[]
  empresaSlug: string
  onEdit: (item: ItemCatalogo) => void
  onOffer: (item: ItemCatalogo) => void
  onOptions: (item: ItemCatalogo) => void
  onToggle: (item: ItemCatalogo) => void
  onDelete: (itemId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-[#f7f7f7] text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th className="px-4 py-4">Anúncio</th>
              <th className="px-4 py-4">Preço</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Estoque</th>
              <th className="px-4 py-4">Qualidade</th>
              <th className="px-4 py-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const quality = productQualityScore(item)
              const active = itemAtivo(item)

              return (
                <tr key={item.id} className="align-middle transition hover:bg-[#fcfcfc]">
                  <td className="px-4 py-4">
                    <div className="flex min-w-[300px] items-center gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {imagemPrincipal(item) ? (
                          <img src={imagemPrincipal(item)} alt={item.nome} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-lg">🖼️</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[280px] break-words font-black text-[#071b3a]">{item.nome}</p>
                        <p className="mt-1 max-w-[280px] break-words text-xs font-bold leading-5 text-slate-500">
                          {item.categoria || 'Sem categoria'} · {imagensDoItem(item).length} foto(s)
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[160px] break-words px-4 py-4 font-black text-[#071b3a]">{labelPreco(item)}</td>
                  <td className="px-4 py-4"><StatusBadge label={active ? 'Ativo' : 'Pausado'} tone={active ? 'green' : 'red'} /></td>
                  <td className="max-w-[170px] break-words px-4 py-4 font-bold text-slate-600">{inventoryLabel(item)}</td>
                  <td className="px-4 py-4">
                    <div className="w-28">
                      <div className="flex justify-between text-xs font-black text-slate-500"><span>Qualidade</span><span>{quality}%</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${quality >= 80 ? 'bg-emerald-500' : quality >= 55 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${quality}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-[310px] grid-cols-3 gap-2">
                      <button type="button" onClick={() => onEdit(item)} className="rounded-lg bg-[#05245c] px-3 py-2 text-xs font-black text-white">Editar</button>
                      <button type="button" onClick={() => onOffer(item)} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">Oferta</button>
                      <button type="button" onClick={() => onOptions(item)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Opções</button>
                      <a href={empresaSlug ? getCompanyPublicUrl(empresaSlug) : '#'} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-black text-[#05245c]">Vitrine</a>
                      <button type="button" onClick={() => onToggle(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">{active ? 'Pausar' : 'Ativar'}</button>
                      <button type="button" onClick={() => onDelete(item.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700">Arquivar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
