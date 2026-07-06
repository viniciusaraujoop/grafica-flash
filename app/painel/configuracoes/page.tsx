'use client'

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { businessTypes, getBusinessTypeConfig } from '@/lib/business-types'
import { getCompanyPublicUrl, getRootDomain, normalizeCompanySlug } from '@/lib/company-url'

type Member = {
  id: string
  nome: string
  email: string
  cargo: string
  status: string
  created_at?: string
}

type Company = {
  id: string
  nome: string
  slug: string
  subdomain_slug?: string | null
  logo_url?: string | null
  whatsapp?: string | null
  cidade?: string | null
  estado?: string | null
  instagram?: string | null
  atendimento_horario?: string | null
  atendimento_observacao?: string | null
  site_status?: string | null
  site_publico_ativo?: boolean | null
  site_primary_color?: string | null
  site_accent_color?: string | null
  site_background_color?: string | null
  site_show_store?: boolean | null
  site_show_about?: boolean | null
  site_show_contact?: boolean | null
  pix_key?: string | null
  pix_tipo?: string | null
  pix_nome?: string | null
  pix_cidade?: string | null
  aceita_pix?: boolean | null
  aceita_cartao?: boolean | null
  cobrar_sinal?: boolean | null
  percentual_sinal?: number | null
  business_type?: string | null
}

type Uf = {
  sigla: string
  nome: string
}

type CidadeIbge = {
  id: number
  nome: string
}

const ufs: Uf[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

const tabs = [
  { id: 'empresa', label: 'Empresa' },
  { id: 'recebimento', label: 'Recebimento' },
  { id: 'site', label: 'Site' },
  { id: 'equipe', label: 'Equipe' },
]

const cargos: Record<string, { nome: string; descricao: string; recursos: string[] }> = {
  gerente: {
    nome: 'Gerente',
    descricao: 'Ajuda na operação comercial e no controle de produtos, pedidos e propostas.',
    recursos: ['Pedidos', 'Produtos', 'Propostas', 'Clientes', 'Oportunidades'],
  },
  atendente: {
    nome: 'Atendente',
    descricao: 'Cuida do contato com clientes, acompanha pedidos e envia propostas.',
    recursos: ['Pedidos', 'Propostas', 'Clientes'],
  },
  producao: {
    nome: 'Produção',
    descricao: 'Acompanha execução, produtos e status dos pedidos.',
    recursos: ['Pedidos', 'Produtos', 'Produção'],
  },
}

function criarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@$#'
  let senha = ''
  for (let i = 0; i < 12; i += 1) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}


