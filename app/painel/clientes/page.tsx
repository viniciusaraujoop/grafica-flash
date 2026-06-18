'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Cliente = {
  nome: string
  telefone: string
  pedidos: any[]
  propostas: any[]
  notas: any[]
  followups: any[]
  total: number
  ticketMedio: number
  ultimoPedido: string | null
  statusComercial: string
  risco: string
  origem: string
}

const statusOptions = ['Todos', 'Quente', 'Morno', 'Frio', 'Novo', 'Recorrente', 'Inativo', 'Sem proposta', 'Com follow-up']
const ordenacoes = [
  { id: 'recente', nome: 'Mais recentes' },
  { id: 'valor', nome: 'Maior valor' },
  { id: 'pedidos', nome: 'Mais pedidos' },
  { id: 'followup', nome: 'Follow-up pendente' },
]

function limparTelefone(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '')
}

function telefoneLabel(valor: string) {
  const limpo = limparTelefone(valor)

  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`
  }

  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`
  }

  return valor || 'Sem telefone'
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleDateString('pt-BR')
}

function diasDesde(valor: string | null | undefined) {
  if (!valor) return 9999
  const data = new Date(valor).getTime()
  return Math.floor((Date.now() - data) / (1000 * 60 * 60 * 24))
}

function whatsappLink(telefone: string, mensagem: string) {
  const limpo = limparTelefone(telefone)
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(mensagem)}`
}

function valorPedido(pedido: any) {
  return Number(pedido.valor_total || pedido.preco_estimado || pedido.preco || 0)
}

function inferirStatus(cliente: Cliente) {
  const dias = diasDesde(cliente.ultimoPedido)
  const pedidos = cliente.pedidos.length
  const propostasPendentes = cliente.propostas.filter((p) => !['aprovada', 'aprovado', 'approved'].includes(String(p.status || '').toLowerCase()))
  const followPendente = cliente.followups.some((f) => f.status === 'pendente')

  if (followPendente) return 'Com follow-up'
  if (pedidos === 1 && dias <= 7) return 'Novo'
  if (pedidos >= 3) return 'Recorrente'
  if (propostasPendentes.length > 0 && pedidos <= 1) return 'Sem proposta'
  if (dias <= 7) return 'Quente'
  if (dias <= 30) return 'Morno'
  if (dias <= 60) return 'Frio'
  return 'Inativo'
}

function riscoCliente(cliente: Cliente) {
  const dias = diasDesde(cliente.ultimoPedido)

  if (cliente.followups.some((f) => f.status === 'pendente' && f.prioridade === 'alta')) return 'Alto'
  if (dias > 60) return 'Alto'
  if (dias > 30) return 'Médio'
  return 'Baixo'
}

export default function ClientesPage() {
  const [company, setCompany] = useState<any>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('Todos')
  const [ordenacao, setOrdenacao] = useState('recente')
  const [selecionado, setSelecionado] = useState<Cliente | null>(null)

  const [nota, setNota] = useState({ tipo: 'nota', conteudo: '' })
  const [followup, setFollowup] = useState({ titulo: '', descricao: '', prioridade: 'media', due_at: '' })

  async function carregarEmpresa(userId: string) {
    const { data: ownCompany, error: ownError } = await supabase
      .from('companies')
      .select('id, nome, slug, subdomain_slug, whatsapp')
      .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
      .maybeSingle()

    if (ownError) throw ownError
    if (ownCompany) return ownCompany

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (memberError) throw memberError
    if (!member?.company_id) return null

    const { data: memberCompany, error: companyError } = await supabase
      .from('companies')
      .select('id, nome, slug, subdomain_slug, whatsapp')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError

    return memberCompany
  }

  async function carregar() {
    setLoading(true)
    setErro('')
    setMensagem('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        setErro('Você precisa estar logado.')
        setLoading(false)
        return
      }

      const empresa = await carregarEmpresa(user.id)

      if (!empresa) {
        setErro('Empresa não encontrada.')
        setLoading(false)
        return
      }

      setCompany(empresa)

      const [ordersRes, proposalsRes, notesRes, followupsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id,nome,telefone,produto,status,preco_estimado,valor_total,observacoes,created_at,dados_inteligentes')
          .eq('company_id', empresa.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('proposals')
          .select('id,cliente_nome,cliente_whatsapp,status,valor_total,valor_sinal,created_at,approved_at,token')
          .eq('company_id', empresa.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('customer_notes')
          .select('*')
          .eq('company_id', empresa.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('customer_followups')
          .select('*')
          .eq('company_id', empresa.id)
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      if (ordersRes.error) throw ordersRes.error
      if (proposalsRes.error) throw proposalsRes.error
      if (notesRes.error) throw notesRes.error
      if (followupsRes.error) throw followupsRes.error

      const map = new Map<string, Cliente>()

      function ensureCliente(nome: string, telefone: string, origem = 'Pedido') {
        const phone = limparTelefone(telefone)
        if (!phone) return null

        if (!map.has(phone)) {
          map.set(phone, {
            nome: nome || 'Cliente sem nome',
            telefone: phone,
            pedidos: [],
            propostas: [],
            notas: [],
            followups: [],
            total: 0,
            ticketMedio: 0,
            ultimoPedido: null,
            statusComercial: 'Novo',
            risco: 'Baixo',
            origem,
          })
        }

        const cliente = map.get(phone)!
        if ((!cliente.nome || cliente.nome === 'Cliente sem nome') && nome) cliente.nome = nome
        return cliente
      }

      ;(ordersRes.data || []).forEach((pedido: any) => {
        const cliente = ensureCliente(pedido.nome, pedido.telefone, 'Pedido')
        if (!cliente) return

        cliente.pedidos.push(pedido)
      })

      ;(proposalsRes.data || []).forEach((proposta: any) => {
        const cliente = ensureCliente(proposta.cliente_nome, proposta.cliente_whatsapp, 'Proposta')
        if (!cliente) return

        cliente.propostas.push(proposta)
      })

      ;(notesRes.data || []).forEach((note: any) => {
        const cliente = ensureCliente(note.cliente_nome, note.cliente_telefone, 'Nota')
        if (!cliente) return

        cliente.notas.push(note)
      })

      ;(followupsRes.data || []).forEach((task: any) => {
        const cliente = ensureCliente(task.cliente_nome, task.cliente_telefone, 'Follow-up')
        if (!cliente) return

        cliente.followups.push(task)
      })

      const lista = Array.from(map.values()).map((cliente) => {
        const pedidosOrdenados = [...cliente.pedidos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const total = cliente.pedidos.reduce((acc, pedido) => acc + valorPedido(pedido), 0)

        const completo = {
          ...cliente,
          pedidos: pedidosOrdenados,
          total,
          ticketMedio: cliente.pedidos.length ? total / cliente.pedidos.length : 0,
          ultimoPedido: pedidosOrdenados[0]?.created_at || cliente.propostas[0]?.created_at || cliente.notas[0]?.created_at || null,
        }

        completo.statusComercial = inferirStatus(completo)
        completo.risco = riscoCliente(completo)

        return completo
      })

      setClientes(lista)

      if (selecionado) {
        const atualizado = lista.find((c) => c.telefone === selecionado.telefone)
        setSelecionado(atualizado || null)
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar clientes.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    let lista = [...clientes]
    const q = busca.trim().toLowerCase()

    if (q) {
      lista = lista.filter((cliente) =>
        cliente.nome.toLowerCase().includes(q) ||
        cliente.telefone.includes(q) ||
        cliente.pedidos.some((p) => String(p.produto || '').toLowerCase().includes(q))
      )
    }

    if (status !== 'Todos') {
      lista = lista.filter((cliente) => cliente.statusComercial === status)
    }

    lista.sort((a, b) => {
      if (ordenacao === 'valor') return b.total - a.total
      if (ordenacao === 'pedidos') return b.pedidos.length - a.pedidos.length
      if (ordenacao === 'followup') {
        const aDue = a.followups.some((f) => f.status === 'pendente') ? 1 : 0
        const bDue = b.followups.some((f) => f.status === 'pendente') ? 1 : 0
        return bDue - aDue
      }

      return new Date(b.ultimoPedido || 0).getTime() - new Date(a.ultimoPedido || 0).getTime()
    })

    return lista
  }, [clientes, busca, status, ordenacao])

  const resumo = useMemo(() => {
    const totalClientes = clientes.length
    const valorTotal = clientes.reduce((acc, cliente) => acc + cliente.total, 0)
    const followupsPendentes = clientes.reduce((acc, cliente) => acc + cliente.followups.filter((f) => f.status === 'pendente').length, 0)
    const inativos = clientes.filter((cliente) => cliente.statusComercial === 'Inativo').length

    return { totalClientes, valorTotal, followupsPendentes, inativos }
  }, [clientes])

  const oportunidades = useMemo(() => {
    return clientes
      .filter((cliente) => ['Quente', 'Morno', 'Sem proposta', 'Com follow-up', 'Recorrente'].includes(cliente.statusComercial))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [clientes])

  async function salvarNota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company || !selecionado || !nota.conteudo.trim()) return

    const { error } = await supabase.from('customer_notes').insert({
      company_id: company.id,
      cliente_nome: selecionado.nome,
      cliente_telefone: selecionado.telefone,
      tipo: nota.tipo,
      conteudo: nota.conteudo.trim(),
    })

    if (error) {
      setErro(error.message)
      return
    }

    setNota({ tipo: 'nota', conteudo: '' })
    setMensagem('Nota adicionada.')
    await carregar()
  }

  async function salvarFollowup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company || !selecionado || !followup.titulo.trim()) return

    const { error } = await supabase.from('customer_followups').insert({
      company_id: company.id,
      cliente_nome: selecionado.nome,
      cliente_telefone: selecionado.telefone,
      titulo: followup.titulo.trim(),
      descricao: followup.descricao.trim() || null,
      prioridade: followup.prioridade,
      due_at: followup.due_at ? new Date(followup.due_at).toISOString() : null,
    })

    if (error) {
      setErro(error.message)
      return
    }

    setFollowup({ titulo: '', descricao: '', prioridade: 'media', due_at: '' })
    setMensagem('Follow-up criado.')
    await carregar()
  }

  async function concluirFollowup(id: string) {
    const { error } = await supabase
      .from('customer_followups')
      .update({
        status: 'concluido',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setErro(error.message)
      return
    }

    setMensagem('Follow-up concluído.')
    await carregar()
  }

  function mensagemCliente(cliente: Cliente) {
    if (cliente.statusComercial === 'Inativo') {
      return `Olá, ${cliente.nome}! Passando para lembrar que seguimos à disposição. Posso te ajudar com um novo pedido ou orçamento?`
    }

    if (cliente.statusComercial === 'Sem proposta') {
      return `Olá, ${cliente.nome}! Vi sua solicitação e posso te ajudar a fechar uma proposta organizada. Pode me confirmar alguns detalhes?`
    }

    return `Olá, ${cliente.nome}! Tudo bem? Estou entrando em contato para acompanhar seu pedido/orçamento.`
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando Mini-CRM...</div>
      </main>
    )
  }

  if (erro && !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Mini-CRM indisponível</p>
          <p className="mt-3 font-bold text-red-600">{erro}</p>
          <Link href="/painel" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Voltar ao painel</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-44 w-44 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">Mini-CRM</h1>
                <p className="mt-2 max-w-2xl font-bold leading-7 text-slate-500">
                  Clientes, histórico, oportunidades e follow-ups em um só lugar.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[620px]">
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Clientes</p>
                  <p className="mt-1 text-2xl font-black">{resumo.totalClientes}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Vendas</p>
                  <p className="mt-1 text-xl font-black">{moeda(resumo.valorTotal)}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Follow-ups</p>
                  <p className="mt-1 text-2xl font-black text-yellow-700">{resumo.followupsPendentes}</p>
                </div>
                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Inativos</p>
                  <p className="mt-1 text-2xl font-black text-red-700">{resumo.inativos}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {mensagem && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{mensagem}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_260px_220px]">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou produto"
            className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-bold outline-none shadow-lg shadow-blue-950/5 focus:border-[#05245c]"
          />

          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-bold outline-none shadow-lg shadow-blue-950/5">
            {statusOptions.map((item) => <option key={item}>{item}</option>)}
          </select>

          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-bold outline-none shadow-lg shadow-blue-950/5">
            {ordenacoes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <section className="grid gap-4">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Clientes</p>
                  <h2 className="mt-1 text-2xl font-black text-[#071b3a]">{filtrados.length} encontrados</h2>
                </div>
                <button onClick={carregar} className="rounded-2xl bg-[#05245c] px-4 py-3 text-sm font-black text-white">Atualizar</button>
              </div>

              <div className="grid gap-3">
                {filtrados.map((cliente) => (
                  <button
                    key={cliente.telefone}
                    onClick={() => setSelecionado(cliente)}
                    className={`rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-0.5 ${
                      selecionado?.telefone === cliente.telefone ? 'border-[#05245c] bg-blue-50 shadow-lg shadow-blue-950/8' : 'border-slate-200 bg-white hover:bg-[#f8fbff]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-black text-[#071b3a]">{cliente.nome}</p>
                          <span className="rounded-full bg-[#05245c] px-3 py-1 text-xs font-black text-white">{cliente.statusComercial}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${cliente.risco === 'Alto' ? 'bg-red-100 text-red-700' : cliente.risco === 'Médio' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            Risco {cliente.risco}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-bold text-slate-500">
                          {telefoneLabel(cliente.telefone)} • Último contato: {dataBR(cliente.ultimoPedido)}
                        </p>
                      </div>

                      <div className="grid gap-2 text-left sm:grid-cols-3 lg:min-w-[360px]">
                        <div className="rounded-2xl bg-[#f5f8ff] p-3">
                          <p className="text-xs font-black uppercase text-slate-400">Pedidos</p>
                          <p className="font-black">{cliente.pedidos.length}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f5f8ff] p-3">
                          <p className="text-xs font-black uppercase text-slate-400">Total</p>
                          <p className="font-black">{moeda(cliente.total)}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f5f8ff] p-3">
                          <p className="text-xs font-black uppercase text-slate-400">Ticket</p>
                          <p className="font-black">{moeda(cliente.ticketMedio)}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {filtrados.length === 0 && (
                  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="text-2xl font-black text-[#071b3a]">Nenhum cliente encontrado</p>
                    <p className="mt-2 font-bold text-slate-500">Ajuste os filtros ou aguarde novos pedidos.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Oportunidades</p>
              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Quem chamar agora</h2>

              <div className="mt-5 grid gap-3">
                {oportunidades.map((cliente) => (
                  <a
                    key={cliente.telefone}
                    href={whatsappLink(cliente.telefone, mensagemCliente(cliente))}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-[#f5f8ff] p-4 transition hover:bg-blue-50"
                  >
                    <p className="font-black text-[#071b3a]">{cliente.nome}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{cliente.statusComercial} • {moeda(cliente.total)}</p>
                  </a>
                ))}

                {oportunidades.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-4 text-sm font-bold text-slate-500">Nenhuma oportunidade forte agora.</p>}
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Detalhes</p>

              {!selecionado ? (
                <div className="mt-5 rounded-2xl bg-[#f5f8ff] p-6 text-center">
                  <p className="font-black text-[#071b3a]">Selecione um cliente</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">Histórico, notas e tarefas aparecem aqui.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#071b3a]">{selecionado.nome}</h2>
                    <p className="mt-1 font-bold text-slate-500">{telefoneLabel(selecionado.telefone)}</p>
                  </div>

                  <a
                    href={whatsappLink(selecionado.telefone, mensagemCliente(selecionado))}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white"
                  >
                    Chamar no WhatsApp
                  </a>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#f5f8ff] p-4">
                      <p className="text-xs font-black uppercase text-slate-400">Pedidos</p>
                      <p className="text-xl font-black">{selecionado.pedidos.length}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f5f8ff] p-4">
                      <p className="text-xs font-black uppercase text-slate-400">Total</p>
                      <p className="text-xl font-black">{moeda(selecionado.total)}</p>
                    </div>
                  </div>

                  <form onSubmit={salvarNota} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-black text-[#071b3a]">Nova nota</p>
                    <div className="mt-3 grid gap-3">
                      <select value={nota.tipo} onChange={(e) => setNota((v) => ({ ...v, tipo: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold">
                        <option value="nota">Nota</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="ligacao">Ligação</option>
                        <option value="feedback">Feedback</option>
                        <option value="financeiro">Financeiro</option>
                        <option value="proposta">Proposta</option>
                      </select>
                      <textarea value={nota.conteudo} onChange={(e) => setNota((v) => ({ ...v, conteudo: e.target.value }))} placeholder="Escreva uma observação sobre o cliente" rows={3} className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold outline-none" />
                      <button className="rounded-xl bg-[#05245c] px-4 py-3 font-black text-white">Salvar nota</button>
                    </div>
                  </form>

                  <form onSubmit={salvarFollowup} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-black text-[#071b3a]">Novo follow-up</p>
                    <div className="mt-3 grid gap-3">
                      <input value={followup.titulo} onChange={(e) => setFollowup((v) => ({ ...v, titulo: e.target.value }))} placeholder="Ex.: Chamar sobre proposta" className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold outline-none" />
                      <input type="datetime-local" value={followup.due_at} onChange={(e) => setFollowup((v) => ({ ...v, due_at: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold outline-none" />
                      <select value={followup.prioridade} onChange={(e) => setFollowup((v) => ({ ...v, prioridade: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold">
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                      </select>
                      <textarea value={followup.descricao} onChange={(e) => setFollowup((v) => ({ ...v, descricao: e.target.value }))} placeholder="Detalhes" rows={2} className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 font-bold outline-none" />
                      <button className="rounded-xl bg-[#05245c] px-4 py-3 font-black text-white">Criar follow-up</button>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-[#071b3a]">Follow-ups</p>
                    <div className="mt-3 grid gap-2">
                      {selecionado.followups.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhum follow-up.</p>}
                      {selecionado.followups.map((f: any) => (
                        <div key={f.id} className="rounded-xl bg-[#f5f8ff] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{f.titulo}</p>
                              <p className="text-xs font-bold text-slate-500">{f.status} • {f.prioridade} • {dataBR(f.due_at)}</p>
                            </div>
                            {f.status === 'pendente' && <button onClick={() => concluirFollowup(f.id)} className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">OK</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-[#071b3a]">Notas</p>
                    <div className="mt-3 grid gap-2">
                      {selecionado.notas.length === 0 && <p className="text-sm font-bold text-slate-500">Nenhuma nota.</p>}
                      {selecionado.notas.map((n: any) => (
                        <div key={n.id} className="rounded-xl bg-[#f5f8ff] p-3">
                          <p className="text-xs font-black uppercase text-[#05245c]">{n.tipo} • {dataBR(n.created_at)}</p>
                          <p className="mt-1 text-sm font-bold text-slate-700">{n.conteudo}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-[#071b3a]">Últimos pedidos</p>
                    <div className="mt-3 grid gap-2">
                      {selecionado.pedidos.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="rounded-xl bg-[#f5f8ff] p-3">
                          <p className="font-black">{p.produto || 'Pedido'}</p>
                          <p className="text-xs font-bold text-slate-500">{p.status} • {dataBR(p.created_at)} • {moeda(valorPedido(p))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
