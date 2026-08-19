'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import { crmStages, leadTemperatureFrom, leadTemperatureLabels } from '@/lib/operations-experience'

type Lead = {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  origem?: string | null
  etapa?: string | null
  status?: string | null
  valor_estimado?: number | null
  proximo_contato_em?: string | null
  observacoes?: string | null
  tags?: string[] | null
  order_id?: string | null
  proposal_id?: string | null
  created_by?: string | null
  updated_at?: string | null
}

type Task = {
  id: string
  crm_lead_id?: string | null
  titulo?: string | null
  descricao?: string | null
  status?: string | null
  prioridade?: string | null
  due_at?: string | null
  responsavel_id?: string | null
}

const emptyForm = {
  nome: '', telefone: '', email: '', origem: 'manual', etapa: 'novo_lead', valor_estimado: '', proximo_contato_em: '', observacoes: '', tags: '',
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateLabel(value?: string | null) {
  if (!value) return 'Sem retorno definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem retorno definido'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function whatsappLink(phone?: string | null, name?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return '#'
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(`Olá${name ? `, ${name}` : ''}! Tudo bem? Estou entrando em contato sobre seu atendimento no Orçaly.`)}`
}

function temperatureClass(value: ReturnType<typeof leadTemperatureFrom>) {
  if (value === 'hot') return 'bg-red-50 text-red-700 ring-red-100'
  if (value === 'warm') return 'bg-amber-50 text-amber-700 ring-amber-100'
  return 'bg-blue-50 text-blue-700 ring-blue-100'
}

export default function CrmWorkspaceV2() {
  const [token, setToken] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [moving, setMoving] = useState('')
  const [dragged, setDragged] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [taskForm, setTaskForm] = useState({ titulo: '', due_at: '', prioridade: 'media' })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)
      const [leadsResponse, tasksResponse] = await Promise.all([
        fetch('/api/crm/leads?status=ativo', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
        fetch('/api/tasks?status=todos', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }),
      ])
      const leadsPayload = await leadsResponse.json().catch(() => ({}))
      const tasksPayload = await tasksResponse.json().catch(() => ({}))
      if (!leadsResponse.ok) throw new Error(leadsPayload.error || 'Erro ao carregar CRM.')
      setLeads(leadsPayload.leads || [])
      if (tasksResponse.ok) setTasks(tasksPayload.tasks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRM.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((lead) => [lead.nome, lead.telefone, lead.email, lead.origem, ...(lead.tags || [])].join(' ').toLowerCase().includes(q))
  }, [leads, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>()
    crmStages.forEach((stage) => map.set(stage.id, []))
    visibleLeads.forEach((lead) => {
      const key = lead.etapa || 'novo_lead'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(lead)
    })
    return map
  }, [visibleLeads])

  const nextTaskByLead = useMemo(() => {
    const map = new Map<string, Task>()
    tasks
      .filter((task) => task.crm_lead_id && !['concluido', 'concluida', 'concluído', 'done', 'cancelado'].includes(String(task.status || '').toLowerCase()))
      .sort((a, b) => String(a.due_at || '9999').localeCompare(String(b.due_at || '9999')))
      .forEach((task) => { if (task.crm_lead_id && !map.has(task.crm_lead_id)) map.set(task.crm_lead_id, task) })
    return map
  }, [tasks])

  const metrics = useMemo(() => {
    const open = leads.filter((lead) => !['fechado', 'perdido', 'recorrente'].includes(lead.etapa || '')).length
    const hot = leads.filter((lead) => leadTemperatureFrom(lead) === 'hot').length
    const pipeline = leads.filter((lead) => !['perdido'].includes(lead.etapa || '')).reduce((sum, lead) => sum + Number(lead.valor_estimado || 0), 0)
    const late = leads.filter((lead) => lead.proximo_contato_em && new Date(lead.proximo_contato_em).getTime() < Date.now() && !['fechado', 'perdido'].includes(lead.etapa || '')).length
    return { open, hot, pipeline, late }
  }, [leads])

  async function createLead(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/crm/leads', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor_estimado: Number(form.valor_estimado || 0), proximo_contato_em: form.proximo_contato_em || null, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao criar lead.')
      setForm(emptyForm); setShowCreate(false); setMessage(payload.reused ? 'Contato existente atualizado no CRM.' : 'Lead criado com sucesso.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao criar lead.') } finally { setSaving(false) }
  }

  async function moveLead(id: string, etapa: string) {
    const previous = leads.find((lead) => lead.id === id)
    if (!previous || previous.etapa === etapa) return
    setMoving(id); setError(''); setMessage('')
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, etapa } : lead))
    try {
      const response = await fetch(`/api/crm/leads/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ etapa }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao mover lead.')
      setLeads((current) => current.map((lead) => lead.id === id ? payload.lead : lead))
      if (selected?.id === id) setSelected(payload.lead)
      setMessage('Etapa comercial atualizada.')
    } catch (err) {
      setLeads((current) => current.map((lead) => lead.id === id ? previous : lead))
      setError(err instanceof Error ? err.message : 'Erro ao mover lead.')
    } finally { setMoving('') }
  }

  async function updateSelected(patch: Partial<Lead>) {
    if (!selected) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/crm/leads/${selected.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao atualizar lead.')
      setSelected(payload.lead)
      setLeads((current) => current.map((lead) => lead.id === selected.id ? payload.lead : lead))
      setMessage('Lead atualizado.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao atualizar lead.') } finally { setSaving(false) }
  }

  async function createNextAction(event: FormEvent) {
    event.preventDefault()
    if (!selected || !taskForm.titulo.trim()) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: taskForm.titulo.trim(), due_at: taskForm.due_at || null, prioridade: taskForm.prioridade, crm_lead_id: selected.id, descricao: `Próxima ação do lead ${selected.nome}` }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao criar próxima ação.')
      setTasks((current) => [...current, payload.task]); setTaskForm({ titulo: '', due_at: '', prioridade: 'media' }); setMessage('Próxima ação criada e conectada ao lead.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao criar próxima ação.') } finally { setSaving(false) }
  }

  return (
    <main className="text-[#10233f]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,0.06)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#4776ad]">CRM 2.0</span><h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Quem precisa de resposta e qual venda vem depois.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">O funil agora conecta contato, próxima ação, proposta e pedido. Temperatura é calculada por regras simples e transparentes.</p></div>
          <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#082f61]">+ Novo lead</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 lg:grid-cols-4">
          <CrmMetric label="Leads ativos" value={metrics.open.toLocaleString('pt-BR')} /><CrmMetric label="Quentes" value={metrics.hot.toLocaleString('pt-BR')} /><CrmMetric label="Retornos atrasados" value={metrics.late.toLocaleString('pt-BR')} /><CrmMetric label="Valor em oportunidades" value={money(metrics.pipeline)} />
        </div>
      </section>

      {message ? <div role="status" className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
      {error ? <div role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><span className="pl-2 text-slate-300" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lead, telefone, e-mail, origem ou tag..." className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold outline-none" /><Link href="/painel/follow-up" className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Follow-up</Link></div>

      {loading ? <div className="mt-4 grid grid-cols-4 gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[1.25rem] bg-slate-100" />)}</div> : (
        <div className="mt-4 overflow-x-auto pb-3">
          <div className="grid min-w-max auto-cols-[285px] grid-flow-col gap-3">
            {crmStages.map((stage) => {
              const stageLeads = grouped.get(stage.id) || []
              return (
                <section key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) void moveLead(dragged, stage.id); setDragged('') }} className="w-[285px] rounded-[1.25rem] border border-slate-200 bg-[#f7f9fc] p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1 py-1"><h3 className="text-sm font-extrabold text-slate-700">{stage.label}</h3><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{stageLeads.length}</span></div>
                  <div className="grid gap-2">
                    {stageLeads.map((lead) => {
                      const temperature = leadTemperatureFrom(lead)
                      const nextTask = nextTaskByLead.get(lead.id)
                      return (
                        <article key={lead.id} draggable={moving !== lead.id} onDragStart={() => setDragged(lead.id)} className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md ${moving === lead.id ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-2"><button type="button" onClick={() => setSelected(lead)} className="min-w-0 truncate text-left text-sm font-extrabold text-slate-800 hover:text-[#174e93]">{lead.nome}</button><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ring-1 ${temperatureClass(temperature)}`}>{leadTemperatureLabels[temperature]}</span></div>
                          <p className="mt-1 truncate text-xs font-medium text-slate-500">{lead.telefone || lead.email || 'Sem contato'}</p>
                          <div className="mt-3 flex items-center justify-between gap-2"><strong className="text-sm text-[#174e93]">{money(lead.valor_estimado)}</strong><span className="text-[10px] font-bold text-slate-400">{lead.origem || 'manual'}</span></div>
                          <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-slate-500">{nextTask?.titulo ? <>Próxima: <strong className="text-slate-700">{nextTask.titulo}</strong>{nextTask.due_at ? ` · ${dateLabel(nextTask.due_at)}` : ''}</> : lead.proximo_contato_em ? <>Contato: <strong className="text-slate-700">{dateLabel(lead.proximo_contato_em)}</strong></> : 'Sem próxima ação definida.'}</div>
                          {(lead.tags || []).length ? <div className="mt-2 flex flex-wrap gap-1">{(lead.tags || []).slice(0, 3).map((tag) => <span key={tag} className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">{tag}</span>)}</div> : null}
                          <select aria-label={`Mover ${lead.nome}`} value={lead.etapa || 'novo_lead'} disabled={moving === lead.id} onChange={(event) => void moveLead(lead.id, event.target.value)} className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none md:hidden">{crmStages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
                        </article>
                      )
                    })}
                    {!stageLeads.length ? <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 text-center text-xs font-semibold text-slate-400">Nenhum lead nesta etapa.</div> : null}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {showCreate ? <LeadCreateDrawer form={form} setForm={setForm} saving={saving} onClose={() => setShowCreate(false)} onSubmit={createLead} /> : null}
      {selected ? <LeadDetailDrawer lead={selected} nextTask={nextTaskByLead.get(selected.id)} taskForm={taskForm} setTaskForm={setTaskForm} saving={saving} onClose={() => setSelected(null)} onUpdate={updateSelected} onCreateTask={createNextAction} /> : null}
    </main>
  )
}

function CrmMetric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-3.5"><span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{label}</span><strong className="mt-1 block truncate text-lg font-bold text-[#10233f]">{value}</strong></div> }

function LeadCreateDrawer({ form, setForm, saving, onClose, onSubmit }: { form: typeof emptyForm; setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  return <Drawer title="Novo lead" subtitle="Registre somente o necessário. O restante pode ser enriquecido durante o atendimento." onClose={onClose}><form onSubmit={onSubmit} className="grid gap-3"><Field label="Nome"><input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="WhatsApp"><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field><Field label="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Etapa"><select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>{crmStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></Field><Field label="Valor estimado"><input type="number" min="0" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} /></Field></div><Field label="Próximo contato"><input type="datetime-local" value={form.proximo_contato_em} onChange={(e) => setForm({ ...form, proximo_contato_em: e.target.value })} /></Field><Field label="Tags"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, gráfica, indicação" /></Field><Field label="Observações"><textarea rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field><button disabled={saving} className="mt-2 rounded-xl bg-[#0b3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Criar lead'}</button></form></Drawer>
}

function LeadDetailDrawer({ lead, nextTask, taskForm, setTaskForm, saving, onClose, onUpdate, onCreateTask }: { lead: Lead; nextTask?: Task; taskForm: { titulo: string; due_at: string; prioridade: string }; setTaskForm: React.Dispatch<React.SetStateAction<{ titulo: string; due_at: string; prioridade: string }>>; saving: boolean; onClose: () => void; onUpdate: (patch: Partial<Lead>) => Promise<void>; onCreateTask: (event: FormEvent) => Promise<void> }) {
  const temp = leadTemperatureFrom(lead)
  const [notes, setNotes] = useState(lead.observacoes || '')
  const [nextContact, setNextContact] = useState(lead.proximo_contato_em ? new Date(lead.proximo_contato_em).toISOString().slice(0, 16) : '')
  return <Drawer title={lead.nome} subtitle={`${lead.origem || 'Origem manual'} · ${leadTemperatureLabels[temp]}`} onClose={onClose}>
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2"><Info label="Contato" value={lead.telefone || lead.email || 'Não informado'} /><Info label="Oportunidade" value={money(lead.valor_estimado)} /><Info label="Último estado" value={crmStages.find((stage) => stage.id === lead.etapa)?.label || lead.etapa || 'Novo lead'} /><Info label="Próxima ação" value={nextTask?.titulo || 'Não definida'} /></div>
      <div className="flex flex-wrap gap-2">{lead.telefone ? <a href={whatsappLink(lead.telefone, lead.nome)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Abrir WhatsApp</a> : null}{lead.order_id ? <Link href={`/painel/pedidos/${lead.order_id}`} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Ver pedido</Link> : null}{lead.proposal_id ? <Link href={`/painel/proposta/${lead.proposal_id}`} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Ver proposta</Link> : null}</div>
      <section className="rounded-xl border border-slate-200 p-3"><h4 className="text-sm font-extrabold">Próximo contato</h4><div className="mt-2 flex gap-2"><input type="datetime-local" value={nextContact} onChange={(e) => setNextContact(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none" /><button type="button" disabled={saving} onClick={() => void onUpdate({ proximo_contato_em: nextContact || null })} className="rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700">Salvar</button></div></section>
      <form onSubmit={(event) => void onCreateTask(event)} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3"><h4 className="text-sm font-extrabold text-[#174e93]">Criar próxima ação</h4><input value={taskForm.titulo} onChange={(e) => setTaskForm({ ...taskForm, titulo: e.target.value })} placeholder="Ex.: cobrar aprovação" className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-xs font-semibold outline-none" /><div className="mt-2 grid grid-cols-[1fr_110px] gap-2"><input type="datetime-local" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} className="h-10 rounded-lg border border-blue-100 bg-white px-2 text-[11px] font-semibold outline-none" /><select value={taskForm.prioridade} onChange={(e) => setTaskForm({ ...taskForm, prioridade: e.target.value })} className="rounded-lg border border-blue-100 bg-white px-2 text-[11px] font-bold"><option value="baixa">Baixa</option><option value="media">Normal</option><option value="alta">Alta</option><option value="urgente">Crítica</option></select></div><button disabled={saving || !taskForm.titulo.trim()} className="mt-2 w-full rounded-lg bg-[#0b3b78] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Adicionar à Central do Dia</button></form>
      <section><label className="text-xs font-extrabold text-slate-500">Notas internas</label><textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm font-medium outline-none focus:border-blue-300" /><button type="button" disabled={saving} onClick={() => void onUpdate({ observacoes: notes })} className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Salvar notas</button></section>
    </div>
  </Drawer>
}

function Drawer({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[115] bg-[#03132d]/45 backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><aside role="dialog" aria-modal="true" aria-label={title} className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white shadow-[-20px_0_60px_rgba(3,19,45,0.2)] motion-safe:animate-[orcaly-drawer-in_200ms_ease-out_both]"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur"><div><h3 className="text-xl font-bold tracking-[-0.03em] text-[#10233f]">{title}</h3><p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500">×</button></header><div className="p-5">{children}</div><style jsx global>{`@keyframes orcaly-drawer-in { from { opacity:.5; transform:translateX(16px) } to { opacity:1; transform:none } } @media (prefers-reduced-motion: reduce) { aside { animation:none !important } }`}</style></aside></div> }
function Field({ label, children }: { label: string; children: React.ReactElement }) { return <label className="grid gap-1.5 text-xs font-extrabold text-slate-500">{label}<span className="[&>input]:h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:px-3 [&>input]:text-sm [&>input]:font-medium [&>input]:outline-none [&>select]:h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-200 [&>select]:px-3 [&>select]:text-sm [&>select]:font-medium [&>textarea]:w-full [&>textarea]:resize-none [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-slate-200 [&>textarea]:p-3 [&>textarea]:text-sm [&>textarea]:font-medium [&>textarea]:outline-none">{children}</span></label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">{label}</span><strong className="mt-1 block text-sm text-slate-700">{value}</strong></div> }
