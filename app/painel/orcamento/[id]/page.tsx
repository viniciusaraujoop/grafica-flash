'use client'

import { useEffect, useState, type FormEvent } from 'react'
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
  segmento: string | null
  cidade: string | null
  estado: string | null
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

function converterQuantidade(valor: string) {
  const numero = Number(String(valor).replace(',', '.'))

  if (Number.isNaN(numero)) {
    return 0
  }

  return numero
}

export default function PaginaPublicaEmpresa() {
  const params = useParams()
  const slug = String(params.slug || '')

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [itemSelecionadoId, setItemSelecionadoId] = useState('')

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
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

    if (itensData && itensData.length > 0) {
      setItemSelecionadoId(itensData[0].id)
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

  async function enviarSolicitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (enviando) return

    if (!empresa) {
      const texto = 'Empresa não carregada. Atualize a página e tente novamente.'
      setMensagem(texto)
      alert(texto)
      return
    }

    const itemSelecionado = itens.find((item) => item.id === itemSelecionadoId)

    if (!itemSelecionado) {
      const texto = 'Selecione um item do catálogo antes de enviar.'
      setMensagem(texto)
      alert(texto)
      return
    }

    const quantidadeNumero = converterQuantidade(quantidade)

    if (!nome.trim()) {
      const texto = 'Preencha seu nome.'
      setMensagem(texto)
      alert(texto)
      return
    }

    if (!telefone.trim()) {
      const texto = 'Preencha seu WhatsApp.'
      setMensagem(texto)
      alert(texto)
      return
    }

    if (!quantidadeNumero || quantidadeNumero <= 0) {
      const texto = 'Preencha uma quantidade válida.'
      setMensagem(texto)
      alert(texto)
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

      const precoEstimado = Number(itemSelecionado.preco || 0) * quantidadeNumero

      const { error } = await supabase.from('orders').insert({
        company_id: empresa.id,
        nome: nome.trim(),
        telefone: telefone.trim(),
        produto: itemSelecionado.nome,
        quantidade: quantidadeNumero,
        observacoes,
        preco_estimado: precoEstimado,
        arquivo_url: arquivoUrl || null,
        status: 'Recebido',
      })

      if (error) {
        const texto = `Erro ao enviar solicitação: ${error.message}`
        setMensagem(texto)
        alert(texto)
        setEnviando(false)
        return
      }

      const numeroEmpresa = montarNumeroWhatsapp(empresa.whatsapp || '')

      if (numeroEmpresa) {
        const textoWhatsapp = `Olá! Acabei de enviar uma solicitação pelo site.

Nome: ${nome}
Item: ${itemSelecionado.nome}
Tipo: ${itemSelecionado.tipo || 'Item'}
Quantidade: ${quantidadeNumero}
Valor estimado: ${formatarDinheiro(precoEstimado)}

${observacoes ? `Observações: ${observacoes}` : ''}`

        const link = `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(
          textoWhatsapp
        )}`

        setLinkWhatsapp(link)
      }

      const textoSucesso = 'Solicitação enviada com sucesso.'
      setMensagem(textoSucesso)
      alert(textoSucesso)

      setNome('')
      setTelefone('')
      setQuantidade('1')
      setObservacoes('')
      setArquivo(null)
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error
          ? erro.message
          : 'Erro desconhecido ao enviar solicitação.'

      const texto = `Erro: ${mensagemErro}`
      setMensagem(texto)
      alert(texto)
    }

    setEnviando(false)
  }

  useEffect(() => {
    carregarDados()
  }, [slug])

  const itemSelecionado = itens.find((item) => item.id === itemSelecionadoId)
  const quantidadeNumero = converterQuantidade(quantidade)

  const totalEstimado =
    itemSelecionado && quantidadeNumero > 0
      ? Number(itemSelecionado.preco || 0) * quantidadeNumero
      : 0

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
      <style>
        {`
          @keyframes fadeUp {
            from {
              opacity: 0;
              transform: translateY(22px);
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
              transform: translateY(-10px);
            }
          }

          .fade-up {
            animation: fadeUp .75s cubic-bezier(.2,.8,.2,1) both;
          }

          .float-soft {
            animation: floatSoft 5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .fade-up,
            .float-soft {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="fade-up rounded-[2rem] border border-blue-50 bg-white/90 p-5 shadow-xl shadow-blue-950/5 backdrop-blur-xl">
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
                  Catálogo digital
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
                Total estimado
              </p>

              <p
                className="mt-1 text-3xl font-black"
                style={{ color: corPrincipal }}
              >
                {formatarDinheiro(totalEstimado)}
              </p>
            </div>
          </div>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section>
            <div className="mb-5">
              <p
                className="text-sm font-black uppercase tracking-[0.25em]"
                style={{ color: corPrincipal }}
              >
                Escolha uma opção
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Produtos e serviços disponíveis
              </h2>
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
                {itens.map((item) => {
                  const selecionado = item.id === itemSelecionadoId

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setItemSelecionadoId(item.id)}
                      className={`group overflow-hidden rounded-[2rem] border bg-white text-left shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl ${
                        selecionado ? 'border-blue-300' : 'border-blue-50'
                      }`}
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
                            {item.tipo || 'item'}
                          </span>

                          {item.destaque && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                              Destaque
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
                              A partir de
                            </p>

                            <p
                              className="text-2xl font-black"
                              style={{ color: corPrincipal }}
                            >
                              {formatarDinheiro(Number(item.preco || 0))}
                            </p>

                            <p className="text-xs font-bold text-slate-400">
                              por {item.unidade || 'unidade'}
                            </p>
                          </div>

                          <span
                            className="rounded-2xl px-4 py-3 text-sm font-black"
                            style={{
                              backgroundColor: selecionado
                                ? corPrincipal
                                : '#eff6ff',
                              color: selecionado ? '#ffffff' : corPrincipal,
                            }}
                          >
                            {selecionado ? 'Selecionado' : 'Selecionar'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
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
                Solicitação
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Enviar pedido
              </h2>

              {itemSelecionado && (
                <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-slate-500">
                    Item selecionado
                  </p>

                  <p className="mt-1 text-xl font-black text-[#071b3a]">
                    {itemSelecionado.nome}
                  </p>

                  <p
                    className="mt-1 text-lg font-black"
                    style={{ color: corPrincipal }}
                  >
                    {formatarDinheiro(Number(itemSelecionado.preco || 0))}
                  </p>
                </div>
              )}

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

                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Quantidade"
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Descreva o que precisa, prazo, detalhes ou dúvidas..."
                  rows={4}
                  className="resize-none rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                />

                <label className="grid cursor-pointer gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Arquivo de referência
                  </span>

                  <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-bold text-[#05245c] transition hover:bg-blue-100">
                    {arquivo
                      ? arquivo.name
                      : 'Clique para enviar imagem, PDF ou referência'}
                  </div>

                  <input
                    type="file"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                <div className="rounded-3xl bg-blue-50 p-5">
                  <p className="text-sm font-bold text-slate-500">
                    Total estimado
                  </p>

                  <p
                    className="mt-1 text-4xl font-black"
                    style={{ color: corPrincipal }}
                  >
                    {formatarDinheiro(totalEstimado)}
                  </p>

                  <p className="mt-2 text-xs font-bold text-slate-500">
                    O valor pode mudar conforme detalhes, disponibilidade ou personalização.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={enviando || itens.length === 0}
                  className="rounded-2xl px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: corPrincipal }}
                >
                  {enviando ? 'Enviando...' : 'Enviar solicitação'}
                </button>

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
              </div>
            </form>
          </aside>
        </section>
      </section>
    </main>
  )
}
