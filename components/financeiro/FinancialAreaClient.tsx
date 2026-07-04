"use client"

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FinanceMode = 'overview' | 'lancamentos' | 'receber' | 'pagar' | 'materiais' | 'notas'

type Company = {
  id: string
  nome?: string | null
  business_type?: string | null
  site_template?: string | null
}

type DbRow = Record<string, unknown>

type FinancialItem = {
  id: string
  kind: 'entrada' | 'saida' | 'receber' | 'pagar' | 'material' | 'nota'
  description: string
  amount: number
  category: string
  status: string
  partner: string
  paymentMethod: string
  competenceDate: string
  dueDate: string
  createdAt: string
  invoiceNumber: string
  invoiceSeries: string
  documentUrl: string
  raw: DbRow
}

type MaterialItem = {
  id: string
  description: string
  amount: number
  category: string
  supplier: string
  date: string
  status: string
}

type FormState = {
  tipo: 'entrada' | 'saida'
  categoria: string
  descricao: string
  valor: string
  data: string
  vencimento: string
  status: string
  formaPagamento: string
  pessoa: string
  observacoes: string
  notaNumero: string
  notaSerie: string
  notaDocumento: string
}

const modeContent: Record<FinanceMode, {
  title: string
  description: string
  primaryAction: string
  secondaryAction?: string
  emptyTitle: string
  emptyDescription: string
}> = {
  overview: {
    title: 'Financeiro',
    description: 'Acompanhe o resultado da sua empresa, veja entradas, saídas, contas e documentos importantes.',
    primaryAction: 'Nova entrada',
    secondaryAction: 'Nova saída',
    emptyTitle: 'Nenhum dado financeiro ainda.',
    emptyDescription: 'Registre entradas e saídas para acompanhar o resultado da sua empresa.',
  },
  lancamentos: {
    title: 'Entradas e saídas',
    description: 'Registre e acompanhe tudo que entra e sai do caixa da empresa.',
    primaryAction: 'Nova entrada',
    secondaryAction: 'Nova saída',
    emptyTitle: 'Nenhum lançamento financeiro ainda.',
    emptyDescription: 'Registre entradas e saídas para acompanhar o caixa da sua empresa.',
  },
  receber: {
    title: 'Contas a receber',
    description: 'Acompanhe valores que clientes ainda precisam pagar.',
    primaryAction: 'Nova conta a receber',
    emptyTitle: 'Nenhuma conta a receber cadastrada.',
    emptyDescription: 'Cadastre valores pendentes para controlar o que ainda precisa entrar no caixa.',
  },
  pagar: {
    title: 'Contas a pagar',
    description: 'Acompanhe despesas futuras, fornecedores e pagamentos pendentes.',
    primaryAction: 'Nova conta a pagar',
    emptyTitle: 'Nenhuma conta a pagar cadastrada.',
    emptyDescription: 'Cadastre despesas futuras para organizar seus pagamentos.',
  },
  materiais: {
    title: 'Materiais e custos',
    description: 'Controle gastos com materiais, insumos, peças e custos de produção.',
    primaryAction: 'Novo custo',
    secondaryAction: 'Nova compra de material',
    emptyTitle: 'Nenhum material ou custo cadastrado.',
    emptyDescription: 'Registre gastos com insumos, peças ou produção para entender melhor o resultado da empresa.',
  },
  notas: {
    title: 'Notas fiscais',
    description: 'Organize notas emitidas e recebidas, envie XML/PDF e vincule documentos ao financeiro.',
    primaryAction: 'Cadastrar nota',
    secondaryAction: 'Enviar XML/PDF',
    emptyTitle: 'Nenhuma nota fiscal cadastrada.',
    emptyDescription: 'Cadastre manualmente ou envie XML/PDF para manter seus documentos organizados.',
  },
}

const paymentMethods = ['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência', 'Mercado Pago', 'Outro']
const statusOptions = ['pago', 'pendente', 'recebido', 'vencido', 'cancelado']
const categoryByMode: Record<FinanceMode, string[]> = {
  overview: ['Venda', 'Serviço', 'Material', 'Fornecedor', 'Conta a receber', 'Conta a pagar'],
  lancamentos: ['Venda', 'Serviço', 'Material', 'Fornecedor', 'Imposto', 'Entrega/Frete', 'Marketing', 'Outras despesas'],
  receber: ['Conta a receber', 'Pedido', 'Orçamento', 'Proposta', 'Serviço', 'Venda'],
  pagar: ['Conta a pagar', 'Fornecedor', 'Material', 'Imposto', 'Aluguel', 'Energia/Internet', 'Marketing'],
  materiais: ['Material', 'Insumo', 'Peça', 'Embalagem', 'Produção', 'Acabamento', 'Terceirização'],
  notas: ['Nota fiscal', 'NFe recebida', 'NFe emitida', 'DANFE', 'Documento fiscal'],
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return fallback
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value.replace(',', '.')) || 0
  return 0
}

