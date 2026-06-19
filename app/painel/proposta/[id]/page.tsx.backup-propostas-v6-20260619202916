'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
  whatsapp: string | null
  logo_url: string | null
}

type Pedido = {
  id: string
  nome: string | null
  telefone: string | null
  produto: string | null
  observacoes: string | null
  valor_total: number | null
  preco_estimado: number | null
  status: string | null
  created_at: string | null
}

type Item = {
  id: string
  nome: string | null
  quantidade: number | null
  subtotal: number | null
  preco_unitario: number | null
  respostas: Record<string, string> | null
  detalhes_calculo: string | null
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function numero(valor: string) {
  const convertido = Number(valor.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(convertido) ? convertido : 0
}

function limparTelefone(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

function linkWhatsapp(numero: string | null | undefined, texto: string) {
  const limpo = limparTelefone(numero)
  if (!limpo) return ''
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

function tokenCurto() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

function dataCurta(data: string | null) {
  if (!data) return 'Sem data'
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function GerarPropostaPage() {
  const params = useParams<{ id: string }>()
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [titulo, setTitulo] = useState('Proposta comercial')
  const [valorTotal, setValorTotal] = useState('')
  const [valorSinal, setValorSinal] = useState('')
  const [prazo, setPrazo] = useState('')
  const [condicoes, setCondicoes] = useState('Valores sujeitos à confirmação após aprovação. Produção ou execução iniciada após pagamento do sinal, quando houver.')
  const [observacaoInterna, setObservacaoInterna] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [linkProposta, setLinkProposta] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregar() {
      if (!orderId) return

      setCarregando(true)
      setErro('')

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const usuario = sessionData.session?.user

        if (!usuario) {
          setErro('Você precisa estar logado.')
          setCarregando(false)
          return
        }

        const { data: empresaData, error: empresaError } = await supabase
          .from('companies')
          .select('id, nome, whatsapp, logo_url')
          .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
          .maybeSingle()

        if (empresaError) throw empresaError
        if (!empresaData) throw new Error('Empresa não encontrada.')

        const empresaAtual = empresaData as Empresa
        setEmpresa(empresaAtual)

        const { data: pedidoData, error: pedidoError } = await supabase
          .from('orders')
          .select('id, nome, telefone, produto, observacoes, valor_total, preco_estimado, status, created_at')
          .eq('id', orderId)
          .eq('company_id', empresaAtual.id)
          .maybeSingle()

        if (pedidoError) throw pedidoError
        if (!pedidoData) throw new Error('Pedido não encontrado.')

        const pedidoAtual = pedidoData as Pedido
        setPedido(pedidoAtual)

        const valorBase = Number(pedidoAtual.valor_total ?? pedidoAtual.preco_estimado ?? 0)
        setValorTotal(String(valorBase || ''))

        const { data: itensData, error: itensError } = await supabase
          .from('order_items')
          .select('id, nome, quantidade, subtotal, preco_unitario, respostas, detalhes_calculo')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })

        if (itensError) throw itensError
        setItens((itensData || []) as Item[])
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar pedido.')
      }

      setCarregando(false)
    }

    carregar()
  }, [orderId])

  const itensProposta = useMemo(() => {
    if (itens.length > 0) {
      return itens.map((item) => ({
        nome: item.nome || 'Item',
        quantidade: Number(item.quantidade || 1),
        valor: Number(item.subtotal || 0),
        preco_unitario: Number(item.preco_unitario || 0),
        respostas: item.respostas || {},
      }))
    }

    return [
      {
        nome: pedido?.produto || 'Pedido',
        quantidade: 1,
        valor: Number(pedido?.valor_total || pedido?.preco_estimado || 0),
        preco_unitario: Number(pedido?.valor_total || pedido?.preco_estimado || 0),
        respostas: {},
      },
    ]
  }, [itens, pedido])

  const valorItens = useMemo(() => {
    return itensProposta.reduce((soma, item) => soma + Number(item.valor || 0), 0)
  }, [itensProposta])

  async function gerarProposta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!empresa || !pedido || !orderId) return

    const valor = numero(valorTotal)
    const sinal = numero(valorSinal)

    if (valor <= 0) {
      alert('Informe o valor total.')
      return
    }

    setSalvando(true)
    setMensagem('Gerando proposta...')

    const token = tokenCurto()

    const { error } = await supabase.from('proposals').insert({
      company_id: empresa.id,
      order_id: orderId,
      token,
      titulo,
      cliente_nome: pedido.nome,
      cliente_whatsapp: pedido.telefone,
      itens: itensProposta,
      valor_total: valor,
      valor_sinal: sinal,
      prazo,
      condicoes,
      status: 'enviado',
      raw_data: {
        origem: 'painel_proposta',
        observacao_interna: observacaoInterna,
      },
    })

    if (error) {
      setMensagem(`Erro: ${error.message}`)
      setSalvando(false)
      return
    }

    await supabase.from('orders').update({ status: 'Proposta enviada' }).eq('id', orderId)

    const url = `${window.location.origin}/proposta/${token}`
    setLinkProposta(url)
    setMensagem('Proposta gerada com sucesso.')
    setSalvando(false)
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando proposta...</div>
      </main>
    )
  }

  if (erro || !pedido || !empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Não foi possível abrir</p>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
          <Link href="/painel" className="mt-5 inline-block rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">
            Voltar
          </Link>
        </div>
      </main>
    )
  }

  const textoWhatsapp = linkProposta
    ? `Olá, ${pedido.nome || ''}! Seu orçamento está pronto: ${linkProposta}`
    : ''

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <Link href="/painel" className="text-sm font-black text-[#05245c]">
          ← Voltar ao painel
        </Link>

        <header className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                Gerar proposta
              </p>
              <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
                Transforme o pedido em uma proposta profissional.
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                Revise os itens, ajuste valor, prazo e condições. Depois envie um link bonito para o cliente aprovar.
              </p>
            </div>

            <div className="rounded-3xl bg-[#05245c] p-5 text-white">
              <p className="text-sm font-bold text-blue-100">Valor dos itens</p>
              <p className="text-3xl font-black">{moeda(valorItens)}</p>
            </div>
          </div>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_430px]">
          <form onSubmit={gerarProposta} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Título da proposta</span>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Valor total</span>
                  <input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Valor do sinal</span>
                  <input value={valorSinal} onChange={(e) => setValorSinal(e.target.value)} placeholder="Opcional" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Prazo</span>
                  <input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex: 3 dias úteis" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Condições comerciais</span>
                <textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} rows={5} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold leading-7 outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Observação interna</span>
                <textarea value={observacaoInterna} onChange={(e) => setObservacaoInterna(e.target.value)} rows={3} placeholder="Essa observação fica salva nos dados da proposta, mas não precisa aparecer para o cliente." className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold leading-7 outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              </label>

              <button disabled={salvando} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43] disabled:opacity-60">
                {salvando ? 'Gerando...' : 'Gerar link da proposta'}
              </button>
            </div>
          </form>

          <aside className="grid h-fit gap-5">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                Pedido original
              </p>

              <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                {pedido.nome || 'Cliente'}
              </h2>

              <p className="mt-1 font-bold text-slate-500">
                {pedido.telefone || 'Sem telefone'} • {dataCurta(pedido.created_at)}
              </p>

              <div className="mt-5 grid gap-3">
                {itensProposta.map((item, index) => (
                  <div key={`${item.nome}-${index}`} className="rounded-3xl bg-blue-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#071b3a]">{item.quantidade}x {item.nome}</p>
                        {Object.entries(item.respostas || {}).filter(([, valor]) => valor).length > 0 && (
                          <div className="mt-2 grid gap-1 text-xs font-bold text-slate-600">
                            {Object.entries(item.respostas || {})
                              .filter(([, valor]) => valor)
                              .slice(0, 5)
                              .map(([chave, valor]) => (
                                <p key={chave}>{chave}: {valor}</p>
                              ))}
                          </div>
                        )}
                      </div>

                      <p className="font-black text-[#05245c]">{moeda(Number(item.valor || 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {linkProposta && (
              <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
                  Link pronto
                </p>

                <p className="mt-3 break-all rounded-2xl bg-white p-4 text-sm font-bold text-slate-700">
                  {linkProposta}
                </p>

                <div className="mt-4 grid gap-3">
                  <button type="button" onClick={() => navigator.clipboard.writeText(linkProposta)} className="rounded-2xl bg-white px-5 py-4 font-black text-emerald-700">
                    Copiar link
                  </button>

                  <a href={linkWhatsapp(pedido.telefone, textoWhatsapp)} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white">
                    Enviar no WhatsApp
                  </a>

                  <a href={linkProposta} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-200 bg-emerald-100 px-5 py-4 text-center font-black text-emerald-800">
                    Ver proposta
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}
