'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Transaction = any
type MaterialEntry = any
type FinanceAccount = any

const entradaCategorias = ['Venda', 'Serviço', 'Recebimento de proposta', 'Adiantamento', 'Reembolso', 'Outras entradas']
const saidaCategorias = ['Material', 'Fornecedor', 'Funcionário', 'Imposto', 'Entrega/Frete', 'Aluguel', 'Energia/Internet', 'Equipamento', 'Marketing', 'Manutenção', 'Outras despesas']
const formas = ['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência', 'Mercado Pago', 'Outro']
const centros = ['Geral', 'Produção', 'Comercial', 'Administrativo', 'Marketing', 'Entrega', 'Estoque']

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataHoje() {
  return new Date().toISOString().slice(0, 10)
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

function numero(valor: any) {
  return Number(String(valor || 0).replace(',', '.')) || 0
}

function limparCodigo(valor: string) {
  return String(valor || '').replace(/\D/g, '')
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleDateString('pt-BR')
}

function textoTag(xml: Document, tag: string) {
  return xml.getElementsByTagName(tag)?.[0]?.textContent || ''
}

function textoTagDentro(element: Element, tag: string) {
  return element.getElementsByTagName(tag)?.[0]?.textContent || ''
}

function statusBadge(status: string) {
  if (status === 'pago') return 'bg-emerald-100 text-emerald-700'
  if (status === 'pendente') return 'bg-yellow-100 text-yellow-700'
  return 'bg-slate-200 text-slate-600'
}

function tipoBadge(tipo: string) {
  return tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
}

function vencido(item: Transaction) {
  if (item.status !== 'pendente' || !item.vencimento) return false
  const hoje = new Date(dataHoje()).getTime()
  return new Date(item.vencimento).getTime() < hoje
}

export default function FinanceiroPage() {
  const [company, setCompany] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [materials, setMaterials] = useState<MaterialEntry[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tab, setTab] = useState('visao')
  const [mes, setMes] = useState(mesAtual())
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [barcodeSupported, setBarcodeSupported] = useState(false)

  const fileRef = useRef<HTMLInputElement | null>(null)
  const barcodeFileRef = useRef<HTMLInputElement | null>(null)

  const [accountDraft, setAccountDraft] = useState({ nome: '', tipo: 'caixa', saldo_inicial: '' })

  const [form, setForm] = useState({
    tipo: 'saida',
    categoria: 'Material',
    descricao: '',
    valor: '',
    data_competencia: dataHoje(),
    vencimento: '',
    status: 'pago',
    forma_pagamento: 'PIX',
    fornecedor_cliente: '',
    centro_custo: 'Geral',
    observacoes: '',
    account_id: '',
    codigo_barras: '',
    nota_chave: '',
    nota_numero: '',
    nota_serie: '',
    nota_emitente: '',
    nota_cnpj_emitente: '',
    nota_data_emissao: '',
    documento_url: '',
    documento_nome: '',
    documento_tipo: '',
    origem: 'manual',
    recorrente: false,
    parcelas_total: '1',
  })

  const [materialDrafts, setMaterialDrafts] = useState([
    { nome: '', quantidade: '1', unidade: 'un', valor_unitario: '', codigo: '', categoria: 'Material' },
  ])

  async function carregarEmpresa(userId: string) {
    const { data: ownCompany, error: ownError } = await supabase
      .from('companies')
      .select('id,nome,slug,subdomain_slug')
      .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
      .maybeSingle()

    if (ownError) throw ownError
    if (ownCompany) return ownCompany

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id,cargo')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (memberError) throw memberError
    if (!member?.company_id) return null
    if (member.cargo !== 'gerente') throw new Error('Apenas dono ou gerente pode acessar o financeiro.')

    const { data: memberCompany, error: companyError } = await supabase
      .from('companies')
      .select('id,nome,slug,subdomain_slug')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError
    return memberCompany
  }

  async function carregar() {
    setLoading(true)
    setErro('')

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

      const inicio = `${mes}-01`
      const fim = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).toISOString().slice(0, 10)

      const [txRes, matRes, accountRes] = await Promise.all([
        supabase
          .from('financial_transactions')
          .select('*, finance_accounts(nome,tipo)')
          .eq('company_id', empresa.id)
          .gte('data_competencia', inicio)
          .lte('data_competencia', fim)
          .order('data_competencia', { ascending: false }),
        supabase
          .from('financial_material_entries')
          .select('*')
          .eq('company_id', empresa.id)
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('finance_accounts')
          .select('*')
          .eq('company_id', empresa.id)
          .eq('ativo', true)
          .order('created_at', { ascending: true }),
      ])

      if (txRes.error) throw txRes.error
      if (matRes.error) throw matRes.error
      if (accountRes.error) throw accountRes.error

      setTransactions(txRes.data || [])
      setMaterials(matRes.data || [])
      setAccounts(accountRes.data || [])

      if (!form.account_id && accountRes.data?.[0]?.id) {
        setForm((v) => ({ ...v, account_id: accountRes.data[0].id }))
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar financeiro.')
    }

    setLoading(false)
  }

  useEffect(() => {
    setBarcodeSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window)
    carregar()
  }, [mes])

  function update(campo: string, valor: any) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const filtradas = useMemo(() => {
    let lista = [...transactions]

    if (filtroTipo !== 'todos') lista = lista.filter((item) => item.tipo === filtroTipo)
    if (filtroStatus !== 'todos') lista = lista.filter((item) => item.status === filtroStatus)

    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter((item) =>
        String(item.descricao || '').toLowerCase().includes(q) ||
        String(item.fornecedor_cliente || '').toLowerCase().includes(q) ||
        String(item.categoria || '').toLowerCase().includes(q) ||
        String(item.codigo_barras || '').includes(q) ||
        String(item.nota_chave || '').includes(q)
      )
    }

    return lista
  }, [transactions, filtroTipo, filtroStatus, busca])

  const resumo = useMemo(() => {
    const validas = transactions.filter((t) => t.status !== 'cancelado')
    const entradas = validas.filter((t) => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor || 0), 0)
    const saidas = validas.filter((t) => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor || 0), 0)
    const pendentes = transactions.filter((t) => t.status === 'pendente').reduce((acc, t) => acc + Number(t.valor || 0), 0)
    const atrasados = transactions.filter((t) => vencido(t)).reduce((acc, t) => acc + Number(t.valor || 0), 0)
    const saldo = entradas - saidas
    const margem = entradas > 0 ? (saldo / entradas) * 100 : 0

    return { entradas, saidas, saldo, pendentes, atrasados, margem }
  }, [transactions])

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>()

    transactions
      .filter((t) => t.status !== 'cancelado')
      .forEach((t) => map.set(t.categoria, (map.get(t.categoria) || 0) + Number(t.valor || 0)))

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [transactions])

  const contasResumo = useMemo(() => {
    return accounts.map((account) => {
      const lista = transactions.filter((t) => t.account_id === account.id && t.status !== 'cancelado')
      const entradas = lista.filter((t) => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor || 0), 0)
      const saidas = lista.filter((t) => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor || 0), 0)

      return {
        ...account,
        saldoAtual: Number(account.saldo_inicial || 0) + entradas - saidas,
      }
    })
  }, [accounts, transactions])

  const proximosVencimentos = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'pendente' && t.vencimento)
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .slice(0, 8)
  }, [transactions])

  async function uploadDocumento(file: File) {
    if (!company) throw new Error('Empresa não encontrada.')

    const ext = file.name.split('.').pop() || 'arquivo'
    const path = `${company.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage.from('financeiro').upload(path, file, { upsert: false })
    if (error) throw error

    const { data } = supabase.storage.from('financeiro').getPublicUrl(path)

    update('documento_url', data.publicUrl)
    update('documento_nome', file.name)
    update('documento_tipo', file.type || ext)

    return data.publicUrl
  }

  async function lerXmlNota(file: File) {
    const texto = await file.text()
    const parser = new DOMParser()
    const xml = parser.parseFromString(texto, 'application/xml')

    const numeroNota = textoTag(xml, 'nNF')
    const serie = textoTag(xml, 'serie')
    const valorNota = textoTag(xml, 'vNF')
    const emitente = textoTag(xml, 'xNome')
    const cnpj = textoTag(xml, 'CNPJ')
    const dataEmissao = textoTag(xml, 'dhEmi') || textoTag(xml, 'dEmi')
    const chaveNode = xml.getElementsByTagName('infNFe')?.[0]
    const chave = chaveNode?.getAttribute('Id')?.replace('NFe', '') || ''

    const itens = Array.from(xml.getElementsByTagName('det')).map((det) => {
      const prod = det.getElementsByTagName('prod')?.[0]
      const nome = prod ? textoTagDentro(prod, 'xProd') : 'Material'
      const quantidade = prod ? textoTagDentro(prod, 'qCom') : '1'
      const unidade = prod ? textoTagDentro(prod, 'uCom') : 'un'
      const valorUnitario = prod ? textoTagDentro(prod, 'vUnCom') : '0'
      const codigo = prod ? textoTagDentro(prod, 'cProd') : ''

      return {
        nome,
        quantidade: String(numero(quantidade) || 1),
        unidade: unidade || 'un',
        valor_unitario: String(numero(valorUnitario)),
        codigo,
        categoria: 'Material',
      }
    })

    setForm((atual) => ({
      ...atual,
      tipo: 'saida',
      categoria: 'Material',
      descricao: numeroNota ? `Nota fiscal ${numeroNota}` : 'Compra por nota fiscal',
      valor: String(numero(valorNota)),
      fornecedor_cliente: emitente,
      nota_numero: numeroNota,
      nota_serie: serie,
      nota_emitente: emitente,
      nota_cnpj_emitente: cnpj,
      nota_data_emissao: dataEmissao ? dataEmissao.slice(0, 10) : '',
      data_competencia: dataEmissao ? dataEmissao.slice(0, 10) : atual.data_competencia,
      nota_chave: chave,
      origem: 'nota_fiscal',
    }))

    if (itens.length > 0) setMaterialDrafts(itens)
    setMensagem('XML lido. Revise e salve.')
  }

  async function handleDocumento(file: File | null) {
    if (!file) return
    setErro('')
    setMensagem('')

    try {
      await uploadDocumento(file)
      const isXml = file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')

      if (isXml) await lerXmlNota(file)
      else setMensagem('Arquivo anexado. Para preenchimento automático, envie o XML da NF-e.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao ler documento.')
    }
  }

  async function lerCodigoDeBarras(file: File | null) {
    if (!file) return
    setErro('')
    setMensagem('')

    try {
      const detectorClass = (window as any).BarcodeDetector
      if (!detectorClass) {
        setErro('Este navegador não suporta leitura automática. Digite o código manualmente.')
        return
      }

      const detector = new detectorClass({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'itf', 'upc_a', 'upc_e'] })
      const bitmap = await createImageBitmap(file)
      const codes = await detector.detect(bitmap)

      if (!codes || codes.length === 0) {
        setErro('Não encontrei código de barras na imagem.')
        return
      }

      update('codigo_barras', codes[0].rawValue || '')
      setMensagem('Código lido.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao ler código.')
    }
  }

  function addMaterialLine() {
    setMaterialDrafts((atual) => [...atual, { nome: '', quantidade: '1', unidade: 'un', valor_unitario: '', codigo: '', categoria: 'Material' }])
  }

  function updateMaterial(index: number, campo: string, valor: string) {
    setMaterialDrafts((atual) => atual.map((item, i) => i === index ? { ...item, [campo]: valor } : item))
  }

  function removeMaterial(index: number) {
    setMaterialDrafts((atual) => atual.filter((_, i) => i !== index))
  }

  async function salvarConta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company || !accountDraft.nome.trim()) return

    const { error } = await supabase.from('finance_accounts').insert({
      company_id: company.id,
      nome: accountDraft.nome.trim(),
      tipo: accountDraft.tipo,
      saldo_inicial: numero(accountDraft.saldo_inicial),
    })

    if (error) {
      setErro(error.message)
      return
    }

    setAccountDraft({ nome: '', tipo: 'caixa', saldo_inicial: '' })
    setMensagem('Conta criada.')
    await carregar()
  }

  async function salvarLancamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company) return

    setSaving(true)
    setErro('')
    setMensagem('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!form.descricao.trim()) throw new Error('Informe a descrição.')
      if (numero(form.valor) <= 0) throw new Error('Informe um valor maior que zero.')

      const totalParcelas = Math.max(1, Number(form.parcelas_total || 1))
      const grupo = totalParcelas > 1 ? crypto.randomUUID() : null
      const inserts: any[] = []

      for (let i = 0; i < totalParcelas; i += 1) {
        const baseDate = new Date(`${form.data_competencia}T12:00:00`)
        baseDate.setMonth(baseDate.getMonth() + i)

        const vencDate = form.vencimento ? new Date(`${form.vencimento}T12:00:00`) : null
        if (vencDate) vencDate.setMonth(vencDate.getMonth() + i)

        inserts.push({
          company_id: company.id,
          tipo: form.tipo,
          categoria: form.categoria,
          descricao: totalParcelas > 1 ? `${form.descricao.trim()} (${i + 1}/${totalParcelas})` : form.descricao.trim(),
          valor: numero(form.valor),
          data_competencia: baseDate.toISOString().slice(0, 10),
          vencimento: vencDate ? vencDate.toISOString().slice(0, 10) : null,
          status: form.status,
          forma_pagamento: form.forma_pagamento,
          fornecedor_cliente: form.fornecedor_cliente,
          centro_custo: form.centro_custo,
          observacoes: form.observacoes,
          account_id: form.account_id || null,
          documento_url: form.documento_url || null,
          documento_nome: form.documento_nome || null,
          documento_tipo: form.documento_tipo || null,
          codigo_barras: form.codigo_barras || null,
          nota_chave: form.nota_chave || null,
          nota_numero: form.nota_numero || null,
          nota_serie: form.nota_serie || null,
          nota_emitente: form.nota_emitente || null,
          nota_cnpj_emitente: form.nota_cnpj_emitente || null,
          nota_data_emissao: form.nota_data_emissao || null,
          origem: form.origem,
          recorrente: totalParcelas > 1 || Boolean(form.recorrente),
          recorrencia_grupo: grupo,
          parcela_atual: totalParcelas > 1 ? i + 1 : null,
          parcelas_total: totalParcelas > 1 ? totalParcelas : null,
          raw_data: { form, materialDrafts },
          created_by: userId,
        })
      }

      const { data: txs, error } = await supabase
        .from('financial_transactions')
        .insert(inserts)
        .select('id')

      if (error) throw error

      const firstTxId = txs?.[0]?.id

      const materiaisValidos = materialDrafts
        .filter((item) => item.nome.trim())
        .map((item) => ({
          company_id: company.id,
          transaction_id: firstTxId,
          nome: item.nome.trim(),
          quantidade: numero(item.quantidade) || 1,
          unidade: item.unidade || 'un',
          valor_unitario: numero(item.valor_unitario),
          valor_total: (numero(item.quantidade) || 1) * numero(item.valor_unitario),
          codigo: item.codigo || null,
          categoria: item.categoria || 'Material',
          fornecedor: form.fornecedor_cliente || null,
        }))

      if (materiaisValidos.length > 0) {
        const { error: materialError } = await supabase.from('financial_material_entries').insert(materiaisValidos)
        if (materialError) throw materialError
      }

      setMensagem(totalParcelas > 1 ? 'Lançamentos parcelados salvos.' : 'Lançamento salvo.')
      limparFormulario()
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar lançamento.')
    }

    setSaving(false)
  }

  function limparFormulario() {
    setForm({
      tipo: 'saida',
      categoria: 'Material',
      descricao: '',
      valor: '',
      data_competencia: dataHoje(),
      vencimento: '',
      status: 'pago',
      forma_pagamento: 'PIX',
      fornecedor_cliente: '',
      centro_custo: 'Geral',
      observacoes: '',
      account_id: accounts[0]?.id || '',
      codigo_barras: '',
      nota_chave: '',
      nota_numero: '',
      nota_serie: '',
      nota_emitente: '',
      nota_cnpj_emitente: '',
      nota_data_emissao: '',
      documento_url: '',
      documento_nome: '',
      documento_tipo: '',
      origem: 'manual',
      recorrente: false,
      parcelas_total: '1',
    })
    setMaterialDrafts([{ nome: '', quantidade: '1', unidade: 'un', valor_unitario: '', codigo: '', categoria: 'Material' }])
  }

  async function marcarPago(id: string) {
    const { error } = await supabase.from('financial_transactions').update({ status: 'pago' }).eq('id', id)
    if (error) setErro(error.message)
    else {
      setMensagem('Marcado como pago.')
      await carregar()
    }
  }

  async function duplicar(item: Transaction) {
    setForm((atual) => ({
      ...atual,
      tipo: item.tipo,
      categoria: item.categoria,
      descricao: `${item.descricao} - cópia`,
      valor: String(item.valor),
      data_competencia: dataHoje(),
      vencimento: '',
      status: 'pendente',
      forma_pagamento: item.forma_pagamento || 'PIX',
      fornecedor_cliente: item.fornecedor_cliente || '',
      centro_custo: item.centro_custo || 'Geral',
      observacoes: item.observacoes || '',
      account_id: item.account_id || accounts[0]?.id || '',
      codigo_barras: item.codigo_barras || '',
      nota_chave: '',
      nota_numero: '',
      origem: 'manual',
      parcelas_total: '1',
    }))
    setTab('novo')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluirLancamento(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('financial_transactions').delete().eq('id', id)
    if (error) setErro(error.message)
    else {
      setMensagem('Lançamento excluído.')
      await carregar()
    }
  }

  function exportarCSV() {
    const linhas = [
      ['Tipo', 'Categoria', 'Descrição', 'Valor', 'Data', 'Vencimento', 'Status', 'Forma', 'Fornecedor/Cliente', 'Centro de custo'],
      ...filtradas.map((t) => [t.tipo, t.categoria, t.descricao, String(t.valor), t.data_competencia, t.vencimento || '', t.status, t.forma_pagamento || '', t.fornecedor_cliente || '', t.centro_custo || '']),
    ]

    const csv = linhas.map((linha) => linha.map((celula) => `"${String(celula).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando financeiro...</div>
      </main>
    )
  }

  if (erro && !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Financeiro indisponível</p>
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
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">Financeiro</h1>
                <p className="mt-2 max-w-2xl font-bold leading-7 text-slate-500">
                  Entradas, despesas, materiais, notas, contas, vencimentos e relatórios.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:min-w-[760px]">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Entradas</p>
                  <p className="mt-1 text-xl font-black text-emerald-700">{moeda(resumo.entradas)}</p>
                </div>
                <div className="rounded-2xl bg-red-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">Saídas</p>
                  <p className="mt-1 text-xl font-black text-red-700">{moeda(resumo.saidas)}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#05245c]">Saldo</p>
                  <p className={`mt-1 text-xl font-black ${resumo.saldo >= 0 ? 'text-[#05245c]' : 'text-red-700'}`}>{moeda(resumo.saldo)}</p>
                </div>
                <div className="rounded-2xl bg-yellow-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-yellow-700">Pendente</p>
                  <p className="mt-1 text-xl font-black text-yellow-700">{moeda(resumo.pendentes)}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Margem</p>
                  <p className={`mt-1 text-xl font-black ${resumo.margem >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{resumo.margem.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {mensagem && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{mensagem}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {[
            ['visao', 'Visão geral'],
            ['novo', 'Novo lançamento'],
            ['lancamentos', 'Lançamentos'],
            ['materiais', 'Materiais'],
            ['contas', 'Contas'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${tab === id ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20' : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'visao' && (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Análise</p>
                  <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Resumo por categoria</h2>
                </div>
                <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
              </div>

              <div className="mt-6 grid gap-3">
                {porCategoria.map(([cat, valor]) => {
                  const total = Math.max(resumo.entradas + resumo.saidas, 1)
                  const percent = Math.min(100, (valor / total) * 100)

                  return (
                    <div key={cat} className="rounded-2xl bg-[#f5f8ff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-[#071b3a]">{cat}</p>
                        <p className="font-black text-[#05245c]">{moeda(valor)}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-[#05245c]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}

                {porCategoria.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                    <p className="font-black text-[#071b3a]">Sem dados neste mês</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">Cadastre entradas e despesas para ver o resumo.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Vencimentos</p>
                <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Próximos</h2>
                <div className="mt-5 grid gap-3">
                  {proximosVencimentos.map((item) => (
                    <div key={item.id} className={`rounded-2xl p-4 ${vencido(item) ? 'bg-red-50' : 'bg-yellow-50'}`}>
                      <p className="font-black text-[#071b3a]">{item.descricao}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{dataBR(item.vencimento)} • {moeda(item.valor)}</p>
                      <button onClick={() => marcarPago(item.id)} className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Marcar pago</button>
                    </div>
                  ))}
                  {proximosVencimentos.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-4 text-sm font-bold text-slate-500">Nenhum vencimento pendente.</p>}
                </div>
              </section>

              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Contas</p>
                <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Saldos</h2>
                <div className="mt-5 grid gap-3">
                  {contasResumo.map((acc) => (
                    <div key={acc.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                      <p className="font-black text-[#071b3a]">{acc.nome}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{acc.tipo}</p>
                      <p className="mt-2 text-xl font-black text-[#05245c]">{moeda(acc.saldoAtual)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {tab === 'novo' && (
          <form onSubmit={salvarLancamento} className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Cadastro</p>
                  <h2 className="mt-2 text-2xl font-black text-[#071b3a]">Novo lançamento</h2>
                </div>
                <div className="flex rounded-2xl bg-[#f5f8ff] p-1">
                  <button type="button" onClick={() => setForm((v) => ({ ...v, tipo: 'entrada', categoria: 'Venda' }))} className={`rounded-xl px-4 py-2 text-sm font-black ${form.tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Entrada</button>
                  <button type="button" onClick={() => setForm((v) => ({ ...v, tipo: 'saida', categoria: 'Material' }))} className={`rounded-xl px-4 py-2 text-sm font-black ${form.tipo === 'saida' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Saída</button>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Categoria</span>
                    <select value={form.categoria} onChange={(e) => update('categoria', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      {(form.tipo === 'entrada' ? entradaCategorias : saidaCategorias).map((cat) => <option key={cat}>{cat}</option>)}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Valor</span>
                    <input value={form.valor} onChange={(e) => update('valor', e.target.value)} placeholder="0,00" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Descrição</span>
                  <input value={form.descricao} onChange={(e) => update('descricao', e.target.value)} placeholder="Ex.: Compra de lona, venda de banner..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Data</span>
                    <input type="date" value={form.data_competencia} onChange={(e) => update('data_competencia', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Vencimento</span>
                    <input type="date" value={form.vencimento} onChange={(e) => update('vencimento', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Status</span>
                    <select value={form.status} onChange={(e) => update('status', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      <option value="pago">Pago</option>
                      <option value="pendente">Pendente</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Forma</span>
                    <select value={form.forma_pagamento} onChange={(e) => update('forma_pagamento', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      {formas.map((forma) => <option key={forma}>{forma}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Conta</span>
                    <select value={form.account_id} onChange={(e) => update('account_id', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      <option value="">Sem conta</option>
                      {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.nome}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Centro de custo</span>
                    <select value={form.centro_custo} onChange={(e) => update('centro_custo', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      {centros.map((centro) => <option key={centro}>{centro}</option>)}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Fornecedor / Cliente</span>
                  <input value={form.fornecedor_cliente} onChange={(e) => update('fornecedor_cliente', e.target.value)} placeholder="Nome do fornecedor ou cliente" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>

                <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Observações</span>
                    <input value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} placeholder="Detalhes internos" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Parcelas</span>
                    <input type="number" min={1} max={60} value={form.parcelas_total} onChange={(e) => update('parcelas_total', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                </div>
              </div>
            </section>

            <aside className="grid gap-5">
              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <p className="font-black text-[#071b3a]">Nota fiscal e documentos</p>
                <p className="mt-1 text-sm font-bold text-slate-500">XML preenche automaticamente. PDF e imagem ficam anexados.</p>

                <input ref={fileRef} type="file" accept=".xml,.pdf,image/*" className="hidden" onChange={(e) => handleDocumento(e.target.files?.[0] || null)} />
                <input ref={barcodeFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => lerCodigoDeBarras(e.target.files?.[0] || null)} />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl bg-[#05245c] px-4 py-3 font-black text-white">Anexar NF</button>
                  <button type="button" onClick={() => barcodeFileRef.current?.click()} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-black text-[#05245c]">Ler código</button>
                </div>

                <div className="mt-4 grid gap-3">
                  <input value={form.codigo_barras} onChange={(e) => update('codigo_barras', limparCodigo(e.target.value))} placeholder="Código de barras / linha digitável" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                  <input value={form.nota_chave} onChange={(e) => update('nota_chave', limparCodigo(e.target.value))} placeholder="Chave da NF-e" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                </div>

                {form.documento_nome && <p className="mt-3 text-sm font-black text-emerald-700">Arquivo: {form.documento_nome}</p>}
                <p className="mt-2 text-xs font-bold text-slate-500">{barcodeSupported ? 'Leitura de código disponível neste navegador.' : 'Leitura de código depende do navegador. Campo manual disponível.'}</p>
              </section>

              <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-[#071b3a]">Materiais</p>
                    <p className="text-sm font-bold text-slate-500">Estoque ou itens da NF.</p>
                  </div>
                  <button type="button" onClick={addMaterialLine} className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-[#05245c]">+ Item</button>
                </div>

                <div className="mt-4 grid gap-3">
                  {materialDrafts.map((item, index) => (
                    <div key={index} className="rounded-2xl bg-[#f5f8ff] p-3">
                      <div className="grid gap-3">
                        <input value={item.nome} onChange={(e) => updateMaterial(index, 'nome', e.target.value)} placeholder="Material" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none" />
                        <div className="grid grid-cols-3 gap-2">
                          <input value={item.quantidade} onChange={(e) => updateMaterial(index, 'quantidade', e.target.value)} placeholder="Qtd" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none" />
                          <input value={item.unidade} onChange={(e) => updateMaterial(index, 'unidade', e.target.value)} placeholder="Un" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none" />
                          <input value={item.valor_unitario} onChange={(e) => updateMaterial(index, 'valor_unitario', e.target.value)} placeholder="Valor" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none" />
                        </div>
                        <button type="button" onClick={() => removeMaterial(index)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">Remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <button disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-5 font-black text-white shadow-xl shadow-[#05245c]/20 disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar lançamento'}
              </button>
            </aside>
          </form>
        )}

        {tab === 'lancamentos' && (
          <section className="grid gap-5">
            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="grid gap-4 lg:grid-cols-[160px_1fr_150px_150px_auto]">
                <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lançamento, fornecedor, código ou nota" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none" />
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"><option value="todos">Todos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select>
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"><option value="todos">Todos</option><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option></select>
                <button onClick={exportarCSV} className="rounded-2xl bg-[#05245c] px-4 py-3 font-black text-white">Exportar CSV</button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="grid gap-3">
                {filtradas.map((item) => (
                  <article key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:bg-[#f8fbff]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${tipoBadge(item.tipo)}`}>{item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge(item.status)}`}>{item.status}</span>
                          {vencido(item) && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">Vencido</span>}
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{item.categoria}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-[#071b3a]">{item.descricao}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {item.fornecedor_cliente || 'Sem fornecedor/cliente'} • {dataBR(item.data_competencia)} • Venc.: {dataBR(item.vencimento)} • {item.forma_pagamento || 'Sem forma'}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {item.finance_accounts?.nome || 'Sem conta'} • {item.centro_custo || 'Geral'}
                          {item.documento_url && <> • <a href={item.documento_url} target="_blank" rel="noreferrer" className="text-[#05245c] underline">Ver anexo</a></>}
                        </p>
                      </div>

                      <div className="text-left lg:text-right">
                        <p className={`text-2xl font-black ${item.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {item.tipo === 'entrada' ? '+' : '-'} {moeda(item.valor)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 lg:justify-end">
                          {item.status === 'pendente' && <button onClick={() => marcarPago(item.id)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Pago</button>}
                          <button onClick={() => duplicar(item)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Duplicar</button>
                          <button onClick={() => excluirLancamento(item.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Excluir</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                {filtradas.length === 0 && <div className="rounded-[2rem] border border-dashed border-slate-300 p-10 text-center"><p className="text-2xl font-black text-[#071b3a]">Nenhum lançamento</p><p className="mt-2 font-bold text-slate-500">Cadastre entradas, despesas ou anexe uma nota fiscal.</p></div>}
              </div>
            </div>
          </section>
        )}

        {tab === 'materiais' && (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Materiais</p>
            <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Entradas de material</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {materials.map((mat) => (
                <div key={mat.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black text-[#071b3a]">{mat.nome}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">{mat.quantidade} {mat.unidade} • Valor unit.: {moeda(mat.valor_unitario)}</p>
                  <p className="mt-2 text-xl font-black text-[#05245c]">{moeda(mat.valor_total)}</p>
                </div>
              ))}

              {materials.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-4 text-sm font-bold text-slate-500">Nenhum material cadastrado.</p>}
            </div>
          </section>
        )}

        {tab === 'contas' && (
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
            <form onSubmit={salvarConta} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Nova conta</p>
              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Caixa, banco ou digital</h2>

              <div className="mt-5 grid gap-4">
                <input value={accountDraft.nome} onChange={(e) => setAccountDraft((v) => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Caixa principal, Banco do Brasil..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <select value={accountDraft.tipo} onChange={(e) => setAccountDraft((v) => ({ ...v, tipo: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none">
                  <option value="caixa">Caixa</option>
                  <option value="banco">Banco</option>
                  <option value="cartao">Cartão</option>
                  <option value="digital">Conta digital</option>
                  <option value="outro">Outro</option>
                </select>
                <input value={accountDraft.saldo_inicial} onChange={(e) => setAccountDraft((v) => ({ ...v, saldo_inicial: e.target.value }))} placeholder="Saldo inicial" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                <button className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Criar conta</button>
              </div>
            </form>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Contas</p>
              <h2 className="mt-1 text-2xl font-black text-[#071b3a]">Saldos por conta</h2>

              <div className="mt-5 grid gap-3">
                {contasResumo.map((acc) => (
                  <div key={acc.id} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-[#071b3a]">{acc.nome}</p>
                        <p className="text-sm font-bold text-slate-500">{acc.tipo}</p>
                      </div>
                      <p className="text-xl font-black text-[#05245c]">{moeda(acc.saldoAtual)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
