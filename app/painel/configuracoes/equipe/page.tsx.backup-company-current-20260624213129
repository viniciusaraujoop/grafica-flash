'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Member = {
  id: string
  nome: string
  email: string
  cargo: string
  status: string
  permissions?: Record<string, boolean>
  created_at?: string
}

const cargoLabel: Record<string, string> = {
  gerente: 'Gerente',
  atendente: 'Atendente',
  producao: 'Produção',
}

const cargoDescricao: Record<string, string> = {
  gerente: 'Pedidos, produtos, propostas, clientes, oportunidades e financeiro.',
  atendente: 'Pedidos, propostas, clientes e oportunidades.',
  producao: 'Pedidos, produtos e produção. Sem financeiro e sem configurações.',
}

export default function ConfiguracoesEquipeCorrigidaPage() {
  const [token, setToken] = useState('')
  const [company, setCompany] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: 'atendente',
  })

  async function carregar() {
    setLoading(true)
    setErro('')
    setMessage('')

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''
    const user = sessionData.session?.user

    if (!accessToken || !user) {
      window.location.href = '/login'
      return
    }

    setToken(accessToken)

    const { data: empresa } = await supabase
      .from('companies')
      .select('*')
      .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
      .maybeSingle()

    setCompany(empresa)

    const res = await fetch('/api/company/team', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao carregar equipe.')
    } else {
      setMembers(payload.members || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criarFuncionario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSaving(true)
    setErro('')
    setMessage('')

    const res = await fetch('/api/company/team', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao criar funcionário.')
    } else {
      setMessage(payload.message || 'Funcionário salvo.')
      setForm({ nome: '', email: '', senha: '', cargo: 'atendente' })
      await carregar()
    }

    setSaving(false)
  }

  async function alterarFuncionario(id: string, data: Record<string, any>) {
    setErro('')
    setMessage('')

    const res = await fetch('/api/company/team', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...data }),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao alterar funcionário.')
    } else {
      setMessage('Funcionário atualizado.')
      await carregar()
    }
  }

  async function removerFuncionario(id: string) {
    const ok = window.confirm('Remover este funcionário? Ele perderá o acesso à empresa.')
    if (!ok) return

    const res = await fetch(`/api/company/team?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao remover funcionário.')
    } else {
      setMessage('Funcionário removido.')
      await carregar()
    }
  }

  const activeCount = members.filter((member) => member.status === 'ativo').length

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando equipe...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">
                  Equipe e permissões
                </h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Cadastre funcionários sem perder seu acesso de dono/admin. Sim, uma ideia revolucionária: não se trancar para fora da própria casa.
                </p>
              </div>

              <div className="rounded-[2rem] bg-[#f5f8ff] p-5">
                <p className="text-sm font-black text-slate-500">Funcionários ativos</p>
                <p className="mt-1 text-4xl font-black text-[#05245c]">{activeCount}/2</p>
              </div>
            </div>
          </div>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={criarFuncionario} className="h-fit rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Novo funcionário</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Cadastrar acesso</h2>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Nome</span>
                <input value={form.nome} onChange={(e) => setForm((v) => ({ ...v, nome: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">E-mail</span>
                <input value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Senha inicial</span>
                <input value={form.senha} onChange={(e) => setForm((v) => ({ ...v, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">Cargo</span>
                <select value={form.cargo} onChange={(e) => setForm((v) => ({ ...v, cargo: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none">
                  <option value="gerente">Gerente</option>
                  <option value="atendente">Atendente</option>
                  <option value="producao">Produção</option>
                </select>
              </label>

              <div className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="font-black text-[#071b3a]">{cargoLabel[form.cargo]}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{cargoDescricao[form.cargo]}</p>
              </div>

              <button disabled={saving || activeCount >= 2} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                {saving ? 'Salvando...' : activeCount >= 2 ? 'Limite atingido' : 'Criar funcionário'}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Equipe atual</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Funcionários cadastrados</h2>

            <div className="mt-6 grid gap-3">
              {members.map((member) => (
                <article key={member.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black">{member.nome}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${member.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : member.status === 'bloqueado' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'}`}>
                          {member.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">{member.email}</p>
                      <p className="mt-2 text-sm font-black text-[#05245c]">{cargoLabel[member.cargo] || member.cargo}</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{cargoDescricao[member.cargo] || 'Permissões personalizadas.'}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px]">
                      <select value={member.cargo} onChange={(e) => alterarFuncionario(member.id, { cargo: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold outline-none">
                        <option value="gerente">Gerente</option>
                        <option value="atendente">Atendente</option>
                        <option value="producao">Produção</option>
                      </select>
                      <button onClick={() => alterarFuncionario(member.id, { status: member.status === 'ativo' ? 'bloqueado' : 'ativo' })} className="rounded-xl bg-blue-50 px-3 py-3 text-sm font-black text-[#05245c]">
                        {member.status === 'ativo' ? 'Bloquear' : 'Ativar'}
                      </button>
                      <button onClick={() => removerFuncionario(member.id)} className="rounded-xl bg-red-50 px-3 py-3 text-sm font-black text-red-700">
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {members.length === 0 && (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-[#f5f8ff] p-10 text-center">
                  <p className="text-2xl font-black">Nenhum funcionário cadastrado</p>
                  <p className="mt-2 font-bold text-slate-500">Quando salvar, ele aparece aqui na hora.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
