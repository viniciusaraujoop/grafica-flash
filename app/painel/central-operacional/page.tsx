'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { nichosOrcaly } from '@/lib/orcaly-nichos'
import { getAccessTokenClient, getCurrentCompanyClient } from '@/lib/current-company-client'
import { supabase } from '@/lib/supabase'

type TabKey = 'modelos' | 'balcao' | 'qrcode' | 'recorrentes' | 'cliente' | 'ia'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function cleanPhone(value: string) {
  let phone = String(value || '').replace(/\D/g, '')
  if (!phone) return ''
  if (!phone.startsWith('55') && phone.length >= 10 && phone.length <= 11) phone = `55${phone}`
  return phone
}

function SidebarButton({ active, title, subtitle, onClick }: { active: boolean; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 ${
        active
          ? 'border-[#05245c] bg-[#05245c] text-white shadow-xl shadow-blue-950/15'
          : 'border-blue-100 bg-white text-[#071b3a]'
      }`}
    >
      <p className="font-black">{title}</p>
      <p className={`mt-1 text-xs font-bold leading-5 ${active ? 'text-white/75' : 'text-slate-500'}`}>{subtitle}</p>
    </button>
  )
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">{title}</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{subtitle}</p>
    </div>
  )
}

export default function CentralOperacionalPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('modelos')
  const [company, setCompany] = useState<any>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedNicho, setSelectedNicho] = useState('grafica')

  const [balcao, setBalcao] = useState({
    nome: '',
    whatsapp: '',
    produto: '',
    valor: '',
    prazo: '',
    observacao: '',
  })

  const [cliente, setCliente] = useState({
    nome: '',
    whatsapp: '',
  })

  const [aiText, setAiText] = useState('Quero 30 camisas pretas com logo na frente e nome atrás para sábado')
  const [aiResult, setAiResult] = useState<any>(null)
  const [proposalUrl, setProposalUrl] = useState('')
  const [clientUrl, setClientUrl] = useState('')

  const siteUrl = useMemo(() => {
    if (!company) return ''
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
    const sub = company.subdomain_slug || String(company.slug || '').replace(/[^a-z0-9]/g, '')
    return `https://${sub}.${root}`
  }, [company])

  const publicSite = siteUrl || (company?.slug ? `/site/${company.slug}` : '')

  async function load() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const current = await getCurrentCompanyClient()
      setCompany(current.company)

      const [ordersRes, productsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('company_id', current.company.id)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('products')
          .select('*')
          .eq('company_id', current.company.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      setOrders(ordersRes.data || [])
      setProducts(productsRes.data || [])
      if (current.company?.modelo_negocio) setSelectedNicho(current.company.modelo_negocio)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar central operacional.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function applyNicho() {
    setMessage('')
    setError('')

    const response = await fetch('/api/nichos/apply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ niche_id: selectedNicho }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao aplicar modelo.')
      return
    }

    setMessage('Modelo aplicado na empresa.')
    await load()
  }

  async function createBalcao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    setProposalUrl('')

    const response = await fetch('/api/balcao/quick-proposal', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...balcao,
        valor: Number(String(balcao.valor).replace(',', '.')),
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao gerar proposta de balcão.')
      return
    }

    setProposalUrl(payload.proposal_url)
    setMessage('Proposta gerada com sucesso.')
    await load()
  }

  async function repeatOrder(orderId: string) {
    setMessage('')
    setError('')

    const response = await fetch('/api/orders/repeat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao repetir pedido.')
      return
    }

    setMessage('Pedido repetido com sucesso.')
    await load()
  }

  async function createClientLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    setClientUrl('')

    const response = await fetch('/api/clientes/magic-link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_name: cliente.nome,
        customer_phone: cliente.whatsapp,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao gerar área do cliente.')
      return
    }

    setClientUrl(payload.url)
    setMessage('Link mágico do cliente gerado.')
  }

  async function parseAi() {
    setMessage('')
    setError('')
    setAiResult(null)

    const response = await fetch('/api/ai/orcamento', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: aiText }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Erro ao interpretar pedido.')
      return
    }

    setAiResult(payload.parsed)
    setMessage(payload.source === 'openai' ? 'Pedido interpretado pela IA.' : 'Pedido interpretado pelo modo simples.')
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando central...</div>
      </main>
    )
  }

  const nichoAtual = nichosOrcaly.find((nicho) => nicho.id === selectedNicho) || nichosOrcaly[0]

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Central operacional</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Modelos por nicho, modo balcão, QR Code, pedidos recorrentes, área do cliente e IA de orçamento sem bagunçar o painel principal.
          </p>
        </header>

        {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4 rounded-[1.5rem] bg-[#f5f8ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Orçaly</p>
              <p className="mt-2 text-lg font-black">Operação diária</p>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">Clique numa função e o centro mostra só o necessário. Organização, essa entidade rara.</p>
            </div>

            <div className="grid gap-3">
              <SidebarButton active={activeTab === 'modelos'} onClick={() => setActiveTab('modelos')} title="Modelos por nicho" subtitle="Categorias, perguntas e status prontos" />
              <SidebarButton active={activeTab === 'balcao'} onClick={() => setActiveTab('balcao')} title="Modo balcão" subtitle="Proposta rápida presencial" />
              <SidebarButton active={activeTab === 'qrcode'} onClick={() => setActiveTab('qrcode')} title="QR Code" subtitle="Físico conectado ao digital" />
              <SidebarButton active={activeTab === 'recorrentes'} onClick={() => setActiveTab('recorrentes')} title="Repetir pedido" subtitle="Clientes que compram sempre" />
              <SidebarButton active={activeTab === 'cliente'} onClick={() => setActiveTab('cliente')} title="Área do cliente" subtitle="Link mágico sem senha" />
              <SidebarButton active={activeTab === 'ia'} onClick={() => setActiveTab('ia')} title="IA de orçamento" subtitle="Transforma bagunça em briefing" />
            </div>
          </aside>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
            {activeTab === 'modelos' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="19. Biblioteca" title="Modelos por nicho" subtitle="Escolha o segmento da empresa e o Orçaly configura categorias, perguntas, status, mensagens, proposta e campos recomendados." />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {nichosOrcaly.map((nicho) => (
                    <button
                      key={nicho.id}
                      type="button"
                      onClick={() => setSelectedNicho(nicho.id)}
                      className={`rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-1 ${
                        selectedNicho === nicho.id ? 'border-[#05245c] bg-blue-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="font-black text-[#071b3a]">{nicho.nome}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{nicho.descricao}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-[1.8rem] bg-[#f5f8ff] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-2xl font-black">{nichoAtual.nome}</h3>
                      <p className="mt-2 font-bold leading-7 text-slate-500">{nichoAtual.descricao}</p>
                    </div>
                    <button onClick={applyNicho} className="rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">
                      Aplicar modelo
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="font-black text-[#071b3a]">Categorias</p>
                      <div className="mt-3 flex flex-wrap gap-2">{nichoAtual.categorias.map((item) => <span key={item} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{item}</span>)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="font-black text-[#071b3a]">Status</p>
                      <div className="mt-3 flex flex-wrap gap-2">{nichoAtual.status.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{item}</span>)}</div>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="font-black text-[#071b3a]">Perguntas</p>
                      <ul className="mt-3 space-y-1 text-sm font-bold text-slate-600">{nichoAtual.perguntas.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="font-black text-[#071b3a]">Modelo de proposta</p>
                      <p className="mt-3 text-sm font-bold text-slate-600">{nichoAtual.modelo_proposta.introducao}</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">Validade: {nichoAtual.modelo_proposta.validade_horas}h • Prazo: {nichoAtual.modelo_proposta.prazo_padrao}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'balcao' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="15. Balcão" title="Orçamento rápido presencial" subtitle="Nome, WhatsApp, produto, valor, prazo e proposta profissional em menos de 30 segundos. Adeus caderno medieval." />

                <form onSubmit={createBalcao} className="grid gap-4 rounded-[1.8rem] bg-[#f5f8ff] p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={balcao.nome} onChange={(e) => setBalcao({ ...balcao, nome: e.target.value })} placeholder="Nome do cliente" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                    <input value={balcao.whatsapp} onChange={(e) => setBalcao({ ...balcao, whatsapp: e.target.value })} placeholder="WhatsApp" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                    <input value={balcao.produto} onChange={(e) => setBalcao({ ...balcao, produto: e.target.value })} placeholder="Produto / serviço" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                    <input value={balcao.valor} onChange={(e) => setBalcao({ ...balcao, valor: e.target.value })} placeholder="Valor" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                    <input value={balcao.prazo} onChange={(e) => setBalcao({ ...balcao, prazo: e.target.value })} placeholder="Prazo" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                  </div>
                  <textarea value={balcao.observacao} onChange={(e) => setBalcao({ ...balcao, observacao: e.target.value })} placeholder="Observação" rows={4} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                  <button className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white">Enviar proposta</button>
                </form>

                {proposalUrl && (
                  <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                    <p className="font-black text-emerald-700">Proposta criada</p>
                    <a href={proposalUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all font-bold text-emerald-800">{proposalUrl}</a>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'qrcode' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="14. QR Code" title="Conecte balcão, embalagem e vitrine ao digital" subtitle="Cada QR leva o cliente para um caminho específico: orçamento, catálogo, acompanhamento ou promoção." />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Pedir orçamento', `${publicSite}`],
                    ['Ver catálogo', `${publicSite}#catalogo`],
                    ['Acompanhar pedido', `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://orcaly.com.br').replace(/\/$/, '')}/cliente/demo`],
                    ['Promoção específica', `${publicSite}?promo=balcao`],
                  ].map(([title, url]) => (
                    <div key={title} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                      <p className="font-black text-[#071b3a]">{title}</p>
                      <img alt={title} src={`/api/qrcode?url=${encodeURIComponent(url)}`} className="mx-auto mt-4 h-44 w-44 rounded-2xl bg-white p-2" />
                      <p className="mt-3 break-all text-xs font-bold text-slate-500">{url}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'recorrentes' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="13. Recorrência" title="Repetir último pedido" subtitle="Perfeito para cliente que sempre compra o mesmo produto. Um botão e o pedido nasce de novo, porque copiar no caderno já deu." />

                <div className="grid gap-3">
                  {orders.slice(0, 10).map((order) => (
                    <div key={order.id} className="flex flex-col gap-3 rounded-[1.4rem] border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-black text-[#071b3a]">{order.nome || 'Cliente'}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">{order.produto || 'Pedido'} • {moeda(order.valor_total || order.preco_estimado || 0)}</p>
                      </div>
                      <button onClick={() => repeatOrder(order.id)} className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]">Repetir pedido</button>
                    </div>
                  ))}
                  {orders.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-5 font-bold text-slate-500">Nenhum pedido para repetir ainda.</p>}
                </div>
              </div>
            )}

            {activeTab === 'cliente' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="8. Cliente final" title="Área do cliente por link mágico" subtitle="Sem senha. O cliente vê orçamentos, status, propostas e histórico. Menos 'e aí, ficou pronto?' para atormentar a empresa." />

                <form onSubmit={createClientLink} className="grid gap-4 rounded-[1.8rem] bg-[#f5f8ff] p-5 md:grid-cols-[1fr_1fr_auto]">
                  <input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Nome do cliente" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                  <input value={cliente.whatsapp} onChange={(e) => setCliente({ ...cliente, whatsapp: e.target.value })} placeholder="WhatsApp" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                  <button className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white">Gerar link</button>
                </form>

                {clientUrl && (
                  <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
                    <p className="font-black text-emerald-700">Link do cliente</p>
                    <a href={clientUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all font-bold text-emerald-800">{clientUrl}</a>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ia' && (
              <div className="space-y-6">
                <SectionTitle eyebrow="6. IA premium" title="Transformar pedido bagunçado em orçamento" subtitle="A IA entende o pedido, estrutura campos e pergunta só o que falta. Inovador, desde que não sirva para automatizar bagunça cara." />

                <div className="grid gap-4 rounded-[1.8rem] bg-[#f5f8ff] p-5">
                  <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={5} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
                  <button type="button" onClick={parseAi} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white">Interpretar pedido</button>
                </div>

                {aiResult && (
                  <div className="rounded-[1.8rem] border border-blue-100 bg-white p-5">
                    <p className="font-black text-[#071b3a]">Resultado estruturado</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {Object.entries(aiResult).map(([key, value]) => (
                        <div key={key} className="rounded-2xl bg-[#f5f8ff] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{key}</p>
                          <p className="mt-2 whitespace-pre-wrap font-bold text-[#071b3a]">{Array.isArray(value) ? value.join('\n') : String(value ?? 'Não identificado')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
