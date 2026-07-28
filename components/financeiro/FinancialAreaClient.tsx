'use client'

// ORCALY_FINANCEIRO_ORGANIZADO_V3

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { resolvePanelStorageUrl, uploadPanelFile } from '@/lib/panel-storage'

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

type MetricData = {
  label: string
  value: number
  format: 'money' | 'count'
  hint: string
  tone: 'blue' | 'green' | 'red' | 'amber' | 'violet'
  icon: string
}

const modeContent: Record<FinanceMode, {
  title: string
  description: string
  icon: string
  primaryAction: string
  secondaryAction?: string
  emptyTitle: string
  emptyDescription: string
}> = {
  overview: {
    title: 'Financeiro',
    description: 'Visão consolidada do caixa, contas e documentos.',
    icon: '💰',
    primaryAction: 'Nova entrada',
    secondaryAction: 'Nova saída',
    emptyTitle: 'Nenhum lançamento no período.',
    emptyDescription: 'Registre uma entrada ou saída para iniciar o controle financeiro.',
  },
  lancamentos: {
    title: 'Entradas e saídas',
    description: 'Movimentações registradas no caixa da empresa.',
    icon: '↕️',
    primaryAction: 'Nova entrada',
    secondaryAction: 'Nova saída',
    emptyTitle: 'Nenhum lançamento encontrado.',
    emptyDescription: 'Registre entradas e saídas para acompanhar o movimento do caixa.',
  },
  receber: {
    title: 'Contas a receber',
    description: 'Valores pendentes, vencimentos e recebimentos.',
    icon: '📥',
    primaryAction: 'Nova conta a receber',
    emptyTitle: 'Nenhuma conta a receber.',
    emptyDescription: 'Cadastre um valor que ainda precisa entrar no caixa.',
  },
  pagar: {
    title: 'Contas a pagar',
    description: 'Despesas futuras, vencidas e já pagas.',
    icon: '📤',
    primaryAction: 'Nova conta a pagar',
    emptyTitle: 'Nenhuma conta a pagar.',
    emptyDescription: 'Cadastre despesas e compromissos para evitar vencimentos esquecidos.',
  },
  materiais: {
    title: 'Materiais e custos',
    description: 'Insumos, peças, produção e custos operacionais.',
    icon: '📦',
    primaryAction: 'Novo custo',
    secondaryAction: 'Nova compra',
    emptyTitle: 'Nenhum material ou custo.',
    emptyDescription: 'Registre materiais e custos para acompanhar a margem da operação.',
  },
  notas: {
    title: 'Notas fiscais',
    description: 'Notas, XML, PDF e documentos vinculados.',
    icon: '🧾',
    primaryAction: 'Cadastrar nota',
    emptyTitle: 'Nenhuma nota fiscal.',
    emptyDescription: 'Cadastre uma nota e anexe XML ou PDF para manter os documentos organizados.',
  },
}

const financeNavigation: Array<{ mode: FinanceMode; href: string; label: string; icon: string }> = [
  { mode: 'overview', href: '/painel/financeiro', label: 'Visão geral', icon: '▦' },
  { mode: 'lancamentos', href: '/painel/financeiro/lancamentos', label: 'Entradas e saídas', icon: '↕' },
  { mode: 'receber', href: '/painel/financeiro/contas-a-receber', label: 'A receber', icon: '↓' },
  { mode: 'pagar', href: '/painel/financeiro/contas-a-pagar', label: 'A pagar', icon: '↑' },
  { mode: 'materiais', href: '/painel/financeiro/materiais', label: 'Materiais', icon: '□' },
  { mode: 'notas', href: '/painel/notas-fiscais', label: 'Notas fiscais', icon: '≡' },
]

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
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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
  if (status === 'pago' || status === 'recebido') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'vencido') return 'bg-red-50 text-red-700 ring-red-100'
  if (status === 'cancelado') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-amber-50 text-amber-700 ring-amber-100'
}

function kindLabel(kind: FinancialItem['kind']) {
  if (kind === 'entrada') return 'Entrada'
  if (kind === 'saida') return 'Saída'
  if (kind === 'receber') return 'A receber'
  if (kind === 'pagar') return 'A pagar'
  if (kind === 'material') return 'Material'
  return 'Nota fiscal'
}

