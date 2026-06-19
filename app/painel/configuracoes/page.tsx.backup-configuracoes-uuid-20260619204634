'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Member = any
type Company = any

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
    recursos: ['Pedidos', 'Produtos', 'Status'],
  },
}

function criarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@$#'
  let senha = ''
  for (let i = 0; i < 12; i += 1) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

function statusClasse(status: string) {
  if (status === 'ativa' || status === 'ativo' || status === 'publicado') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (status === 'bloqueado' || status === 'rascunho') return 'bg-yellow-50 text-yellow-700 border-yellow-100'
  return 'bg-slate-50 text-slate-600 border-slate-200'
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

  const [form, setForm] = useState<Record<string, any>>({
    nome: '',
    whatsapp: '',
    cidade: '',
    estado: '',
    instagram: '',
    atendimento_horario: '',
    atendimento_observacao: '',
    site_status: 'publicado',
    pix_key: '',
    pix_tipo: 'telefone',
    pix_nome: '',
    pix_cidade: '',
    aceita_pix: true,
    aceita_cartao: false,
    cobrar_sinal: false,
    percentual_sinal: 0,
  })

  const [newMember, setNewMember] = useState({
    nome: '',
    email: '',
    cargo: 'atendente',
    password: criarSenha(),
  })

  const siteUrl = useMemo(() => {
    if (!company) return ''
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
    const sub = company.subdomain_slug || String(company.slug || '').replace(/[^a-z0-9]/g, '')
    return `https://${sub}.${root}`
  }, [company])

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'ativo'), [members])

  async function carregar() {
    setLoading(true)
    setError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''

    if (!accessToken) {
      setError('Você precisa estar logado.')
      setLoading(false)
      return
    }

    setToken(accessToken)

    const res = await fetch('/api/company/team', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao carregar configurações.')
      setLoading(false)
      return
    }

    const c = data.company || {}
    setCompany(c)
    setMembers(data.members || [])
    setLimit(data.limit || 2)
    setForm({
      nome: c.nome || '',
      whatsapp: c.whatsapp || '',
      cidade: c.cidade || '',
      estado: c.estado || '',
      instagram: c.instagram || '',
      atendimento_horario: c.atendimento_horario || '',
      atendimento_observacao: c.atendimento_observacao || '',
      site_status: c.site_status || 'publicado',
      pix_key: c.pix_key || '',
      pix_tipo: c.pix_tipo || 'telefone',
      pix_nome: c.pix_nome || c.nome || '',
      pix_cidade: c.pix_cidade || c.cidade || '',
      aceita_pix: c.aceita_pix ?? true,
      aceita_cartao: c.aceita_cartao ?? false,
      cobrar_sinal: c.cobrar_sinal ?? false,
      percentual_sinal: c.percentual_sinal ?? 0,
    })

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function update(campo: string, valor: any) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function salvarConfiguracoes(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!company) return

    setSavingCompany(true)
    setMessage('')
    setError('')

    const payload = {
      nome: form.nome,
      whatsapp: form.whatsapp,
      cidade: form.cidade,
      estado: String(form.estado || '').toUpperCase().slice(0, 2),
      instagram: form.instagram,
      atendimento_horario: form.atendimento_horario,
      atendimento_observacao: form.atendimento_observacao,
      site_status: form.site_status,
      pix_key: form.pix_key,
      pix_tipo: form.pix_tipo,
      pix_nome: form.pix_nome,
      pix_cidade: form.pix_cidade,
      aceita_pix: Boolean(form.aceita_pix),
      aceita_cartao: Boolean(form.aceita_cartao),
      cobrar_sinal: Boolean(form.cobrar_sinal),
      percentual_sinal: Number(form.percentual_sinal || 0),
    }

    const { error: updateError } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', company.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setMessage('Configurações salvas.')
      await carregar()
    }

    setSavingCompany(false)
  }

  async function copiar(texto: string) {
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
      body: JSON.stringify(newMember),
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
    const ok = window.confirm('Remover este funcionário?')
    if (!ok) return

    const res = await fetch(`/api/company/team?id=${id}`, {
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
                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#071b3a] sm:text-5xl">
                  Configurações
                </h1>
                <p className="mt-2 max-w-2xl font-bold leading-7 text-slate-500">
                  Controle os dados da empresa, recebimentos, site e acessos da equipe em um só lugar.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Empresa</p>
                  <p className="mt-1 truncate text-lg font-black">{company?.nome}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Site</p>
                  <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasse(form.site_status)}`}>
                    {form.site_status}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-[#f8fbff] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Equipe</p>
                  <p className="mt-1 text-lg font-black">{activeMembers.length}/{limit} logins</p>
                </div>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={siteUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-3 text-center font-black text-white">
                Abrir site
              </a>
              <button onClick={() => copiar(siteUrl)} className="rounded-2xl border border-blue-100 bg-white px-5 py-3 font-black text-[#05245c]">
                Copiar link
              </button>
              <Link href="/painel/site" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-center font-black text-[#05245c]">
                Configurar site
              </Link>
            </div>
          </div>
        </div>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${
                tab === item.id ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20' : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={salvarConfiguracoes}>
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

                  <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Cidade</span>
                      <input value={form.cidade} onChange={(e) => update('cidade', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">UF</span>
                      <input value={form.estado} onChange={(e) => update('estado', e.target.value.toUpperCase().slice(0, 2))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-bold uppercase outline-none focus:border-[#05245c] focus:bg-white" />
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
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Recebimento</p>
                <h2 className="mt-2 text-2xl font-black">Dados do PIX</h2>
                <p className="mt-2 text-sm font-bold text-slate-500">Esses dados serão usados em propostas e orientações de pagamento.</p>

                <div className="mt-6 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Tipo da chave</span>
                      <select value={form.pix_tipo} onChange={(e) => update('pix_tipo', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                        <option value="telefone">Telefone</option>
                        <option value="email">E-mail</option>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="aleatoria">Chave aleatória</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Chave PIX</span>
                      <input value={form.pix_key} onChange={(e) => update('pix_key', e.target.value)} placeholder="Digite a chave PIX" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Nome do recebedor</span>
                      <input value={form.pix_nome} onChange={(e) => update('pix_nome', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-700">Cidade do recebedor</span>
                      <input value={form.pix_cidade} onChange={(e) => update('pix_cidade', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                      <input type="checkbox" checked={form.aceita_pix} onChange={(e) => update('aceita_pix', e.target.checked)} />
                      Aceita PIX
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                      <input type="checkbox" checked={form.aceita_cartao} onChange={(e) => update('aceita_cartao', e.target.checked)} />
                      Aceita cartão
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black">
                      <input type="checkbox" checked={form.cobrar_sinal} onChange={(e) => update('cobrar_sinal', e.target.checked)} />
                      Cobra sinal
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Percentual de sinal</span>
                    <input type="number" min={0} max={100} value={form.percentual_sinal} onChange={(e) => update('percentual_sinal', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                  </label>
                </div>
              </section>

              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Prévia</p>
                <h2 className="mt-2 text-2xl font-black">Como ficará para pagamento</h2>

                <div className="mt-6 rounded-[1.5rem] bg-[#05245c] p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">PIX</p>
                  <p className="mt-3 break-all text-2xl font-black">{form.pix_key || 'Sua chave PIX'}</p>
                  <p className="mt-3 font-bold text-white/75">{form.pix_nome || 'Nome do recebedor'} • {form.pix_cidade || 'Cidade'}</p>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-blue-50 p-4 font-bold text-[#05245c]">
                    {form.cobrar_sinal ? `Sinal configurado: ${form.percentual_sinal || 0}%` : 'Sinal desativado'}
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">
                    {form.aceita_pix ? 'PIX ativo' : 'PIX desativado'}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'site' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Site</p>
                <h2 className="mt-2 text-2xl font-black">Configuração do site</h2>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Status do site</span>
                    <select value={form.site_status} onChange={(e) => update('site_status', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white">
                      <option value="publicado">Publicado</option>
                      <option value="rascunho">Rascunho</option>
                    </select>
                  </label>

                  <div className="rounded-2xl bg-[#f5f8ff] p-4">
                    <p className="text-sm font-black text-[#05245c]">Endereço público</p>
                    <p className="mt-2 break-all font-black text-[#071b3a]">{siteUrl}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link href="/painel/site" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                      Abrir editor do site
                    </Link>
                    <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">
                      Configurar catálogo
                    </Link>
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Checklist</p>
                <h2 className="mt-2 text-2xl font-black">Para deixar bonito</h2>

                <div className="mt-6 grid gap-3">
                  {[
                    ['Logo da empresa', Boolean(company?.logo_url)],
                    ['WhatsApp configurado', Boolean(form.whatsapp)],
                    ['PIX configurado', Boolean(form.pix_key)],
                    ['Site publicado', form.site_status === 'publicado'],
                    ['Catálogo cadastrado', true],
                  ].map(([label, done]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-[#f5f8ff] p-4">
                      <span className="font-black">{String(label)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {done ? 'OK' : 'Pendente'}
                      </span>
                    </div>
                  ))}
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

                  <button disabled={activeMembers.length >= limit} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                    Adicionar funcionário
                  </button>
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
                          <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-[#05245c]">
                            {cargos[member.cargo]?.nome || member.cargo} • {member.status}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <select value={member.cargo} onChange={(e) => atualizarFuncionario(member.id, { cargo: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold">
                            <option value="gerente">Gerente</option>
                            <option value="atendente">Atendente</option>
                            <option value="producao">Produção</option>
                          </select>

                          <button onClick={() => atualizarFuncionario(member.id, { status: member.status === 'ativo' ? 'bloqueado' : 'ativo' })} className="rounded-xl bg-yellow-50 px-3 py-2 text-sm font-black text-yellow-800">
                            {member.status === 'ativo' ? 'Bloquear' : 'Ativar'}
                          </button>

                          <button onClick={() => removerFuncionario(member.id)} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                            Remover
                          </button>
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
                          <span key={recurso} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">
                            {recurso}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="sticky bottom-4 mt-6 rounded-[1.5rem] border border-blue-100 bg-white/95 p-3 shadow-2xl shadow-blue-950/10 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-500">Alterações de empresa, recebimento e site precisam ser salvas.</p>
              <button disabled={savingCompany} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
                {savingCompany ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  )
}