function normalizeSubdomain(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function statusClasse(status: string) {
  if (status === 'ativa' || status === 'ativo' || status === 'publicado') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (status === 'bloqueado' || status === 'rascunho') return 'bg-yellow-50 text-yellow-700 border-yellow-100'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function getInitialForm(company?: Partial<Company> | null) {
  return {
    nome: company?.nome || '',
    subdomain_slug: company?.subdomain_slug || normalizeSubdomain(company?.slug || company?.nome || ''),
    whatsapp: company?.whatsapp || '',
    cidade: company?.cidade || '',
    estado: company?.estado || '',
    instagram: company?.instagram || '',
    atendimento_horario: company?.atendimento_horario || '',
    atendimento_observacao: company?.atendimento_observacao || '',
    site_status: company?.site_status || 'publicado',
    site_publico_ativo: company?.site_publico_ativo ?? true,
    site_primary_color: company?.site_primary_color || '#05245c',
    site_accent_color: company?.site_accent_color || '#22c55e',
    site_background_color: company?.site_background_color || '#f5f8ff',
    site_show_store: company?.site_show_store ?? true,
    site_show_about: company?.site_show_about ?? true,
    site_show_contact: company?.site_show_contact ?? true,
    pix_key: company?.pix_key || '',
    pix_tipo: company?.pix_tipo || 'telefone',
    pix_nome: company?.pix_nome || company?.nome || '',
    pix_cidade: company?.pix_cidade || company?.cidade || '',
    aceita_pix: company?.aceita_pix ?? true,
    aceita_cartao: company?.aceita_cartao ?? false,
    cobrar_sinal: company?.cobrar_sinal ?? false,
    percentual_sinal: company?.percentual_sinal ?? 0,
    business_type: company?.business_type || 'services',
  }
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState('empresa')
  const [company, setCompany] = useState<Company | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [limit, setLimit] = useState(2)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, any>>(getInitialForm(null))
  const [linkStatus, setLinkStatus] = useState<{
    checking: boolean
    checkedSlug: string
    available: boolean | null
    message: string
    suggestion?: string | null
  }>({ checking: false, checkedSlug: '', available: null, message: '' })

  const [cidades, setCidades] = useState<string[]>([])
  const [carregandoCidades, setCarregandoCidades] = useState(false)

  const [newMember, setNewMember] = useState({
    nome: '',
    email: '',
    cargo: 'atendente',
    password: criarSenha(),
  })

  const activeMembers = useMemo(() => members.filter((member) => member.status === 'ativo'), [members])
  const rootDomain = getRootDomain()

  const siteUrl = useMemo(() => getCompanyPublicUrl(company?.subdomain_slug || company?.slug || company?.nome), [company])

  const previewSubdomain = normalizeCompanySlug(form.subdomain_slug || company?.subdomain_slug || company?.slug || company?.nome || '')
  const previewSiteUrl = previewSubdomain ? getCompanyPublicUrl(previewSubdomain) : siteUrl

  function update(campo: string, valor: any) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function updateSubdomain(valor: string) {
    const next = normalizeSubdomain(valor)
    setForm((atual) => ({ ...atual, subdomain_slug: next }))
    setLinkStatus({ checking: false, checkedSlug: '', available: null, message: '' })
  }


  function updateEstado(uf: string) {
    setForm((atual) => ({ ...atual, estado: uf, cidade: '' }))
  }

  useEffect(() => {
    const estado = String(form.estado || '').toUpperCase().slice(0, 2)

    if (!estado) {
      setCidades([])
      return
    }

    let cancelado = false

    async function carregarCidadesPorUf() {
      setCarregandoCidades(true)

      try {
        const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)

        if (!resposta.ok) throw new Error('Erro ao carregar cidades.')

        const dados = (await resposta.json()) as CidadeIbge[]
        const nomes = dados.map((cidade) => cidade.nome).filter(Boolean)

        if (!cancelado) setCidades(nomes)
      } catch {
        if (!cancelado) setCidades([])
      } finally {
        if (!cancelado) setCarregandoCidades(false)
      }
    }

    carregarCidadesPorUf()

    return () => {
      cancelado = true
    }
  }, [form.estado])

  async function getAccessToken() {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function carregar() {
    setLoading(true)
    setError('')
    setMessage('')

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Você precisa estar logado.')
      setLoading(false)
      return
    }

    setToken(accessToken)

    const [settingsRes, teamRes] = await Promise.all([
      fetch('/api/company/settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch('/api/company/team', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ])

    const settingsData = await settingsRes.json()
    const teamData = await teamRes.json()

    if (!settingsRes.ok) {
      setError(settingsData.error || 'Erro ao carregar configurações.')
      setLoading(false)
      return
    }

    if (!teamRes.ok) {
      setError(teamData.error || 'Erro ao carregar equipe.')
      setLoading(false)
      return
    }

    const loadedCompany = settingsData.company || teamData.company

    if (!loadedCompany?.id || !isUuid(loadedCompany.id)) {
      setError('Empresa carregada sem ID válido. Faça login novamente.')
      setLoading(false)
      return
    }

    setCompany(loadedCompany)
    setForm(getInitialForm(loadedCompany))
    setMembers(teamData.members || [])
    setLimit(teamData.limit || 2)
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvarConfiguracoes() {
    if (!company?.id || !isUuid(company.id)) {
      setError('Empresa inválida. Recarregue a página.')
      return
    }

    setSavingCompany(true)
    setMessage('')
    setError('')

    const payload = {
      ...form,
      subdomain_slug: normalizeSubdomain(form.subdomain_slug || company?.subdomain_slug || company?.slug || company?.nome || ''),
      estado: String(form.estado || '').toUpperCase().slice(0, 2),
      percentual_sinal: Number(form.percentual_sinal || 0),
    }

    const res = await fetch('/api/company/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao salvar configurações.')
      setSavingCompany(false)
      return
    }

    setCompany(data.company)
    setForm(getInitialForm(data.company))
    setMessage('Configurações salvas.')
    setSavingCompany(false)
  }


  async function verificarLinkSite() {
    setMessage('')
    setError('')

    const slug = normalizeSubdomain(form.subdomain_slug || company?.subdomain_slug || company?.slug || company?.nome || '')

    if (!slug || slug.length < 3) {
      setLinkStatus({
        checking: false,
        checkedSlug: slug,
        available: false,
        message: 'O link precisa ter pelo menos 3 caracteres.',
      })
      return
    }

    setForm((atual) => ({ ...atual, subdomain_slug: slug }))
    setLinkStatus({ checking: true, checkedSlug: slug, available: null, message: 'Verificando disponibilidade...' })

    const res = await fetch(`/api/company/settings?check_subdomain=${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()

    if (!res.ok) {
      setLinkStatus({
        checking: false,
        checkedSlug: slug,
        available: false,
        message: data.error || data.message || 'Não foi possível usar este link.',
        suggestion: data.suggestion || null,
      })
      return
    }

    setLinkStatus({
      checking: false,
      checkedSlug: slug,
      available: Boolean(data.available),
      message: data.message || 'Este link está disponível.',
      suggestion: data.suggestion || null,
    })
  }

  async function copiar(texto: string) {
    if (!texto) return
    await navigator.clipboard.writeText(texto)
    setMessage('Copiado.')
  }

  async function adicionarFuncionario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    const res = await fetch('/api/company/team', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nome: newMember.nome,
        email: newMember.email,
        cargo: newMember.cargo,
        senha: newMember.password,
        password: newMember.password,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao adicionar funcionário.')
      return
    }

    setMessage('Funcionário criado. Guarde a senha antes de sair desta tela.')
    setNewMember({ nome: '', email: '', cargo: 'atendente', password: criarSenha() })
    await carregar()
  }

  async function atualizarFuncionario(id: string, payload: Record<string, string>) {
    setMessage('')
    setError('')

    if (!isUuid(id)) {
      setError('Funcionário inválido. Recarregue a página.')
      return
    }

    const res = await fetch('/api/company/team', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...payload }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao atualizar funcionário.')
      return
    }

    setMessage('Funcionário atualizado.')
    await carregar()
  }

  async function removerFuncionario(id: string) {
    setMessage('')
    setError('')

    if (!isUuid(id)) {
      setError('Funcionário inválido. Recarregue a página.')
      return
    }

    const ok = window.confirm('Remover este funcionário?')
    if (!ok) return

    const res = await fetch(`/api/company/team?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao remover funcionário.')
      return
    }

    setMessage('Funcionário removido.')
    await carregar()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando configurações...</div>
      </main>
    )
  }

  if (error && !company) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="max-w-xl rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Configurações indisponíveis</p>
          <p className="mt-3 font-bold text-red-600">{error}</p>
          <Link href="/painel" className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">
            Voltar ao painel
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-24 h-40 w-40 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">Configurações</h1>
                <p className="mt-2 max-w-2xl font-bold leading-7 text-slate-500">
                  Controle empresa, recebimentos, site e equipe sem mandar UUID undefined para o banco, uma evolução importante para a humanidade.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Empresa</p>
                  <p className="mt-1 truncate text-lg font-black">{company?.nome}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Site</p>
                  <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasse(form.site_status)}`}>{form.site_status}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Equipe</p>
                  <p className="mt-1 text-lg font-black">{activeMembers.length}/{limit} logins</p>
                </div>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={siteUrl || '/site/grafica-flash'} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-3 text-center font-black text-white">Abrir site</a>
              <button type="button" onClick={() => copiar(siteUrl)} className="rounded-2xl border border-blue-100 bg-white px-5 py-3 font-black text-[#05245c]">Copiar link</button>
              <Link href="/painel/site" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-center font-black text-[#05245c]">Configurar site avançado</Link>
              <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-center font-black text-[#05245c]">Catálogo</Link>
            </div>
          </div>
        </div>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${
                tab === item.id ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20' : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'empresa' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Dados da empresa</p>
              <h2 className="mt-2 text-2xl font-black">Informações principais</h2>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Nome da empresa</span>
                  <input value={form.nome} onChange={(e) => update('nome', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>

                <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-black text-[#05245c]">Tipo de negócio</span>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                        Esse tipo de negócio muda textos, sugestões e recursos exibidos no site e painel. Você pode alterar tudo depois.
                      </p>
                    </div>
                    <Link href="/painel/segmento" className="rounded-2xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white">
                      Configurar segmento
                    </Link>
                  </div>
                  <select value={form.business_type || 'services'} onChange={(e) => update('business_type', e.target.value)} className="mt-4 w-full rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                    {businessTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">
                    Atual: {getBusinessTypeConfig(form.business_type).publicName}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">WhatsApp</span>
                    <input value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="(82) 99999-9999" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Instagram</span>
                    <input value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="@suaempresa" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">UF</span>
                    <select
                      value={String(form.estado || '').toUpperCase().slice(0, 2)}
                      onChange={(e) => updateEstado(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-bold uppercase outline-none focus:border-[#05245c] focus:bg-white"
                    >
                      {ufs.map((uf) => (
                        <option key={uf.sigla} value={uf.sigla}>
                          {uf.sigla}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black text-slate-700">Cidade</span>
                    <select
                      value={form.cidade || ''}
                      onChange={(e) => update('cidade', e.target.value)}
                      disabled={carregandoCidades || cidades.length === 0}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white disabled:opacity-60"
                    >
                      <option value="">{carregandoCidades ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
                      {cidades.map((cidade) => (
                        <option key={cidade} value={cidade}>
                          {cidade}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Atendimento</p>
              <h2 className="mt-2 text-2xl font-black">Como aparece para o cliente</h2>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Horário de atendimento</span>
                  <input value={form.atendimento_horario} onChange={(e) => update('atendimento_horario', e.target.value)} placeholder="Seg a Sex, 08h às 18h" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Observação de atendimento</span>
                  <textarea value={form.atendimento_observacao} onChange={(e) => update('atendimento_observacao', e.target.value)} rows={5} placeholder="Ex.: Respondemos por ordem de chegada." className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>
              </div>
            </section>
          </div>
        )}

        {tab === 'recebimento' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Recebimentos</p>
              <h2 className="mt-2 text-2xl font-black">Pagamentos e recebimentos</h2>
              <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-500">
                As formas aceitas na entrega ficam em uma tela própria. Pix e cartão online via Mercado Pago ficam na área de pagamentos, sem duplicar configuração dentro das preferências da empresa.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link href="/painel/pagamentos/configuracao" className="rounded-[1.4rem] border border-blue-100 bg-[#05245c] p-5 text-white shadow-lg shadow-blue-950/15">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Online</p>
                  <h3 className="mt-2 text-xl font-black">Pagamentos e recebimentos</h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-white/75">Conecte Mercado Pago para receber Pix e cartão pelo site.</p>
                </Link>
                <Link href="/painel/formas-pagamento" className="rounded-[1.4rem] border border-blue-100 bg-[#f8fbff] p-5 text-[#071b3a]">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Operacional</p>
                  <h3 className="mt-2 text-xl font-black">Formas de pagamento</h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Configure Pix manual, dinheiro, cartão na entrega e instruções para o cliente.</p>
                </Link>
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Separação correta</p>
              <div className="mt-5 grid gap-3 text-sm font-bold leading-6 text-slate-600">
                <div className="rounded-2xl bg-blue-50 p-4 text-[#05245c]">Mercado Pago processa Pix/cartão online do site.</div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">Formas de pagamento controlam o que a loja aceita no pedido.</div>
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-700">Configurações guarda dados da empresa, site e equipe. Nada de duplicar Pix por aqui.</div>
              </div>
            </section>
          </div>
        )}
        {tab === 'site' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Site</p>
              <h2 className="mt-2 text-2xl font-black">Configuração rápida</h2>

              <div className="mt-6 grid gap-4">
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                  <input type="checkbox" checked={form.site_publico_ativo} onChange={(e) => update('site_publico_ativo', e.target.checked)} />
                  Site público ativo
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Status do site</span>
                  <select value={form.site_status} onChange={(e) => update('site_status', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                    <option value="publicado">Publicado</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Principal</span>
                    <input type="color" value={form.site_primary_color} onChange={(e) => update('site_primary_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Destaque</span>
                    <input type="color" value={form.site_accent_color} onChange={(e) => update('site_accent_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Fundo</span>
                    <input type="color" value={form.site_background_color} onChange={(e) => update('site_background_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                    <input type="checkbox" checked={form.site_show_store} onChange={(e) => update('site_show_store', e.target.checked)} />
                    Mostrar loja
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                    <input type="checkbox" checked={form.site_show_about} onChange={(e) => update('site_show_about', e.target.checked)} />
                    Mostrar sobre
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                    <input type="checkbox" checked={form.site_show_contact} onChange={(e) => update('site_show_contact', e.target.checked)} />
                    Mostrar contato
                  </label>
                </div>

                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-[#05245c]">Link do site</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">O cliente acessa pelo padrão empresa.orcaly.com.br.</p>
                    </div>
                    {company?.subdomain_slug && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">Atual: {company.subdomain_slug}</span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="flex min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-[#05245c]">
                      <input
                        value={form.subdomain_slug || ''}
                        onChange={(e) => updateSubdomain(e.target.value)}
                        placeholder="empresa"
                        className="min-w-0 flex-1 bg-transparent px-4 py-4 font-black lowercase outline-none"
                      />
                      <span className="flex items-center border-l border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-500">.{rootDomain}</span>
                    </div>

                    <button
                      type="button"
                      onClick={verificarLinkSite}
                      disabled={linkStatus.checking}
                      className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] disabled:opacity-60"
                    >
                      {linkStatus.checking ? 'Verificando...' : 'Verificar'}
                    </button>
                  </div>

                  <p className="mt-3 break-all text-sm font-black text-[#071b3a]">{previewSiteUrl}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">Use letras, números e hífen. Sem acentos, espaços ou símbolos.</p>

                  {linkStatus.message && (
                    <div className={`mt-3 rounded-2xl border p-3 text-sm font-black ${linkStatus.available ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                      {linkStatus.message}
                      {linkStatus.suggestion && (
                        <button
                          type="button"
                          onClick={() => updateSubdomain(String(linkStatus.suggestion || ''))}
                          className="ml-2 underline"
                        >
                          Usar sugestão: {linkStatus.suggestion}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Ações</p>
              <div className="mt-6 grid gap-3">
                <Link href="/painel/site" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">Abrir editor completo do site</Link>
                <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">Configurar catálogo</Link>
                <a href={siteUrl || '/site/grafica-flash'} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">Ver site público</a>
              </div>
            </section>
          </div>
        )}

        {tab === 'equipe' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Equipe</p>
                  <h2 className="mt-2 text-2xl font-black">Logins de funcionários</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">Crie até {limit} acessos com funções reduzidas.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-[#05245c]">{activeMembers.length}/{limit}</span>
              </div>

              <form onSubmit={adicionarFuncionario} className="mt-6 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <input value={newMember.nome} onChange={(e) => setNewMember((v) => ({ ...v, nome: e.target.value }))} placeholder="Nome do funcionário" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]" />
                <input value={newMember.email} onChange={(e) => setNewMember((v) => ({ ...v, email: e.target.value }))} placeholder="E-mail de login" type="email" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]" />

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <select value={newMember.cargo} onChange={(e) => setNewMember((v) => ({ ...v, cargo: e.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]">
                    <option value="gerente">Gerente</option>
                    <option value="atendente">Atendente</option>
                    <option value="producao">Produção</option>
                  </select>
                  <input value={newMember.password} onChange={(e) => setNewMember((v) => ({ ...v, password: e.target.value }))} placeholder="Senha inicial" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-[#05245c]" />
                  <button type="button" onClick={() => setNewMember((v) => ({ ...v, password: criarSenha() }))} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]">Gerar</button>
                </div>

                <button disabled={activeMembers.length >= limit} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Adicionar funcionário</button>
              </form>

              <div className="mt-5 grid gap-3">
                {members.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
                    <p className="font-black text-slate-700">Nenhum funcionário adicionado.</p>
                  </div>
                )}

                {members.map((member) => (
                  <article key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-[#071b3a]">{member.nome}</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">{member.email}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#05245c]">{cargos[member.cargo]?.nome || member.cargo} • {member.status}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <select value={member.cargo} onChange={(e) => atualizarFuncionario(member.id, { cargo: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold">
                          <option value="gerente">Gerente</option>
                          <option value="atendente">Atendente</option>
                          <option value="producao">Produção</option>
                        </select>

                        <button type="button" onClick={() => atualizarFuncionario(member.id, { status: member.status === 'ativo' ? 'bloqueado' : 'ativo' })} className="rounded-xl bg-yellow-50 px-3 py-2 text-sm font-black text-yellow-800">
                          {member.status === 'ativo' ? 'Bloquear' : 'Ativar'}
                        </button>

                        <button type="button" onClick={() => removerFuncionario(member.id)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">Remover</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Permissões</p>
              <h2 className="mt-2 text-2xl font-black">Cargos disponíveis</h2>

              <div className="mt-5 grid gap-3">
                {Object.entries(cargos).map(([key, cargo]) => (
                  <div key={key} className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="font-black text-[#071b3a]">{cargo.nome}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{cargo.descricao}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cargo.recursos.map((recurso) => (
                        <span key={recurso} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">{recurso}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab !== 'equipe' && (
          <div className="sticky bottom-4 mt-6 rounded-[1.5rem] border border-blue-100 bg-white/95 p-3 shadow-2xl shadow-blue-950/10 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-500">Salva sem depender de UUID vindo da tela. O servidor identifica a empresa pelo login.</p>
              <button type="button" onClick={salvarConfiguracoes} disabled={savingCompany} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
                {savingCompany ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
