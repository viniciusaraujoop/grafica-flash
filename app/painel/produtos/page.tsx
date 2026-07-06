'use client'

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import { getCatalogLabels, normalizeCatalogBusinessType } from '@/lib/catalog-labels'
import { getCompanyPublicUrl } from '@/lib/company-url'

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

function limparNomeArquivo(nome: string) {
  return nome
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
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

  async function enviarImagem(companyId: string, arquivo: File) {
    const nomeArquivo = limparNomeArquivo(arquivo.name)
    const caminho = `${companyId}/${Date.now()}-${nomeArquivo}`

    const { error } = await supabase.storage
      .from('produtos')
      .upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = supabase.storage.from('produtos').getPublicUrl(caminho)

    return data.publicUrl
  }

  async function enviarVideo(companyId: string, arquivo: File) {
    if (!arquivo.type.startsWith('video/')) {
      throw new Error('Envie um vídeo válido.')
    }

    if (arquivo.size > 50 * 1024 * 1024) {
      throw new Error('O vídeo precisa ter até 50 MB.')
    }

    const duracao = await obterDuracaoVideo(arquivo)

    if (duracao > 30.5) {
      throw new Error('O vídeo precisa ter no máximo 30 segundos.')
    }

    const nomeArquivo = limparNomeArquivo(arquivo.name)
    const caminho = `${companyId}/videos/${Date.now()}-${nomeArquivo}`

    const { error } = await supabase.storage.from('produtos').upload(caminho, arquivo, {
      cacheControl: '3600',
      upsert: true,
    })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('produtos').getPublicUrl(caminho)
    return data.publicUrl
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
        ? await Promise.all(arquivosImagens.slice(0, 4).map((arquivo) => enviarImagem(empresa.id, arquivo)))
        : []
      const imageUrls = [...imagensAtuais, ...novasImagens].slice(0, 4)
      const videoUrl = arquivoVideo ? await enviarVideo(empresa.id, arquivoVideo) : itemAtual?.video_url || null
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] pb-24 text-slate-950">
      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="rounded-[2.4rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/10 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <img src="/icone-orcaly.png" alt="Orçaly" className="h-14 w-14 rounded-2xl bg-blue-50 object-contain p-2" />

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#05245c]">Catálogo do painel</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#071b3a] sm:text-5xl">{copy.titulo}</h1>
                <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">{copy.subtitulo}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 430, behavior: 'smooth' })}
                className="rounded-2xl bg-[#05245c] px-5 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-[#031a43]"
              >
                {copy.novo}
              </button>

              <a
                href={publicUrl}
                target="_blank"
                className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
              >
                {copy.publico}
              </a>

              <button
                type="button"
                onClick={carregarDados}
                className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
              >
                Atualizar lista
              </button>
            </div>
          </div>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <ResumoCard label="Total de itens" value={itens.length} />
          <ResumoCard label="Ativos no site" value={resumo.ativos} tone="green" />
          <ResumoCard label="Indisponíveis" value={resumo.indisponiveis} tone="red" />
          <ResumoCard label="Sem foto" value={resumo.semFoto} tone="amber" />
          <ResumoCard label="Com vídeo" value={resumo.comVideo} />
          {resumo.destaques > 0 && <ResumoCard label="Em destaque" value={resumo.destaques} tone="green" />}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <form onSubmit={salvarItem} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <div className="mb-6">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">{editandoId ? 'Editar item' : copy.formulario}</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">Configurar cobrança</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                Cadastre preço, mídia, categoria e regras que aparecem no site da empresa.
              </p>
            </div>

            <div className="grid gap-4">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do produto ou serviço"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição curta para o cliente entender o que está contratando"
                rows={4}
                className="resize-none rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Categoria. Ex: impressão, manutenção, aluguel"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold text-[#071b3a] outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                >
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                  <option value="locacao">Locação</option>
                  <option value="assinatura">Assinatura</option>
                </select>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-[#071b3a]">Tipo de precificação</span>

                <select
                  value={precificacao}
                  onChange={(e) => aplicarTipoPrecificacao(e.target.value)}
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold text-[#071b3a] outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                >
                  {tiposPrecificacao.map((item) => (
                    <option key={item.id} value={item.id}>{item.nome}</option>
                  ))}
                </select>

                <span className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-[#05245c]">
                  {tiposPrecificacao.find((item) => item.id === precificacao)?.descricao}
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="Preço base. Ex: 197"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <input
                  value={unidadeLabel}
                  onChange={(e) => {
                    setUnidadeLabel(e.target.value)
                    setUnidade(e.target.value)
                  }}
                  placeholder="Nome da unidade. Ex: m², milheiro, hora"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <input
                value={valorMinimo}
                onChange={(e) => setValorMinimo(e.target.value)}
                placeholder="Valor mínimo. Ex: 50"
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <div className="grid gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                <p className="font-black text-[#071b3a]">Campos que o cliente deverá preencher</p>
                <ToggleButton active={permiteQuantidade} onClick={() => setPermiteQuantidade(!permiteQuantidade)} label="Quantidade" />
                <ToggleButton active={permiteLargura} onClick={() => setPermiteLargura(!permiteLargura)} label="Largura" />
                <ToggleButton active={permiteAltura} onClick={() => setPermiteAltura(!permiteAltura)} label="Altura" />
                <ToggleButton active={permiteComprimento} onClick={() => setPermiteComprimento(!permiteComprimento)} label="Comprimento" />
              </div>

              <div className="grid gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <button
                  type="button"
                  onClick={() => setCobrarSinalPersonalizado(!cobrarSinalPersonalizado)}
                  className={`rounded-2xl px-4 py-4 text-left font-black ${cobrarSinalPersonalizado ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}
                >
                  {cobrarSinalPersonalizado ? 'Este item tem sinal próprio' : 'Usar sinal padrão da empresa'}
                </button>

                {cobrarSinalPersonalizado && (
                  <input
                    value={percentualSinalProduto}
                    onChange={(e) => setPercentualSinalProduto(e.target.value)}
                    placeholder="Percentual do sinal. Ex: 50"
                    className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                )}
              </div>

              <label className="grid cursor-pointer gap-2">
                <span className="text-sm font-black text-[#071b3a]">Fotos do marketplace, até 4 imagens</span>
                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-bold text-[#05245c] transition hover:bg-blue-100">
                  {arquivosImagens.length ? `${arquivosImagens.length} foto(s) selecionada(s)` : 'Clique para enviar até 4 fotos do item'}
                </div>
                <input type="file" accept="image/*" multiple onChange={(e) => selecionarImagens(e.target.files)} className="hidden" />
              </label>

              <label className="grid cursor-pointer gap-2">
                <span className="text-sm font-black text-[#071b3a]">Vídeo curto, opcional, até 30 segundos</span>
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100">
                  {arquivoVideo ? arquivoVideo.name : 'Clique para enviar um vídeo MP4/WebM/MOV'}
                </div>
                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" onChange={(e) => setArquivoVideo(e.target.files?.[0] || null)} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => setDestaque(!destaque)}
                className={`rounded-2xl px-4 py-4 text-left font-black transition ${destaque ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
              >
                {destaque ? 'Item em destaque' : 'Marcar como destaque'}
              </button>

              <button disabled={salvando} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60">
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar item'}
              </button>

              {editandoId && (
                <button type="button" onClick={limparFormulario} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] transition hover:bg-blue-50">
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <div className="mb-5 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">Gestão do catálogo</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">Itens cadastrados</h2>
                <p className="mt-2 text-sm font-bold text-slate-500">Visualize mídia, status, preço e ações principais sem sair da tela.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisualizacao('cards')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${visualizacao === 'cards' ? 'bg-[#05245c] text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizacao('tabela')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black ${visualizacao === 'tabela' ? 'bg-[#05245c] text-white' : 'border border-blue-100 bg-white text-[#05245c]'}`}
                >
                  Tabela
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.6rem] border border-blue-100 bg-[#f8fbff] p-4">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto, serviço ou categoria..."
                className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
              />

              <div className="flex gap-2 overflow-x-auto pb-1">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setFiltroStatus(filter.id)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${filtroStatus === filter.id ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {['Todas', ...categorias].map((categoriaItem) => (
                  <button
                    key={categoriaItem}
                    type="button"
                    onClick={() => setFiltroCategoria(categoriaItem)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${filtroCategoria === categoriaItem ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600'}`}
                  >
                    {categoriaItem}
                  </button>
                ))}
              </div>
            </div>

            {itens.length === 0 ? (
              <CatalogEmptyState title={copy.vazioTitulo} text={copy.vazioTexto} button={copy.vazioBotao} />
            ) : itensFiltrados.length === 0 ? (
              <CatalogEmptyState
                title="Nenhum item encontrado com esses filtros."
                text="Ajuste a busca, categoria ou status para ver outros itens do catálogo."
                button="Limpar filtros"
                onClick={() => {
                  setBusca('')
                  setFiltroCategoria('Todas')
                  setFiltroStatus('todos')
                }}
              />
            ) : visualizacao === 'cards' ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {itensFiltrados.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    empresaSlug={empresa?.slug || ''}
                    onEdit={preencherEdicao}
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
                onToggle={alternarAtivo}
                onDelete={excluirItem}
              />
            )}
          </section>
        </section>
      </section>
    </main>
  )
}

function ResumoCard({ label, value, tone = 'blue' }: { label: string; value: number; tone?: 'blue' | 'green' | 'red' | 'amber' }) {
  const valueColor = {
    blue: 'text-[#05245c]',
    green: 'text-emerald-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  }[tone]

  return (
    <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className={`mt-3 text-4xl font-black ${valueColor}`}>{value}</p>
    </div>
  )
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-left font-black ${active ? 'bg-white text-[#05245c]' : 'bg-blue-100 text-slate-500'}`}
    >
      {label}
    </button>
  )
}

function CatalogEmptyState({ title, text, button, onClick }: { title: string; text: string; button: string; onClick?: () => void }) {
  return (
    <div className="mt-5 rounded-[2rem] border border-dashed border-blue-100 bg-[#f8fbff] p-8 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-lg shadow-blue-950/5">🧩</div>
      <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">{text}</p>
      <button
        type="button"
        onClick={onClick || (() => window.scrollTo({ top: 430, behavior: 'smooth' }))}
        className="mt-6 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15"
      >
        {button}
      </button>
    </div>
  )
}

function ProductImage({ item }: { item: ItemCatalogo }) {
  const image = imagemPrincipal(item)

  return (
    <div className="relative h-48 overflow-hidden rounded-[1.5rem] bg-blue-50">
      {image ? (
        <img src={image} alt={item.nome} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-center text-sm font-black text-[#05245c]">
          <span className="rounded-2xl bg-white px-4 py-3">Sem foto</span>
        </div>
      )}

      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <StatusBadge label={item.categoria || 'Sem categoria'} tone="blue" />
        <StatusBadge label={itemAtivo(item) ? 'Ativo' : 'Inativo'} tone={itemAtivo(item) ? 'green' : 'red'} />
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        <StatusBadge label={`${imagensDoItem(item).length || 0} foto(s)`} tone="slate" />
        {temVideo(item) && <StatusBadge label="Com vídeo" tone="green" />}
      </div>
    </div>
  )
}

function StatusBadge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'red' | 'slate' | 'amber' }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(tone)}`}>{label}</span>
}

function ProductBadges({ item }: { item: ItemCatalogo }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge label={item.tipo || 'produto'} tone="slate" />
      <StatusBadge label={nomePrecificacao(item.precificacao)} tone="blue" />
      {!temFoto(item) && <StatusBadge label="Sem foto" tone="amber" />}
      {itemDestaque(item) && <StatusBadge label="Destaque" tone="green" />}
      {itemPromocao(item) && <StatusBadge label="Promoção" tone="amber" />}
      {itemSobConsulta(item) && <StatusBadge label="Sob consulta" tone="slate" />}
    </div>
  )
}

function ProductCard({
  item,
  empresaSlug,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: ItemCatalogo
  empresaSlug: string
  onEdit: (item: ItemCatalogo) => void
  onToggle: (item: ItemCatalogo) => void
  onDelete: (itemId: string) => void
}) {
  const campos = camposDoItem(item)

  return (
    <article className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
      <ProductImage item={item} />

      <div className="p-5">
        <ProductBadges item={item} />

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-xl font-black tracking-[-0.03em] text-[#071b3a]">{item.nome}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">{item.categoria || 'Sem categoria'}</p>
          </div>

          <p className="shrink-0 text-right text-2xl font-black text-[#05245c]">{labelPreco(item)}</p>
        </div>

        {item.descricao && <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{limitarTexto(item.descricao)}</p>}

        <div className="mt-4 grid gap-2 rounded-2xl bg-[#f8fbff] p-4 text-xs font-bold text-slate-600 sm:grid-cols-2">
          <p>Unidade: {item.unidade_label || item.unidade || 'unidade'}</p>
          <p>Valor mínimo: {formatarDinheiro(Number(item.valor_minimo || 0))}</p>
          <p>Campos: {campos.join(', ') || 'sem campos'}</p>
          <p>Sinal: {item.cobrar_sinal_personalizado ? `${item.percentual_sinal_produto || 0}%` : 'padrão da empresa'}</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button onClick={() => onEdit(item)} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-black text-[#05245c] transition hover:bg-blue-50">
            Editar
          </button>

          <a href={empresaSlug ? getCompanyPublicUrl(empresaSlug) : '#'} target="_blank" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center font-black text-[#05245c] transition hover:bg-blue-50">
            Ver no site
          </a>

          <button onClick={() => onToggle(item)} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-black text-[#05245c] transition hover:bg-blue-50">
            {itemAtivo(item) ? 'Inativar' : 'Ativar'}
          </button>

          <button onClick={() => onDelete(item.id)} className="rounded-2xl bg-red-50 px-4 py-3 font-black text-red-700 transition hover:bg-red-100">
            Excluir
          </button>
        </div>
      </div>
    </article>
  )
}

function ProductTable({
  items,
  empresaSlug,
  onEdit,
  onToggle,
  onDelete,
}: {
  items: ItemCatalogo[]
  empresaSlug: string
  onEdit: (item: ItemCatalogo) => void
  onToggle: (item: ItemCatalogo) => void
  onDelete: (itemId: string) => void
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-blue-100">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse bg-white text-left text-sm">
          <thead className="bg-[#f8fbff] text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th className="px-4 py-4">Produto</th>
              <th className="px-4 py-4">Categoria</th>
              <th className="px-4 py-4">Preço</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4">Mídia</th>
              <th className="px-4 py-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {items.map((item) => (
              <tr key={item.id} className="align-middle">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-blue-50">
                      {imagemPrincipal(item) ? (
                        <img src={imagemPrincipal(item)} alt={item.nome} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs font-black text-[#05245c]">Sem foto</div>
                      )}
                    </div>
                    <div>
                      <p className="font-black text-[#071b3a]">{item.nome}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{limitarTexto(item.descricao, 64) || item.tipo || 'produto'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 font-bold text-slate-600">{item.categoria || 'Sem categoria'}</td>
                <td className="px-4 py-4 font-black text-[#05245c]">{labelPreco(item)}</td>
                <td className="px-4 py-4">
                  <StatusBadge label={itemAtivo(item) ? 'Ativo' : 'Inativo'} tone={itemAtivo(item) ? 'green' : 'red'} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <StatusBadge label={`${imagensDoItem(item).length || 0} foto(s)`} tone={temFoto(item) ? 'blue' : 'amber'} />
                    {temVideo(item) && <StatusBadge label="Vídeo" tone="green" />}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(item)} className="rounded-xl border border-blue-100 bg-white px-3 py-2 font-black text-[#05245c]">Editar</button>
                    <a href={empresaSlug ? getCompanyPublicUrl(empresaSlug) : '#'} target="_blank" className="rounded-xl border border-blue-100 bg-white px-3 py-2 font-black text-[#05245c]">Site</a>
                    <button onClick={() => onToggle(item)} className="rounded-xl border border-blue-100 bg-white px-3 py-2 font-black text-[#05245c]">{itemAtivo(item) ? 'Inativar' : 'Ativar'}</button>
                    <button onClick={() => onDelete(item.id)} className="rounded-xl bg-red-50 px-3 py-2 font-black text-red-700">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