function formatDate(value: string) {
  if (!value) return 'Sem data'

  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Sem data'

  return date.toLocaleDateString('pt-BR')
}

function normalizeStatus(value: unknown) {
  const status = asString(value, 'pendente').toLowerCase()

  if (status === 'paid') return 'pago'
  if (status === 'received') return 'recebido'
  if (status === 'pending') return 'pendente'
  if (status === 'overdue') return 'vencido'
  if (status === 'canceled') return 'cancelado'

  return status || 'pendente'
}

function statusLabel(status: string) {
  if (status === 'pago') return 'Pago'
  if (status === 'recebido') return 'Recebido'
  if (status === 'vencido') return 'Vencido'
  if (status === 'cancelado') return 'Cancelado'
  return 'Pendente'
}

function statusClass(status: string) {
  if (status === 'pago' || status === 'recebido') return 'bg-emerald-100 text-emerald-700'
  if (status === 'vencido') return 'bg-red-100 text-red-700'
  if (status === 'cancelado') return 'bg-slate-200 text-slate-600'
  return 'bg-yellow-100 text-yellow-700'
}

function normalizeType(row: DbRow): FinancialItem['kind'] {
  const raw = asString(row.type || row.tipo).toLowerCase()
  const category = asString(row.category || row.categoria).toLowerCase()
  const origin = asString(row.origem).toLowerCase()
  const hasInvoice = Boolean(row.nota_numero || row.nota_chave || row.invoice_id || row.xml_url || row.pdf_url)

  if (raw === 'income') return 'entrada'
  if (raw === 'expense') return 'saida'
  if (raw === 'receivable') return 'receber'
  if (raw === 'payable') return 'pagar'
  if (raw === 'entrada') return category.includes('receber') ? 'receber' : 'entrada'
  if (raw === 'saida') {
    if (category.includes('pagar')) return 'pagar'
    if (category.includes('material') || category.includes('insumo') || category.includes('peça') || category.includes('peca') || category.includes('custo')) return 'material'
    if (category.includes('nota') || origin === 'nota_fiscal' || hasInvoice) return 'nota'
    return 'saida'
  }
  if (category.includes('receber')) return 'receber'
  if (category.includes('pagar')) return 'pagar'
  if (category.includes('material') || category.includes('insumo') || category.includes('peça') || category.includes('peca') || category.includes('custo')) return 'material'
  if (category.includes('nota') || origin === 'nota_fiscal' || hasInvoice) return 'nota'

  return 'saida'
}

function normalizeTransaction(row: DbRow): FinancialItem {
  const id = asString(row.id, crypto.randomUUID())
  const kind = normalizeType(row)
  const description = asString(row.description || row.descricao, 'Lançamento financeiro')
  const category = asString(row.category || row.categoria, kind === 'entrada' ? 'Entrada' : 'Saída')
  const status = normalizeStatus(row.status)

  return {
    id,
    kind,
    description,
    amount: asNumber(row.amount || row.valor || row.total_amount),
    category,
    status,
    partner: asString(row.person_name || row.fornecedor_cliente || row.supplier_name || row.cliente_nome || row.customer_name, 'Não informado'),
    paymentMethod: asString(row.payment_method || row.forma_pagamento, 'Não informado'),
    competenceDate: asString(row.data_competencia || row.issue_date || row.created_at, ''),
    dueDate: asString(row.due_date || row.vencimento || row.data_competencia, ''),
    createdAt: asString(row.created_at, ''),
    invoiceNumber: asString(row.number || row.nota_numero, ''),
    invoiceSeries: asString(row.series || row.nota_serie, ''),
    documentUrl: asString(row.pdf_url || row.xml_url || row.documento_url, ''),
    raw: row,
  }
}

