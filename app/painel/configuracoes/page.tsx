'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

function criarSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function limparNomeArquivo(nome: string) {
  return nome
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
}

function numeroDoCampo(valor: string) {
  const numero = Number(String(valor).replace(',', '.'))

  if (Number.isNaN(numero)) return 0

  return numero
}

export default function ConfiguracoesPage() {
  const router = useRouter()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [segmento, setSegmento] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [corPrincipal, setCorPrincipal] = useState('#05245c')
  const [ativo, setAtivo] = useState(true)

  const [pixKey, setPixKey] = useState('')
  const [pixNome, setPixNome] = useState('')
  const [pixCidade, setPixCidade] = useState('')
  const [aceitaPix, setAceitaPix] = useState(true)
  const [aceitaCartao, setAceitaCartao] = useState(false)
  const [cobrarSinal, setCobrarSinal] = useState(false)
  const [percentualSinal, setPercentualSinal] = useState('0')

  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function carregarEmpresa() {
    setCarregando(true)
    setMensagem('')

    const { data: sessaoData } = await supabase.auth.getSession()
    const usuario = sessaoData.session?.user

    if (!usuario) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('owner_id', usuario.id)
      .maybeSingle()

    if (error) {
      setMensagem(`Erro ao buscar empresa: ${error.message}`)
      setCarregando(false)
      return
    }

    if (!data) {
      setMensagem('Nenhuma empresa encontrada para esta conta.')
      setCarregando(false)
      return
    }

    setEmpresa(data)

    setNome(data.nome || '')
    setSlug(data.slug || '')
    setSegmento(data.segmento || '')
    setWhatsapp(data.whatsapp || '')
    setCidade(data.cidade || '')
    setEstado(data.estado || '')
    setCorPrincipal(data.cor_principal || '#05245c')
    setAtivo(data.ativo !== false)

    setPixKey(data.pix_key || '')
    setPixNome(data.pix_nome || data.nome || '')
    setPixCidade(data.pix_cidade || data.cidade || '')
    setAceitaPix(data.aceita_pix !== false)
    setAceitaCartao(Boolean(data.aceita_cartao))
    setCobrarSinal(Boolean(data.cobrar_sinal))
    setPercentualSinal(String(data.percentual_sinal || 0))

    setCarregando(false)
  }

  async function enviarLogo(companyId: string, arquivo: File) {
    const nomeArquivo = limparNomeArquivo(arquivo.name)
    const caminho = `${companyId}/${Date.now()}-${nomeArquivo}`

    const { error } = await supabase.storage
      .from('logos')
      .upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(caminho)

    return data.publicUrl
  }

  async function salvarConfiguracoes(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!empresa) return

    if (!nome.trim()) {
      setMensagem('Informe o nome da empresa.')
      alert('Informe o nome da empresa.')
      return
    }

    if (!slug.trim()) {
      setMensagem('Informe o link da empresa.')
      alert('Informe o link da empresa.')
      return
    }

    const percentual = numeroDoCampo(percentualSinal)

    if (cobrarSinal && (percentual <= 0 || percentual > 100)) {
      setMensagem('O percentual de sinal precisa ficar entre 1% e 100%.')
      alert('O percentual de sinal precisa ficar entre 1% e 100%.')
      return
    }

    if (aceitaPix && !pixKey.trim()) {
      setMensagem('Para ativar Pix, cadastre uma chave Pix.')
      alert('Para ativar Pix, cadastre uma chave Pix.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      let logoUrl = empresa.logo_url

      if (arquivoLogo) {
        logoUrl = await enviarLogo(empresa.id, arquivoLogo)
      }

      const slugFinal = criarSlug(slug)

      const { error } = await supabase
        .from('companies')
        .update({
          nome: nome.trim(),
          slug: slugFinal,
          logo_url: logoUrl || null,
          whatsapp: whatsapp.trim(),
          segmento: segmento.trim(),
          cidade: cidade.trim(),
          estado: estado.trim(),
          cor_principal: corPrincipal,
          ativo,
          pix_key: pixKey.trim() || null,
          pix_nome: pixNome.trim() || nome.trim(),
          pix_cidade: pixCidade.trim() || cidade.trim(),
          aceita_pix: aceitaPix,
          aceita_cartao: aceitaCartao,
          cobrar_sinal: cobrarSinal,
          percentual_sinal: cobrarSinal ? percentual : 0,
        })
        .eq('id', empresa.id)

      if (error) {
        const texto = `Erro ao salvar configurações: ${error.message}`
        setMensagem(texto)
        alert(texto)
        setSalvando(false)
        return
      }

      const texto = 'Configurações salvas com sucesso.'
      setMensagem(texto)
      alert(texto)
      setArquivoLogo(null)

      await carregarEmpresa()
    } catch (erro) {
      const textoErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido.'

      const texto = `Erro: ${textoErro}`
      setMensagem(texto)
      alert(texto)
    }

    setSalvando(false)
  }

  async function copiarLink() {
    if (!slug) return

    const link = `${window.location.origin}/orcamento/${slug}`
    await navigator.clipboard.writeText(link)

    setMensagem('Link copiado com sucesso.')
  }

  useEffect(() => {
    carregarEmpresa()
  }, [])

  const linkPublico =
    typeof window !== 'undefined' && slug
      ? `${window.location.origin}/orcamento/${slug}`
      : ''

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
            Carregando configurações...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white pb-24 text-slate-950">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[-180px] h-[420px] w-[420px] rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute right-[-180px] top-[20%] h-[360px] w-[360px] rounded-full bg-cyan-100 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[30%] h-[360px] w-[360px] rounded-full bg-emerald-100 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="sticky top-4 z-30 flex flex-col gap-4 rounded-[2rem] border border-blue-50 bg-white/90 p-4 shadow-xl shadow-blue-950/5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome}
                className="h-14 w-14 rounded-2xl object-cover shadow-lg shadow-blue-950/10"
              />
            ) : (
              <img
                src="/icone-orcaly.png"
                alt="Orçaly"
                className="h-14 w-14 rounded-2xl bg-blue-50 object-contain p-2"
              />
            )}

            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#05245c]">
                Configurações
              </p>

              <h1 className="mt-1 text-2xl font-black text-[#071b3a]">
                Empresa e pagamentos
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Configure identidade, link público, Pix, cartão e sinal inicial.
              </p>
            </div>
          </div>

          <nav className="grid gap-2 sm:grid-cols-3 lg:flex">
            <Link
              href="/painel"
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
            >
              Painel
            </Link>

            <Link
              href="/painel/produtos"
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
            >
              Produtos
            </Link>

            <a
              href={slug ? `/orcamento/${slug}` : '#'}
              target="_blank"
              className="rounded-2xl bg-[#05245c] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-[#031a43]"
            >
              Ver página
            </a>
          </nav>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        {!empresa ? (
          <div className="mt-6 rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
            <h2 className="text-3xl font-black text-[#071b3a]">
              Empresa não encontrada
            </h2>

            <p className="mt-3 text-slate-600">
              Vincule uma empresa a esta conta ou cadastre uma nova.
            </p>

            <Link
              href="/cadastro"
              className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
            >
              Cadastrar empresa
            </Link>
          </div>
        ) : (
          <form
            onSubmit={salvarConfiguracoes}
            className="mt-6 grid gap-6 lg:grid-cols-[1fr_.8fr]"
          >
            <section className="grid gap-6">
              <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                  Identidade
                </p>

                <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                  Dados da empresa
                </h2>

                <div className="mt-6 grid gap-4">
                  <input
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value)

                      if (!slug) {
                        setSlug(criarSlug(e.target.value))
                      }
                    }}
                    placeholder="Nome da empresa"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />

                  <input
                    value={slug}
                    onChange={(e) => setSlug(criarSlug(e.target.value))}
                    placeholder="Link da empresa. Ex: grafica-flash"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />

                  <input
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value)}
                    placeholder="Segmento. Ex: gráfica, locadora, assistência..."
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />

                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="WhatsApp da empresa"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Cidade"
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                    />

                    <input
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="Estado"
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-[#071b3a]">
                      Cor principal
                    </span>

                    <input
                      type="color"
                      value={corPrincipal}
                      onChange={(e) => setCorPrincipal(e.target.value)}
                      className="h-14 w-full cursor-pointer rounded-2xl border border-blue-100 bg-white p-2"
                    />
                  </label>

                  <label className="grid cursor-pointer gap-2">
                    <span className="text-sm font-black text-[#071b3a]">
                      Logo da empresa
                    </span>

                    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-bold text-[#05245c] transition hover:bg-blue-100">
                      {arquivoLogo
                        ? arquivoLogo.name
                        : 'Clique para enviar uma logo'}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setArquivoLogo(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setAtivo(!ativo)}
                    className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                      ativo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {ativo ? 'Página pública ativa' : 'Página pública inativa'}
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-50 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
                  Pagamentos
                </p>

                <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                  Pix, cartão e sinal
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  O Pix gera QR Code e copia e cola. Cartão ficará pronto para integração com gateway depois.
                </p>

                <div className="mt-6 grid gap-4">
                  <button
                    type="button"
                    onClick={() => setAceitaPix(!aceitaPix)}
                    className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                      aceitaPix
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {aceitaPix ? 'Pix ativado' : 'Pix desativado'}
                  </button>

                  {aceitaPix && (
                    <>
                      <input
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="Chave Pix. CPF, CNPJ, e-mail, telefone ou aleatória"
                        className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />

                      <input
                        value={pixNome}
                        onChange={(e) => setPixNome(e.target.value)}
                        placeholder="Nome do recebedor Pix"
                        className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />

                      <input
                        value={pixCidade}
                        onChange={(e) => setPixCidade(e.target.value)}
                        placeholder="Cidade do recebedor Pix"
                        className="rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setAceitaCartao(!aceitaCartao)}
                    className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                      aceitaCartao
                        ? 'bg-blue-100 text-[#05245c]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {aceitaCartao ? 'Cartão ativado' : 'Cartão desativado'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCobrarSinal(!cobrarSinal)}
                    className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                      cobrarSinal
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cobrarSinal
                      ? 'Sinal inicial ativado'
                      : 'Sinal inicial desativado'}
                  </button>

                  {cobrarSinal && (
                    <input
                      value={percentualSinal}
                      onChange={(e) => setPercentualSinal(e.target.value)}
                      placeholder="Percentual do sinal. Ex: 50"
                      className="rounded-2xl border border-amber-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  )}
                </div>
              </div>
            </section>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-2xl shadow-blue-950/10">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                  Prévia
                </p>

                <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                  Página pública
                </h2>

                <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5">
                  <div className="flex items-center gap-4">
                    {empresa.logo_url ? (
                      <img
                        src={empresa.logo_url}
                        alt={nome}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <img
                        src="/icone-orcaly.png"
                        alt="Orçaly"
                        className="h-16 w-16 rounded-2xl bg-white object-contain p-2"
                      />
                    )}

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">
                        {segmento || 'Segmento'}
                      </p>

                      <h3 className="mt-1 text-2xl font-black text-[#071b3a]">
                        {nome || 'Nome da empresa'}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-white p-4 text-sm font-bold text-slate-600">
                    {linkPublico || 'Link ainda não gerado'}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={copiarLink}
                      className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] transition hover:bg-blue-50"
                    >
                      Copiar link
                    </button>

                    <a
                      href={slug ? `/orcamento/${slug}` : '#'}
                      target="_blank"
                      className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white transition hover:bg-[#031a43]"
                    >
                      Abrir página
                    </a>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="font-black text-emerald-700">
                    Pagamentos
                  </p>

                  <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600">
                    <p>Pix: {aceitaPix ? 'ativado' : 'desativado'}</p>
                    <p>Cartão: {aceitaCartao ? 'ativado' : 'desativado'}</p>
                    <p>
                      Sinal:{' '}
                      {cobrarSinal ? `${percentualSinal || 0}%` : 'desativado'}
                    </p>
                  </div>
                </div>

                <button
                  disabled={salvando}
                  className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </div>
            </aside>
          </form>
        )}
      </section>
    </main>
  )
}
