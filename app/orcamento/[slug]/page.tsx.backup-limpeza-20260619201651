'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = any
type Secao = any
type Produto = any

const perguntasFallback = ['O que você precisa?', 'Quantidade', 'Prazo desejado', 'Detalhes importantes']

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function zap(numero: string | null | undefined, texto: string) {
  const limpo = String(numero || '').replace(/\D/g, '')
  if (!limpo) return ''
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

export default function SiteEmpresaPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [pedido, setPedido] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function carregar() {
      if (!slug) return
      setCarregando(true)

      try {
        const { data: empresaData, error: empresaError } = await supabase
          .from('public_company_profiles')
          .select('id, nome, slug, subdomain_slug, logo_url, whatsapp, cor_principal, cidade, estado, segmento, modelo_negocio, modelo_nome, modelo_perguntas, site_primary_color, site_accent_color, site_config')
          .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
          .maybeSingle()

        if (empresaError) throw empresaError
        if (!empresaData) throw new Error('Site não encontrado.')

        setEmpresa(empresaData)

        const [secoesRes, produtosRes] = await Promise.all([
          supabase.from('public_site_sections').select('*').eq('company_id', empresaData.id).order('sort_order', { ascending: true }),
          supabase.from('public_store_products').select('id, nome, preco, categoria, descricao, imagem_url, image_urls, destaque').eq('company_id', empresaData.id).order('destaque', { ascending: false }).limit(6),
        ])

        if (secoesRes.error) throw secoesRes.error
        if (produtosRes.error) throw produtosRes.error

        setSecoes(secoesRes.data || [])
        setProdutos(produtosRes.data || [])
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar site.')
      }

      setCarregando(false)
    }

    carregar()
  }, [slug])

  const tema = useMemo(() => ({
    primary: empresa?.site_primary_color || empresa?.cor_principal || '#05245c',
    accent: empresa?.site_accent_color || '#22c55e',
  }), [empresa])

  const perguntas = useMemo(() => {
    const p = (empresa?.modelo_perguntas || []).map(String).filter(Boolean)
    return p.length ? p : perguntasFallback
  }, [empresa])

  async function enviar() {
    if (!empresa) return
    if (!nome || !telefone || !pedido) {
      alert('Informe nome, WhatsApp e solicitação.')
      return
    }

    setEnviando(true)
    setMensagem('Enviando solicitação...')

    const detalhes = Object.entries(respostas).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')
    const texto = [`Olá, ${empresa.nome}!`, '', 'Vim pelo site e quero fazer uma solicitação:', pedido, '', detalhes, '', `Cliente: ${nome}`, `WhatsApp: ${telefone}`].filter(Boolean).join('\n')

    const { error } = await supabase.from('orders').insert({
      company_id: empresa.id,
      nome,
      telefone,
      produto: pedido,
      observacoes: detalhes || null,
      status: 'Recebido',
      dados_inteligentes: { origem: 'site_profissional', respostas },
    })

    if (error) {
      setMensagem(error.message)
      setEnviando(false)
      return
    }

    setMensagem('Solicitação enviada. Abrindo WhatsApp...')
    const link = zap(empresa.whatsapp, texto)
    if (link) window.open(link, '_blank')
    setNome('')
    setTelefone('')
    setPedido('')
    setRespostas({})
    setEnviando(false)
  }

  if (carregando) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando site...</div></main>
  if (erro || !empresa) return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><div className="rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="text-3xl font-black">Site indisponível</p><p className="mt-3 font-bold text-red-600">{erro}</p></div></main>

  const hero = secoes.find((s: Secao) => s.type === 'hero')
  const about = secoes.find((s: Secao) => s.type === 'about')
  const trust = secoes.find((s: Secao) => s.type === 'trust')
  const cta = secoes.find((s: Secao) => s.type === 'cta')

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950" style={{ ['--primary' as string]: tema.primary, ['--accent' as string]: tema.accent }}>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--primary)] text-lg font-black text-white">
              {empresa.logo_url ? <img src={empresa.logo_url} alt={empresa.nome} className="h-full w-full object-cover" /> : empresa.nome.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{empresa.nome}</p>
              <p className="truncate text-xs font-bold text-slate-500">{empresa.modelo_nome || empresa.segmento || 'Site oficial'}</p>
            </div>
          </a>

          <nav className="hidden items-center gap-5 text-sm font-black text-slate-600 md:flex">
            <a href="#servicos">Serviços</a>
            <a href="#sobre">Sobre</a>
            <a href="#pedido">Pedido</a>
          </nav>

          <a href={zap(empresa.whatsapp, `Olá, ${empresa.nome}! Vim pelo site.`)} target="_blank" rel="noreferrer" className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-black text-white">WhatsApp</a>
        </div>
      </header>

      <section id="inicio" className="relative overflow-hidden bg-white">
        <div className="absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-100 blur-3xl" />
          <div className="absolute -right-20 top-24 h-96 w-96 rounded-full bg-emerald-100 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-[var(--primary)] shadow-sm">{empresa.modelo_nome || 'Atendimento profissional'}</div>
            <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">{hero?.title || `${empresa.nome} agora com site profissional`}</h1>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-600">{hero?.subtitle || 'Conheça produtos, serviços e envie uma solicitação organizada pelo WhatsApp.'}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={hero?.button_url || '#pedido'} className="rounded-2xl bg-[var(--primary)] px-6 py-4 text-center font-black text-white shadow-xl shadow-blue-950/10">{hero?.button_label || 'Fazer solicitação'}</a>
              <a href="#servicos" className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center font-black text-slate-700">Ver serviços</a>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-blue-950/10">
            {hero?.image_url ? <img src={hero.image_url} alt={hero.title || empresa.nome} className="h-[420px] w-full rounded-[2rem] object-cover" /> : (
              <div className="flex h-[420px] flex-col justify-between rounded-[2rem] bg-[var(--primary)] p-8 text-white">
                <div><p className="text-sm font-black uppercase tracking-[0.2em] text-white/70">Site oficial</p><p className="mt-4 text-5xl font-black">{empresa.nome}</p></div>
                <p className="text-lg font-bold text-white/80">{hero?.content || 'Atendimento, catálogo, proposta e pedido em um só lugar.'}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="servicos" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--primary)]">Serviços e produtos</p><h2 className="mt-2 text-4xl font-black">O que você pode solicitar</h2></div>
          <a href="#pedido" className="rounded-2xl bg-[var(--primary)] px-5 py-3 text-center font-black text-white">Fazer pedido</a>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {produtos.map((produto: Produto) => {
            const imagem = produto.imagem_url || produto.image_urls?.[0]
            return (
              <article key={produto.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-950/5">
                <div className="aspect-[4/3] bg-slate-100">{imagem ? <img src={imagem} alt={produto.nome} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-5xl font-black text-[var(--primary)]">{produto.nome.slice(0, 2).toUpperCase()}</div>}</div>
                <div className="p-5"><p className="text-sm font-black text-[var(--primary)]">{produto.categoria || 'Serviço'}</p><h3 className="mt-2 text-2xl font-black">{produto.nome}</h3>{produto.descricao && <p className="mt-3 line-clamp-3 font-semibold leading-7 text-slate-600">{produto.descricao}</p>}<p className="mt-4 text-2xl font-black text-[var(--primary)]">A partir de {moeda(Number(produto.preco || 0))}</p></div>
              </article>
            )
          })}
          {produtos.length === 0 && <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center md:col-span-2 lg:col-span-3"><p className="text-2xl font-black">Catálogo em atualização</p><p className="mt-2 font-bold text-slate-500">Envie sua solicitação pelo formulário abaixo.</p></div>}
        </div>
      </section>

      <section id="sobre" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-[2rem] bg-slate-50 p-8"><p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--primary)]">Sobre</p><h2 className="mt-3 text-4xl font-black">{about?.title || `Sobre ${empresa.nome}`}</h2><p className="mt-5 text-lg font-semibold leading-8 text-slate-600">{about?.content || 'Empresa preparada para atender solicitações com organização, clareza e agilidade.'}</p></div>
          <div className="rounded-[2rem] bg-[var(--primary)] p-8 text-white"><p className="text-sm font-black uppercase tracking-[0.2em] text-white/70">Diferenciais</p><h2 className="mt-3 text-4xl font-black">{trust?.title || 'Atendimento organizado'}</h2><p className="mt-4 font-semibold leading-8 text-white/80">{trust?.content || 'Pedidos estruturados, menos dúvidas e contato direto pelo WhatsApp.'}</p></div>
        </div>
      </section>

      <section id="pedido" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-blue-950/10 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--primary)]">Solicitação inteligente</p>
          <h2 className="mt-3 text-4xl font-black">{cta?.title || 'Faça seu pedido'}</h2>
          <p className="mt-3 font-semibold leading-7 text-slate-600">{cta?.subtitle || 'Envie as informações principais e receba atendimento pelo WhatsApp.'}</p>
          {mensagem && <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-[var(--primary)]">{mensagem}</div>}
          <div className="mt-6 grid gap-4">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none" />
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Seu WhatsApp" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none" />
            <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="O que você precisa?" rows={4} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none" />
            <div className="grid gap-4 md:grid-cols-2">{perguntas.map((pergunta: string) => <input key={pergunta} value={respostas[pergunta] || ''} onChange={(e) => setRespostas((atual) => ({ ...atual, [pergunta]: e.target.value }))} placeholder={pergunta} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none" />)}</div>
            <button disabled={enviando} onClick={enviar} className="rounded-2xl bg-[var(--primary)] px-6 py-4 font-black text-white disabled:opacity-60">{enviando ? 'Enviando...' : 'Enviar solicitação'}</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center"><p className="font-black">{empresa.nome}</p><p className="mt-1 text-sm font-bold text-slate-500">Site profissional criado com Orçaly</p></footer>
    </main>
  )
}
