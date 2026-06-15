'use client'

import { useEffect, useState } from 'react'
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
  plano: string | null
  ativo: boolean
  segmento: string | null
  cidade: string | null
  estado: string | null
  email: string | null
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
  const [logoUrl, setLogoUrl] = useState('')

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
      setMensagem('Nenhuma empresa vinculada a esta conta.')
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
    setAtivo(Boolean(data.ativo))
    setLogoUrl(data.logo_url || '')

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

  async function salvarConfiguracoes(evento: React.FormEvent) {
    evento.preventDefault()

    if (!empresa) return

    if (!nome || !slug || !whatsapp) {
      setMensagem('Preencha nome, slug/link e WhatsApp.')
      return
    }

    setSalvando(true)
    setMensagem('')

    try {
      let novaLogoUrl = logoUrl

      if (arquivoLogo) {
        novaLogoUrl = await enviarLogo(empresa.id, arquivoLogo)
      }

      const slugFinal = criarSlug(slug)

      const { error } = await supabase
        .from('companies')
        .update({
          nome,
          slug: slugFinal,
          segmento,
          whatsapp,
          telefone: whatsapp,
          cidade,
          estado,
          cor_principal: corPrincipal,
          ativo,
          logo_url: novaLogoUrl || null,
        })
        .eq('id', empresa.id)

      if (error) {
        if (error.message.includes('duplicate key')) {
          setMensagem('Esse slug/link já está sendo usado por outra empresa.')
        } else {
          setMensagem(`Erro ao salvar: ${error.message}`)
        }

        setSalvando(false)
        return
      }

      setSlug(slugFinal)
      setLogoUrl(novaLogoUrl)
      setArquivoLogo(null)
      setMensagem('Configurações salvas com sucesso.')
    } catch (erro) {
      const textoErro =
        erro instanceof Error ? erro.message : 'Erro desconhecido.'

      setMensagem(`Erro: ${textoErro}`)
    }

    setSalvando(false)
  }

  async function copiarLink() {
    const link = `${window.location.origin}/orcamento/${slug}`

    await navigator.clipboard.writeText(link)

    setMensagem('Link copiado com sucesso.')
  }

  useEffect(() => {
    carregarEmpresa()
  }, [])

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

  if (!empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="Orçaly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <h1 className="text-3xl font-black text-[#071b3a]">
            Empresa não encontrada
          </h1>

          <p className="mt-3 text-slate-600">
            {mensagem || 'Essa conta ainda não possui empresa cadastrada.'}
          </p>

          <Link
            href="/painel"
            className="mt-6 inline-block rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
          >
            Voltar ao painel
          </Link>
        </div>
      </main>
    )
  }

  const linkPublico = `/orcamento/${slug}`

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
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={nome}
                className="h-14 w-14 rounded-2xl object-cover"
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
                {nome || empresa.nome}
              </h1>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Personalize a empresa, o link público e a identidade visual.
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

            <a
              href={linkPublico}
              target="_blank"
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c] transition hover:bg-blue-50"
            >
              Ver página
            </a>

            <button
              onClick={copiarLink}
              className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white transition hover:bg-[#031a43]"
            >
              Copiar link
            </button>
          </nav>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
              Prévia
            </p>

            <div className="mt-6 rounded-[2rem] border border-blue-100 bg-[#f7fbff] p-5">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
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
                  <h2 className="text-2xl font-black text-[#071b3a]">
                    {nome || 'Nome da empresa'}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {segmento || 'Segmento da empresa'}
                  </p>
                </div>
              </div>

              <div
                className="mt-6 rounded-2xl p-5 text-white"
                style={{ backgroundColor: corPrincipal || '#05245c' }}
              >
                <p className="text-sm font-bold opacity-80">
                  Link público
                </p>

                <p className="mt-1 break-all text-xl font-black">
                  {linkPublico}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold text-slate-500">
                    Plano
                  </p>

                  <p className="mt-1 font-black capitalize text-[#071b3a]">
                    {empresa.plano || 'Profissional'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold text-slate-500">
                    Status
                  </p>

                  <p className="mt-1 font-black text-emerald-700">
                    {ativo ? 'Ativa' : 'Inativa'}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <form
            onSubmit={salvarConfiguracoes}
            className="rounded-[2rem] border border-blue-50 bg-white p-6 shadow-xl shadow-blue-950/5"
          >
            <div className="mb-6">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#05245c]">
                Dados da empresa
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                Editar informações
              </h2>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Nome da empresa
                  </span>

                  <input
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value)
                      setSlug(criarSlug(e.target.value))
                    }}
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Slug/link
                  </span>

                  <input
                    value={slug}
                    onChange={(e) => setSlug(criarSlug(e.target.value))}
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-[#071b3a]">
                  Link público
                </span>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 font-black text-[#05245c]">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}${linkPublico}`
                    : linkPublico}
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Segmento
                  </span>

                  <input
                    value={segmento}
                    onChange={(e) => setSegmento(e.target.value)}
                    placeholder="Ex: locadora, TI, imóveis..."
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    WhatsApp
                  </span>

                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="5582999999999"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Cidade
                  </span>

                  <input
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Estado
                  </span>

                  <input
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    placeholder="AL"
                    className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Cor principal
                  </span>

                  <div className="grid grid-cols-[64px_1fr] gap-3">
                    <input
                      type="color"
                      value={corPrincipal}
                      onChange={(e) => setCorPrincipal(e.target.value)}
                      className="h-14 w-16 cursor-pointer rounded-2xl border border-blue-100 bg-white p-1"
                    />

                    <input
                      value={corPrincipal}
                      onChange={(e) => setCorPrincipal(e.target.value)}
                      className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-medium outline-none transition focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-[#071b3a]">
                    Status
                  </span>

                  <button
                    type="button"
                    onClick={() => setAtivo(!ativo)}
                    className={`rounded-2xl px-4 py-4 text-left font-black transition ${
                      ativo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {ativo ? 'Empresa ativa' : 'Empresa inativa'}
                  </button>
                </label>
              </div>

              <label className="grid cursor-pointer gap-2">
                <span className="text-sm font-black text-[#071b3a]">
                  Logo da empresa
                </span>

                <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-bold text-[#05245c] transition hover:bg-blue-100">
                  {arquivoLogo
                    ? arquivoLogo.name
                    : 'Clique para enviar uma nova logo'}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArquivoLogo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                disabled={salvando}
                className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-1 hover:bg-[#031a43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}