function kindClass(kind: FinancialItem['kind']) {
  if (kind === 'entrada' || kind === 'receber') return 'bg-emerald-50 text-emerald-700'
  if (kind === 'nota') return 'bg-violet-50 text-violet-700'
  if (kind === 'material') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function normalizeType(row: DbRow): FinancialItem['kind'] {
  const raw = asString(row.type || row.tipo).toLowerCase()
  const category = asString(row.category || row.categoria).toLowerCase()
  const origin = asString(row.origem).toLowerCase()
  const hasInvoice = Boolean(row.nota_numero || row.nota_chave || row.invoice_id || row.xml_url || row.pdf_url || row.documento_url)

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
  const id = asString(row.id, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
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
    id: asString(row.id, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
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

  return {
    tipo: type,
    categoria: isPayable
      ? 'Conta a pagar'
      : isReceivable
        ? 'Conta a receber'
        : isMaterial
          ? 'Material'
          : isInvoice
            ? 'Nota fiscal'
            : type === 'entrada'
              ? 'Venda'
              : 'Fornecedor',
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

function MetricCard({ metric }: { metric: MetricData }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  }[metric.tone]

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">{metric.label}</p>
          <p className={`mt-2 truncate text-3xl font-black tracking-[-0.05em] ${metric.value < 0 ? 'text-red-700' : 'text-[#10213d]'}`}>
            {metric.format === 'money' ? money(metric.value) : metric.value}
          </p>
          <p className="mt-2 text-xs font-bold text-slate-400">{metric.hint}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-black ${toneClass}`}>
          {metric.icon}
        </span>
      </div>
    </article>
  )
}

function CashFlowSummary({ income, expense, receivable, payable }: { income: number; expense: number; receivable: number; payable: number }) {
  const max = Math.max(income, expense, receivable, payable, 1)
  const rows = [
    { label: 'Entradas', value: income, className: 'bg-emerald-500' },
    { label: 'Saídas', value: expense, className: 'bg-red-500' },
    { label: 'A receber', value: receivable, className: 'bg-blue-500' },
    { label: 'A pagar', value: payable, className: 'bg-amber-500' },
  ]

  return (
    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Fluxo do mês</p>
          <h2 className="mt-1 text-xl font-black text-[#10213d]">Resumo financeiro</h2>
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">R$</span>
      </div>

      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-500">{row.label}</span>
              <strong className="text-[#10213d]">{money(row.value)}</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${row.className}`} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
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
  const [documentFile, setDocumentFile] = useState<File | null>(null)

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
    setDocumentFile(null)
    setShowForm(false)
    setQuery('')
    setStatusFilter('todos')
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
    const income = valid
      .filter((item) => item.kind === 'entrada' || item.kind === 'receber')
      .reduce((sum, item) => sum + item.amount, 0)
    const expense = valid
      .filter((item) => item.kind === 'saida' || item.kind === 'pagar' || item.kind === 'material' || item.kind === 'nota')
      .reduce((sum, item) => sum + item.amount, 0)
    const receivable = valid
      .filter((item) => item.kind === 'receber' && item.status !== 'recebido' && item.status !== 'pago')
      .reduce((sum, item) => sum + item.amount, 0)
    const payable = valid
      .filter((item) => (item.kind === 'pagar' || item.kind === 'material') && item.status !== 'pago')
      .reduce((sum, item) => sum + item.amount, 0)
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

  const metrics = useMemo<MetricData[]>(() => {
    if (mode === 'receber') {
      return [
        { label: 'Total a receber', value: overview.receivable, format: 'money', hint: 'Valores ainda pendentes', tone: 'blue', icon: '↓' },
        { label: 'Vencem hoje', value: overview.dueToday, format: 'count', hint: 'Contas com vencimento hoje', tone: 'amber', icon: '!' },
        { label: 'Vencidas', value: overview.overdue, format: 'count', hint: 'Pendências atrasadas', tone: 'red', icon: '×' },
        { label: 'Entradas do mês', value: overview.income, format: 'money', hint: 'Receitas e recebíveis', tone: 'green', icon: '+' },
      ]
    }

    if (mode === 'pagar') {
      return [
        { label: 'Total a pagar', value: overview.payable, format: 'money', hint: 'Despesas ainda pendentes', tone: 'red', icon: '↑' },
        { label: 'Vencem hoje', value: overview.dueToday, format: 'count', hint: 'Contas com vencimento hoje', tone: 'amber', icon: '!' },
        { label: 'Vencidas', value: overview.overdue, format: 'count', hint: 'Pendências atrasadas', tone: 'red', icon: '×' },
        { label: 'Saídas do mês', value: overview.expense, format: 'money', hint: 'Despesas e custos', tone: 'violet', icon: '−' },
      ]
    }

    if (mode === 'materiais') {
      return [
        { label: 'Custo do mês', value: overview.materialCost, format: 'money', hint: 'Materiais e produção', tone: 'red', icon: 'R$' },
        { label: 'Registros', value: materialItems.length, format: 'count', hint: 'Itens localizados', tone: 'blue', icon: '#' },
        { label: 'A pagar', value: overview.payable, format: 'money', hint: 'Custos pendentes', tone: 'amber', icon: '↑' },
        { label: 'Saldo previsto', value: overview.predictedBalance, format: 'money', hint: 'Resultado projetado', tone: overview.predictedBalance >= 0 ? 'green' : 'red', icon: '=' },
      ]
    }

    if (mode === 'notas') {
      return [
        { label: 'Notas cadastradas', value: filteredItems.length, format: 'count', hint: 'Documentos no período', tone: 'blue', icon: '#' },
        { label: 'Pendentes', value: filteredItems.filter((item) => item.status === 'pendente').length, format: 'count', hint: 'Aguardando organização', tone: 'amber', icon: '!' },
        { label: 'Valor total', value: filteredItems.reduce((sum, item) => sum + item.amount, 0), format: 'money', hint: 'Somatório das notas', tone: 'violet', icon: 'R$' },
        { label: 'Com documento', value: filteredItems.filter((item) => Boolean(item.documentUrl)).length, format: 'count', hint: 'XML ou PDF anexado', tone: 'green', icon: '✓' },
      ]
    }

    return [
      { label: 'Entradas', value: overview.income, format: 'money', hint: 'Receitas no período', tone: 'green', icon: '+' },
      { label: 'Saídas', value: overview.expense, format: 'money', hint: 'Despesas no período', tone: 'red', icon: '−' },
      { label: 'Resultado', value: overview.profit, format: 'money', hint: 'Entradas menos saídas', tone: overview.profit >= 0 ? 'blue' : 'red', icon: '=' },
      { label: 'Saldo previsto', value: overview.predictedBalance, format: 'money', hint: 'Inclui contas pendentes', tone: overview.predictedBalance >= 0 ? 'violet' : 'red', icon: '↗' },
    ]
  }, [filteredItems, materialItems.length, mode, overview])

  function openCreate(type?: 'entrada' | 'saida') {
    setForm(defaultForm(mode, type))
    setDocumentFile(null)
    setShowForm(true)
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

      let documentValue = form.notaDocumento.trim() || null
      let documentName = documentValue ? 'Documento fiscal' : null

      if (mode === 'notas' && documentFile) {
        const upload = await uploadPanelFile({
          companyId: company.id,
          file: documentFile,
          purpose: 'finance-document',
        })

        documentValue = upload.reference || upload.url
        documentName = upload.file.name
      }

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
        payload.documento_url = documentValue
        payload.documento_nome = documentName
      }

      const { error: insertError } = await supabase.from('financial_transactions').insert(payload)
      if (insertError) throw insertError

      setMessage('Registro financeiro salvo.')
      setShowForm(false)
      setForm(defaultForm(mode))
      setDocumentFile(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro financeiro.')
    }

    setSaving(false)
  }

  async function updateStatus(id: string, nextStatus: string) {
    if (!company) return

    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('financial_transactions')
      .update({ status: nextStatus })
      .eq('id', id)
      .eq('company_id', company.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(nextStatus === 'cancelado' ? 'Registro cancelado.' : 'Status atualizado.')
    await loadData()
  }

  async function openDocument(item: FinancialItem) {
    setError('')

    try {
      const url = await resolvePanelStorageUrl(item.documentUrl, 300)
      if (!url) throw new Error('Documento não encontrado.')

      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o documento.')
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f6f7f9] px-4">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-10 py-8 text-center shadow-sm">
          <span className="text-3xl">💰</span>
          <p className="mt-3 font-black text-[#10213d]">Carregando financeiro...</p>
        </div>
      </main>
    )
  }

  if (error && !company) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f6f7f9] px-4">
        <div className="max-w-lg rounded-[1.6rem] border border-red-100 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl font-black text-[#10213d]">Financeiro indisponível</p>
          <p className="mt-3 font-bold text-red-600">{error}</p>
          <Link href="/painel/inicio" className="mt-6 inline-flex rounded-xl bg-[#05245c] px-5 py-3 font-black text-white">
            Voltar ao painel
          </Link>
        </div>
      </main>
    )
  }

  const displayItems = mode === 'overview' ? monthItems.slice(0, 8) : filteredItems

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-[#10213d] sm:px-6">
      <section className="mx-auto max-w-[1440px] space-y-5">
        <header className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-2xl text-white">
                {content.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {company?.nome || 'Sua empresa'}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{content.title}</h1>
                <p className="mt-1 text-sm font-bold text-slate-500">{content.description}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Período</span>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="min-w-0 bg-transparent text-sm font-black text-[#10213d] outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => openCreate(mode === 'lancamentos' || mode === 'overview' ? 'entrada' : undefined)}
                className="rounded-xl bg-[#05245c] px-5 py-3 text-sm font-black text-white transition hover:bg-[#031a43]"
              >
                {content.primaryAction}
              </button>

              {content.secondaryAction ? (
                <button
                  type="button"
                  onClick={() => openCreate('saida')}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#10213d] transition hover:bg-slate-50"
                >
                  {content.secondaryAction}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {message ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

        <nav className="flex gap-2 overflow-x-auto rounded-[1.4rem] border border-slate-200 bg-white p-2 shadow-sm">
          {financeNavigation.map((item) => {
            const active = item.mode === mode
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                  active
                    ? 'bg-[#05245c] text-white shadow-md shadow-blue-950/15'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-[#10213d]'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]">
          <article className="min-w-0 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  {mode === 'overview' ? 'Movimentações' : content.title}
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-[#10213d]">
                  {mode === 'overview' ? 'Últimos lançamentos' : 'Registros'}
                </h2>
              </div>

              {mode !== 'overview' ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_230px_auto]">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white"
                  >
                    <option value="todos">Todos os status</option>
                    {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar descrição, pessoa..."
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-300 focus:bg-white"
                  />
                  {(query || statusFilter !== 'todos') ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('')
                        setStatusFilter('todos')
                      }}
                      className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>
              ) : (
                <Link href="/painel/financeiro/lancamentos" className="text-sm font-black text-[#05245c] hover:underline">
                  Ver todos
                </Link>
              )}
            </div>

            {mode === 'materiais' ? (
              <MaterialList items={materialItems} />
            ) : (
              <FinancialList
                items={displayItems}
                mode={mode}
                onUpdateStatus={updateStatus}
                onOpenDocument={openDocument}
              />
            )}

            {(mode === 'materiais' ? materialItems.length === 0 : displayItems.length === 0) ? (
              <EmptyState
                title={content.emptyTitle}
                description={content.emptyDescription}
                action={content.primaryAction}
                onClick={() => openCreate()}
              />
            ) : null}
          </article>

          <aside className="grid content-start gap-5">
            {showForm ? (
              <FinancialForm
                mode={mode}
                form={form}
                saving={saving}
                company={company}
                documentFile={documentFile}
                onDocumentFileChange={setDocumentFile}
                onChange={updateForm}
                onSubmit={saveFinancialItem}
                onCancel={() => {
                  setShowForm(false)
                  setDocumentFile(null)
                }}
              />
            ) : (
              <>
                <CashFlowSummary
                  income={overview.income}
                  expense={overview.expense}
                  receivable={overview.receivable}
                  payable={overview.payable}
                />

                <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Acesso rápido</p>
                  <div className="mt-4 grid gap-2">
                    {financeNavigation.filter((item) => item.mode !== mode).slice(0, 5).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-black text-[#10213d] transition hover:bg-blue-50 hover:text-[#05245c]"
                      >
                        <span className="flex items-center gap-2"><span>{item.icon}</span>{item.label}</span>
                        <span aria-hidden="true">›</span>
                      </Link>
                    ))}
                  </div>
                </article>

                {mode === 'materiais' ? (
                  <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Categorias sugeridas</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {segmentMaterialHints(company?.business_type || company?.site_template).map((hint) => (
                        <span key={hint} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">{hint}</span>
                      ))}
                    </div>
                  </article>
                ) : null}
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  )
}

function EmptyState({
  title,
  description,
  action,
  onClick,
}: {
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="mt-5 grid min-h-52 place-items-center rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div>
        <span className="text-3xl">💳</span>
        <p className="mt-3 text-xl font-black text-[#10213d]">{title}</p>
        <p className="mx-auto mt-2 max-w-lg text-sm font-bold leading-6 text-slate-400">{description}</p>
        <button type="button" onClick={onClick} className="mt-5 rounded-xl bg-[#05245c] px-5 py-3 text-sm font-black text-white">
          {action}
        </button>
      </div>
    </div>
  )
}

function FinancialList({
  items,
  mode,
  onUpdateStatus,
  onOpenDocument,
}: {
  items: FinancialItem[]
  mode: FinanceMode
  onUpdateStatus: (id: string, nextStatus: string) => Promise<void>
  onOpenDocument: (item: FinancialItem) => Promise<void>
}) {
  if (items.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200">
      <div className="hidden grid-cols-[minmax(220px,1.5fr)_120px_130px_130px_170px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 lg:grid">
        <span>Descrição</span>
        <span>Data</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Ações</span>
      </div>

      <div className="divide-y divide-slate-100 bg-white">
        {items.map((item) => (
          <div key={item.id} className="grid gap-4 px-4 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.5fr)_120px_130px_130px_170px] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${kindClass(item.kind)}`}>
                  {kindLabel(item.kind)}
                </span>
                {mode === 'notas' && item.invoiceNumber ? (
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">
                    NF {item.invoiceNumber}{item.invoiceSeries ? `/${item.invoiceSeries}` : ''}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 truncate font-black text-[#10213d]">{item.description}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-400">
                {item.partner} · {item.category} · {item.paymentMethod}
              </p>
            </div>

            <div className="text-sm font-bold text-slate-500">
              <p>{formatDate(item.dueDate || item.competenceDate)}</p>
              <p className="mt-1 text-xs text-slate-400">{item.dueDate ? 'Vencimento' : 'Competência'}</p>
            </div>

            <p className={`text-base font-black ${item.kind === 'entrada' || item.kind === 'receber' ? 'text-emerald-700' : 'text-red-700'}`}>
              {money(item.amount)}
            </p>

            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(item.status)}`}>
              {statusLabel(item.status)}
            </span>

            <div className="flex flex-wrap gap-2">
              {item.documentUrl ? (
                <button
                  type="button"
                  onClick={() => void onOpenDocument(item)}
                  className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                >
                  Documento
                </button>
              ) : null}

              {item.status !== 'pago' && item.status !== 'recebido' && item.status !== 'cancelado' ? (
                <button
                  type="button"
                  onClick={() => void onUpdateStatus(item.id, item.kind === 'receber' ? 'recebido' : 'pago')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                >
                  {item.kind === 'receber' ? 'Receber' : 'Pagar'}
                </button>
              ) : null}

              {item.status !== 'cancelado' ? (
                <button
                  type="button"
                  onClick={() => void onUpdateStatus(item.id, 'cancelado')}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                >
                  Cancelar
                </button>
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
    <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200">
      <div className="hidden grid-cols-[minmax(220px,1.5fr)_130px_130px_130px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-400 lg:grid">
        <span>Material ou custo</span>
        <span>Data</span>
        <span>Valor</span>
        <span>Status</span>
      </div>

      <div className="divide-y divide-slate-100 bg-white">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.5fr)_130px_130px_130px] lg:items-center">
            <div className="min-w-0">
              <p className="truncate font-black text-[#10213d]">{item.description}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-400">{item.category} · {item.supplier}</p>
            </div>
            <p className="text-sm font-bold text-slate-500">{formatDate(item.date)}</p>
            <p className="font-black text-red-700">{money(item.amount)}</p>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(item.status)}`}>
              {statusLabel(item.status)}
            </span>
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
  documentFile,
  onDocumentFileChange,
  onChange,
  onSubmit,
  onCancel,
}: {
  mode: FinanceMode
  form: FormState
  saving: boolean
  company: Company | null
  documentFile: File | null
  onDocumentFileChange: (file: File | null) => void
  onChange: (field: keyof FormState, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const categories = categoryByMode[mode]
  const showTypeToggle = mode === 'overview' || mode === 'lancamentos'

  return (
    <form onSubmit={onSubmit} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Novo registro</p>
          <h2 className="mt-1 text-xl font-black text-[#10213d]">{modeContent[mode].title}</h2>
        </div>
        <button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-lg font-black text-slate-500" aria-label="Fechar formulário">
          ×
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {showTypeToggle ? (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => onChange('tipo', 'entrada')}
              className={`rounded-lg px-4 py-3 text-sm font-black transition ${form.tipo === 'entrada' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => onChange('tipo', 'saida')}
              className={`rounded-lg px-4 py-3 text-sm font-black transition ${form.tipo === 'saida' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500'}`}
            >
              Saída
            </button>
          </div>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Descrição</span>
          <input
            value={form.descricao}
            onChange={(event) => onChange('descricao', event.target.value)}
            placeholder="Ex.: Venda, fornecedor ou serviço"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Valor</span>
            <input
              value={form.valor}
              onChange={(event) => onChange('valor', event.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Categoria</span>
            <select
              value={form.categoria}
              onChange={(event) => onChange('categoria', event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            >
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            {mode === 'pagar' || mode === 'materiais' ? 'Fornecedor' : 'Cliente ou fornecedor'}
          </span>
          <input
            value={form.pessoa}
            onChange={(event) => onChange('pessoa', event.target.value)}
            placeholder="Nome relacionado ao registro"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Competência</span>
            <input
              type="date"
              value={form.data}
              onChange={(event) => onChange('data', event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Vencimento</span>
            <input
              type="date"
              value={form.vencimento}
              onChange={(event) => onChange('vencimento', event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Status</span>
            <select
              value={form.status}
              onChange={(event) => onChange('status', event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            >
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Pagamento</span>
            <select
              value={form.formaPagamento}
              onChange={(event) => onChange('formaPagamento', event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
            >
              {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
        </div>

        {mode === 'notas' ? (
          <div className="grid gap-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-violet-500">Número da nota</span>
                <input
                  value={form.notaNumero}
                  onChange={(event) => onChange('notaNumero', event.target.value)}
                  className="rounded-xl border border-violet-100 bg-white px-4 py-3 font-bold outline-none"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-violet-500">Série</span>
                <input
                  value={form.notaSerie}
                  onChange={(event) => onChange('notaSerie', event.target.value)}
                  className="rounded-xl border border-violet-100 bg-white px-4 py-3 font-bold outline-none"
                />
              </label>
            </div>

            <label className="grid cursor-pointer gap-2 rounded-xl border border-dashed border-violet-200 bg-white px-4 py-4 text-sm font-black text-violet-700">
              <span>{documentFile ? documentFile.name : 'Selecionar XML ou PDF'}</span>
              <span className="text-xs font-bold text-slate-400">Arquivo privado com link temporário.</span>
              <input
                type="file"
                accept=".pdf,.xml,application/pdf,application/xml,text/xml"
                onChange={(event) => onDocumentFileChange(event.target.files?.[0] || null)}
                className="hidden"
                disabled={saving}
              />
            </label>

            <input
              value={form.notaDocumento}
              onChange={(event) => onChange('notaDocumento', event.target.value)}
              placeholder="Ou informe uma URL existente"
              className="rounded-xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold outline-none"
            />
          </div>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Observações</span>
          <textarea
            value={form.observacoes}
            onChange={(event) => onChange('observacoes', event.target.value)}
            placeholder="Informações adicionais"
            rows={3}
            className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-blue-300 focus:bg-white"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <button
            type="submit"
            disabled={saving || !company}
            className="rounded-xl bg-[#05245c] px-5 py-3.5 font-black text-white disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar registro'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-black text-[#10213d]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  )
}