function normalizeMaterial(row: DbRow): MaterialItem {
  const quantity = asNumber(row.quantidade || 1)
  const unit = asNumber(row.valor_unitario || row.unit_amount || row.valor || row.amount)
  const total = asNumber(row.valor_total || row.total_amount) || quantity * unit

  return {
    id: asString(row.id, crypto.randomUUID()),
    description: asString(row.nome || row.description || row.descricao, 'Material/custo'),
    amount: total,
    category: asString(row.categoria || row.category, 'Material'),
    supplier: asString(row.fornecedor || row.supplier_name || row.fornecedor_cliente, 'Não informado'),
    date: asString(row.created_at || row.data_competencia, ''),
    status: normalizeStatus(row.status || 'pago'),
  }
}

function isDueToday(item: FinancialItem) {
  return item.dueDate.slice(0, 10) === today()
}

function isOverdue(item: FinancialItem) {
  if (!item.dueDate || item.status === 'pago' || item.status === 'recebido' || item.status === 'cancelado') return false
  return new Date(`${item.dueDate.slice(0, 10)}T12:00:00`).getTime() < new Date(`${today()}T12:00:00`).getTime()
}

function defaultForm(mode: FinanceMode, forcedType?: 'entrada' | 'saida'): FormState {
  const isPayable = mode === 'pagar'
  const isReceivable = mode === 'receber'
  const isMaterial = mode === 'materiais'
  const isInvoice = mode === 'notas'
  const type: 'entrada' | 'saida' = forcedType || (isReceivable ? 'entrada' : 'saida')
  const categories = categoryByMode[mode]

  return {
    tipo: type,
    categoria: isPayable ? 'Conta a pagar' : isReceivable ? 'Conta a receber' : isMaterial ? 'Material' : isInvoice ? 'Nota fiscal' : type === 'entrada' ? 'Venda' : 'Fornecedor',
    descricao: '',
    valor: '',
    data: today(),
    vencimento: isPayable || isReceivable ? today() : '',
    status: isReceivable || isPayable ? 'pendente' : 'pago',
    formaPagamento: paymentMethods[0],
    pessoa: '',
    observacoes: '',
    notaNumero: '',
    notaSerie: '',
    notaDocumento: '',
  }
}

function segmentMaterialHints(segment?: string | null) {
  const value = String(segment || '').toLowerCase()

  if (value.includes('food') || value.includes('aliment')) return ['Ingredientes', 'Embalagens', 'Bebidas', 'Insumos', 'Taxa de entrega']
  if (value.includes('auto') || value.includes('oficina')) return ['Peças', 'Óleo', 'Ferramentas', 'Mão de obra terceirizada']
  if (value.includes('assist')) return ['Peças', 'Componentes', 'Ferramentas', 'Garantia']
  if (value.includes('beauty') || value.includes('barber') || value.includes('beleza')) return ['Produtos de atendimento', 'Materiais de consumo', 'Comissões', 'Pacotes']

  return ['Papel', 'Lona', 'Adesivo', 'Tinta', 'Acabamento', 'Terceirização']
}

function rowMatchesMode(item: FinancialItem, mode: FinanceMode) {
  if (mode === 'overview') return true
  if (mode === 'lancamentos') return item.kind === 'entrada' || item.kind === 'saida'
  if (mode === 'receber') return item.kind === 'receber'
  if (mode === 'pagar') return item.kind === 'pagar'
  if (mode === 'materiais') return item.kind === 'material'
  if (mode === 'notas') return item.kind === 'nota' || Boolean(item.invoiceNumber || item.documentUrl)

  return true
}

