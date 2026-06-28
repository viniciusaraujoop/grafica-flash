'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

function formatDate(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function TarefasPage() {
  const [token, setToken] = useState('')
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media',
    due_at: '',
  })

  const grouped = useMemo(() => {
    return {
      pendente: tasks.filter((task) => task.status === 'pendente'),
      em_andamento: tasks.filter((task) => task.status === 'em_andamento'),
      concluida: tasks.filter((task) => task.status === 'concluida'),
    }
  }, [tasks])

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar tarefas.')

      setTasks(payload.tasks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function createTask(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          due_at: form.due_at || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao criar tarefa.')

      setMessage('Tarefa criada.')
      setForm({ titulo: '', descricao: '', prioridade: 'media', due_at: '' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa.')
    }

    setSaving(false)
  }

  async function updateTask(id: string, status: string) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error || 'Erro ao atualizar tarefa.')
      return
    }

    await load()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando tarefas...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Tarefas e lembretes</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Organize retornos, cobranças, produção e pendências internas sem depender daquele clássico sistema chamado “vou lembrar depois”, que nunca lembra.
          </p>
        </header>

        {message && <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <form onSubmit={createTask} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 xl:sticky xl:top-6 xl:self-start">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Nova tarefa</h2>
            <div className="mt-5 grid gap-3">
              <input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Título da tarefa" className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} placeholder="Descrição" rows={4} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <select value={form.prioridade} onChange={(event) => setForm({ ...form, prioridade: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
              <input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none focus:border-[#05245c]" />
              <button disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                {saving ? 'Criando...' : 'Criar tarefa'}
              </button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ['pendente', 'Pendentes', grouped.pendente],
              ['em_andamento', 'Em andamento', grouped.em_andamento],
              ['concluida', 'Concluídas', grouped.concluida],
            ].map(([status, title, list]) => (
              <section key={status as string} className="rounded-[2rem] border border-blue-100 bg-white/80 p-5 shadow-xl shadow-blue-950/5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black">{title as string}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{(list as any[]).length}</span>
                </div>
                <div className="grid gap-3">
                  {(list as any[]).map((task) => (
                    <article key={task.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4">
                      <p className="font-black">{task.titulo}</p>
                      {task.descricao && <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{task.descricao}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{task.prioridade}</span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{formatDate(task.due_at)}</span>
                      </div>
                      <select value={task.status} onChange={(event) => updateTask(task.id, event.target.value)} className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold outline-none">
                        <option value="pendente">Pendente</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </article>
                  ))}
                  {(list as any[]).length === 0 && <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-400">Nada aqui.</div>}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