export default function FinancialAreaClient({ mode }: { mode: FinanceMode }) {
  const content = modeContent[mode]
  const [company, setCompany] = useState<Company | null>(null)
  const [items, setItems] = useState<FinancialItem[]>([])
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(() => defaultForm(mode))

  async function loadCompany(userId: string) {
    const { data: ownCompany, error: ownError } = await supabase
      .from('companies')
      .select('*')
      .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
      .maybeSingle()

    if (ownError) throw ownError
    if (ownCompany) return ownCompany as Company

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id,cargo,status')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (memberError) throw memberError
    const memberRow = member as { company_id?: string; cargo?: string } | null
    if (!memberRow?.company_id) return null

    const { data: memberCompany, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', memberRow.company_id)
      .maybeSingle()

    if (companyError) throw companyError
    return memberCompany as Company | null
  }

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        setError('Você precisa estar logado.')
        setLoading(false)
        return
      }

      const loadedCompany = await loadCompany(user.id)
      if (!loadedCompany) {
        setError('Empresa não encontrada.')
        setLoading(false)
        return
      }

      setCompany(loadedCompany)

      const [transactionResult, materialResult] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select('*')
          .eq('company_id', loadedCompany.id)
          .order('created_at', { ascending: false })
          .limit(600),
        supabase
          .from('financial_material_entries')
          .select('*')
          .eq('company_id', loadedCompany.id)
          .order('created_at', { ascending: false })
          .limit(300),
      ])

      if (transactionResult.error) throw transactionResult.error

      const transactionRows = Array.isArray(transactionResult.data) ? transactionResult.data as DbRow[] : []
      const materialRows = !materialResult.error && Array.isArray(materialResult.data) ? materialResult.data as DbRow[] : []

      setItems(transactionRows.map(normalizeTransaction))
      setMaterials(materialRows.map(normalizeMaterial))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados financeiros.')
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    setForm(defaultForm(mode))
    setShowForm(false)
  }, [mode])

  const monthItems = useMemo(() => {
    return items.filter((item) => {
      const date = (item.competenceDate || item.dueDate || item.createdAt).slice(0, 7)
      return !month || date === month
    })
  }, [items, month])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()

    return monthItems
      .filter((item) => rowMatchesMode(item, mode))
      .filter((item) => statusFilter === 'todos' || item.status === statusFilter)
      .filter((item) => {
        if (!q) return true
        return [item.description, item.category, item.partner, item.paymentMethod, item.invoiceNumber]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
  }, [monthItems, mode, query, statusFilter])

  const materialItems = useMemo(() => {
    if (mode !== 'materiais') return []

    const transactionMaterials = filteredItems.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      category: item.category,
      supplier: item.partner,
      date: item.competenceDate || item.dueDate,
      status: item.status,
    }))

    const currentMonthMaterials = materials.filter((item) => !month || item.date.slice(0, 7) === month)

    return [...transactionMaterials, ...currentMonthMaterials]
  }, [filteredItems, materials, mode, month])

  const overview = useMemo(() => {
    const valid = monthItems.filter((item) => item.status !== 'cancelado')
    const income = valid.filter((item) => item.kind === 'entrada' || item.kind === 'receber').reduce((sum, item) => sum + item.amount, 0)
    const expense = valid.filter((item) => item.kind === 'saida' || item.kind === 'pagar' || item.kind === 'material' || item.kind === 'nota').reduce((sum, item) => sum + item.amount, 0)
    const receivable = valid.filter((item) => item.kind === 'receber' && item.status !== 'recebido' && item.status !== 'pago').reduce((sum, item) => sum + item.amount, 0)
    const payable = valid.filter((item) => (item.kind === 'pagar' || item.kind === 'material') && item.status !== 'pago').reduce((sum, item) => sum + item.amount, 0)
    const materialCost = valid.filter((item) => item.kind === 'material').reduce((sum, item) => sum + item.amount, 0)
    const invoices = valid.filter((item) => item.kind === 'nota' || item.invoiceNumber).length

    return {
      income,
      expense,
      profit: income - expense,
      receivable,
      payable,
      predictedBalance: income + receivable - expense - payable,
      materialCost,
      invoices,
      dueToday: valid.filter(isDueToday).length,
      overdue: valid.filter(isOverdue).length,
    }
  }, [monthItems])

  function openCreate(type?: 'entrada' | 'saida') {
    setForm(defaultForm(mode, type))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function saveFinancialItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const value = Number(form.valor.replace(',', '.')) || 0
      if (!form.descricao.trim()) throw new Error('Informe a descrição.')
      if (value <= 0) throw new Error('Informe um valor maior que zero.')

      const payload: DbRow = {
        company_id: company.id,
        tipo: form.tipo,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        valor: value,
        data_competencia: form.data || today(),
        vencimento: form.vencimento || null,
        status: form.status,
        forma_pagamento: form.formaPagamento,
        fornecedor_cliente: form.pessoa,
        centro_custo: mode === 'materiais' ? 'Produção' : 'Geral',
        observacoes: form.observacoes,
        origem: mode === 'notas' ? 'nota_fiscal' : 'manual',
      }

      if (mode === 'notas') {
        payload.nota_numero = form.notaNumero || null
        payload.nota_serie = form.notaSerie || null
        payload.documento_url = form.notaDocumento || null
        payload.documento_nome = form.notaDocumento ? 'Documento fiscal' : null
      }

      const { error: insertError } = await supabase.from('financial_transactions').insert(payload)
      if (insertError) throw insertError

      setMessage('Registro financeiro salvo.')
      setShowForm(false)
      setForm(defaultForm(mode))
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro financeiro.')
    }

    setSaving(false)
  }

  async function updateStatus(id: string, nextStatus: string) {
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('financial_transactions')
      .update({ status: nextStatus })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(nextStatus === 'cancelado' ? 'Registro cancelado.' : 'Status atualizado.')
    await loadData()
  }

  const cards = mode === 'receber'
    ? [
      ['Total a receber', overview.receivable, 'Valores pendentes de entrada'],
      ['Vencem hoje', overview.dueToday, 'Contas com vencimento hoje'],
      ['Vencidas', overview.overdue, 'Pendências atrasadas'],
      ['Receita do mês', overview.income, 'Entradas e recebíveis'],
    ]
    : mode === 'pagar'
      ? [
        ['Total a pagar', overview.payable, 'Despesas pendentes'],
        ['Vencem hoje', overview.dueToday, 'Contas com vencimento hoje'],
        ['Vencidas', overview.overdue, 'Pendências atrasadas'],
        ['Despesas do mês', overview.expense, 'Saídas e custos'],
      ]
      : mode === 'materiais'
        ? [
          ['Custo do mês', overview.materialCost, 'Materiais, insumos e produção'],
          ['Registros', materialItems.length, 'Itens encontrados'],
          ['A pagar', overview.payable, 'Custos pendentes'],
          ['Saldo previsto', overview.predictedBalance, 'Resultado projetado'],
        ]
        : mode === 'notas'
          ? [
            ['Notas cadastradas', filteredItems.length, 'Documentos localizados'],
            ['Pendentes', filteredItems.filter((item) => item.status === 'pendente').length, 'Aguardando organização'],
            ['Valor total', filteredItems.reduce((sum, item) => sum + item.amount, 0), 'Somatório de documentos'],
            ['Vinculadas', filteredItems.filter((item) => item.raw.financial_transaction_id || item.id).length, 'Com vínculo financeiro'],
          ]
          : [
            ['Receita do mês', overview.income, 'Entradas e recebíveis'],
            ['Despesas do mês', overview.expense, 'Saídas, contas e custos'],
            ['Lucro estimado', overview.profit, 'Receita menos despesas'],
            ['A receber', overview.receivable, 'Valores ainda pendentes'],
            ['A pagar', overview.payable, 'Despesas futuras'],
            ['Saldo previsto', overview.predictedBalance, 'Projeção com pendências'],
          ]

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando financeiro...</div>
      </main>
    )
  }

  if (error && !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Financeiro indisponível</p>
          <p className="mt-3 font-bold text-red-600">{error}</p>
          <Link href="/painel" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">Voltar ao painel</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-44 w-44 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">{content.title}</h1>
                <p className="mt-2 max-w-2xl font-bold leading-7 text-slate-500">{content.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {mode === 'overview' ? (
                  <>
                    <Link href="/painel/financeiro/lancamentos" className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/10">Ver entradas e saídas</Link>
                    <Link href="/painel/notas-fiscais" className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]">Ver notas fiscais</Link>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => openCreate(mode === 'lancamentos' ? 'entrada' : undefined)} className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/10">{content.primaryAction}</button>
                    {content.secondaryAction ? (
                      <button type="button" onClick={() => openCreate('saida')} className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]">{content.secondaryAction}</button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <nav className="flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {[
            ['/painel/financeiro', 'Visão geral'],
            ['/painel/financeiro/lancamentos', 'Entradas e saídas'],
            ['/painel/financeiro/contas-a-receber', 'Contas a receber'],
            ['/painel/financeiro/contas-a-pagar', 'Contas a pagar'],
            ['/painel/financeiro/materiais', 'Materiais e custos'],
            ['/painel/notas-fiscais', 'Notas fiscais'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${
              (mode === 'overview' && href === '/painel/financeiro') ||
              (mode === 'lancamentos' && href.includes('lancamentos')) ||
              (mode === 'receber' && href.includes('receber')) ||
              (mode === 'pagar' && href.includes('pagar')) ||
              (mode === 'materiais' && href.includes('materiais')) ||
              (mode === 'notas' && href.includes('notas'))
                ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20'
                : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'
            }`}>
              {label}
            </Link>
          ))}
        </nav>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(([title, value, caption]) => (
            <div key={String(title)} className="rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{String(title)}</p>
              <p className={`mt-2 text-3xl font-black tracking-[-0.04em] ${Number(value) < 0 ? 'text-red-700' : 'text-[#071b3a]'}`}>
                {typeof value === 'number' && String(title).toLowerCase().includes('venc') ? value : money(Number(value || 0))}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{String(caption)}</p>
            </div>
          ))}
        </section>

        {mode === 'overview' ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Visão geral</p>
                  <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Últimos lançamentos</h2>
                </div>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
              </div>

              <FinancialList items={monthItems.slice(0, 8)} mode={mode} onUpdateStatus={updateStatus} />
            </div>

            <aside className="grid gap-5">
              <OverviewLink href="/painel/financeiro/lancamentos" title="Entradas e saídas" description="Registrar e acompanhar tudo que entra e sai do caixa." />
              <OverviewLink href="/painel/financeiro/contas-a-receber" title="Contas a receber" description="Valores de clientes que ainda precisam entrar." />
              <OverviewLink href="/painel/financeiro/contas-a-pagar" title="Contas a pagar" description="Despesas futuras, fornecedores e vencimentos." />
              <OverviewLink href="/painel/financeiro/materiais" title="Materiais e custos" description="Insumos, peças, produção e compras de material." />
              <OverviewLink href="/painel/notas-fiscais" title="Notas fiscais" description="XML, PDF/DANFE e documentos vinculados ao financeiro." />
            </aside>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">{content.title}</p>
                  <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Registros</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none">
                    <option value="todos">Todos os status</option>
                    {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                </div>
              </div>

              {mode === 'materiais' ? (
                <MaterialList items={materialItems} />
              ) : (
                <FinancialList items={filteredItems} mode={mode} onUpdateStatus={updateStatus} />
              )}

              {(mode === 'materiais' ? materialItems.length === 0 : filteredItems.length === 0) ? (
                <EmptyState title={content.emptyTitle} description={content.emptyDescription} action={content.primaryAction} onClick={() => openCreate()} />
              ) : null}
            </div>

            <aside className="space-y-5">
              {showForm ? (
                <FinancialForm
                  mode={mode}
                  form={form}
                  saving={saving}
                  company={company}
                  onChange={updateForm}
                  onSubmit={saveFinancialItem}
                  onCancel={() => setShowForm(false)}
                />
              ) : (
                <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Ações</p>
                  <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Atalhos</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Cada função financeira agora tem sua própria área. Parece óbvio, mas o óbvio às vezes precisa ser implementado na unha.</p>
                  <div className="mt-5 grid gap-2">
                    <button type="button" onClick={() => openCreate()} className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">{content.primaryAction}</button>
                    {content.secondaryAction ? <button type="button" onClick={() => openCreate('saida')} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">{content.secondaryAction}</button> : null}
                    <Link href="/painel/financeiro" className="rounded-2xl bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">Voltar à visão geral</Link>
                  </div>
                </div>
              )}

              {mode === 'materiais' ? (
                <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Sugestões por segmento</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {segmentMaterialHints(company?.business_type || company?.site_template).map((hint) => (
                      <span key={hint} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">{hint}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        )}
      </section>
    </main>
  )
}

function OverviewLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
      <p className="text-sm font-black text-[#05245c]">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{description}</p>
    </Link>
  )
}

function EmptyState({ title, description, action, onClick }: { title: string; description: string; action: string; onClick: () => void }) {
  return (
    <div className="mt-5 rounded-[2rem] border border-dashed border-slate-300 bg-[#f8fbff] p-10 text-center">
      <p className="text-2xl font-black text-[#071b3a]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl font-bold leading-7 text-slate-500">{description}</p>
      <button type="button" onClick={onClick} className="mt-5 rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">{action}</button>
    </div>
  )
}

function FinancialList({ items, mode, onUpdateStatus }: { items: FinancialItem[]; mode: FinanceMode; onUpdateStatus: (id: string, nextStatus: string) => Promise<void> }) {
  if (items.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-blue-100">
      <div className="grid grid-cols-[1.3fr_110px_120px_120px] gap-3 bg-[#f8fbff] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 max-lg:hidden">
        <span>Descrição</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Ações</span>
      </div>
      <div className="divide-y divide-blue-50 bg-white">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_110px_120px_120px] lg:items-center">
            <div>
              <p className="font-black text-[#071b3a]">{item.description}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {item.partner} • {item.category} • {formatDate(item.dueDate || item.competenceDate)}
              </p>
              {mode === 'notas' && item.invoiceNumber ? <p className="mt-1 text-xs font-black text-[#05245c]">NF {item.invoiceNumber}{item.invoiceSeries ? ` / Série ${item.invoiceSeries}` : ''}</p> : null}
            </div>
            <p className={`font-black ${item.kind === 'entrada' || item.kind === 'receber' ? 'text-emerald-700' : 'text-red-700'}`}>{money(item.amount)}</p>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
            <div className="flex flex-wrap gap-2">
              {item.status !== 'pago' && item.status !== 'recebido' && item.status !== 'cancelado' ? (
                <button type="button" onClick={() => onUpdateStatus(item.id, item.kind === 'receber' ? 'recebido' : 'pago')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">
                  {item.kind === 'receber' ? 'Receber' : 'Pagar'}
                </button>
              ) : null}
              {item.status !== 'cancelado' ? (
                <button type="button" onClick={() => onUpdateStatus(item.id, 'cancelado')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Cancelar</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MaterialList({ items }: { items: MaterialItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-blue-100">
      <div className="grid grid-cols-[1.3fr_120px_120px] gap-3 bg-[#f8fbff] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 max-lg:hidden">
        <span>Material/custo</span>
        <span>Valor</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-blue-50 bg-white">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.3fr_120px_120px] lg:items-center">
            <div>
              <p className="font-black text-[#071b3a]">{item.description}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">{item.category} • {item.supplier} • {formatDate(item.date)}</p>
            </div>
            <p className="font-black text-red-700">{money(item.amount)}</p>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialForm({
  mode,
  form,
  saving,
  company,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: FinanceMode
  form: FormState
  saving: boolean
  company: Company | null
  onChange: (field: keyof FormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const categories = categoryByMode[mode]

  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Novo registro</p>
      <h2 className="mt-1 text-2xl font-black text-[#071b3a]">{modeContent[mode].title}</h2>

      <div className="mt-5 grid gap-3">
        {mode === 'lancamentos' ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f8fbff] p-2">
            <button type="button" onClick={() => onChange('tipo', 'entrada')} className={`rounded-xl px-4 py-3 text-sm font-black ${form.tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Entrada</button>
            <button type="button" onClick={() => onChange('tipo', 'saida')} className={`rounded-xl px-4 py-3 text-sm font-black ${form.tipo === 'saida' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Saída</button>
          </div>
        ) : null}

        <input value={form.descricao} onChange={(event) => onChange('descricao', event.target.value)} placeholder="Descrição" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
        <input value={form.valor} onChange={(event) => onChange('valor', event.target.value)} placeholder="Valor" inputMode="decimal" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />

        <select value={form.categoria} onChange={(event) => onChange('categoria', event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>

        <input value={form.pessoa} onChange={(event) => onChange('pessoa', event.target.value)} placeholder={mode === 'pagar' || mode === 'materiais' ? 'Fornecedor' : 'Cliente/fornecedor'} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />

        <div className="grid gap-3 sm:grid-cols-2">
          <input type="date" value={form.data} onChange={(event) => onChange('data', event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
          <input type="date" value={form.vencimento} onChange={(event) => onChange('vencimento', event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select value={form.status} onChange={(event) => onChange('status', event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none">
            {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <select value={form.formaPagamento} onChange={(event) => onChange('formaPagamento', event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none">
            {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </div>

        {mode === 'notas' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.notaNumero} onChange={(event) => onChange('notaNumero', event.target.value)} placeholder="Número da nota" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
              <input value={form.notaSerie} onChange={(event) => onChange('notaSerie', event.target.value)} placeholder="Série" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
            </div>
            <input value={form.notaDocumento} onChange={(event) => onChange('notaDocumento', event.target.value)} placeholder="URL do XML/PDF, se já estiver anexado" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
          </>
        ) : null}

        <textarea value={form.observacoes} onChange={(event) => onChange('observacoes', event.target.value)} placeholder="Observações" rows={3} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={saving || !company} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" onClick={onCancel} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c]">Cancelar</button>
        </div>
      </div>
    </form>
  )
}
