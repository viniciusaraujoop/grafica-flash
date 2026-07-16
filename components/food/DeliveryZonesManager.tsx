'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentCompanyClient } from '@/lib/current-company-client'
import {
  AlertMessage,
  EmptyState,
  LoadingState,
  StatusBadge,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  inputClass,
  integerFromInput,
  labelClass,
  money,
  normalizeText,
  numberFromInput,
  panelClass,
} from '@/components/food/food-shared'

type DeliveryZone = {
  id: string
  company_id: string
  name: string
  fee: number | null
  minimum_order: number | null
  estimated_time_min: number | null
  estimated_time_max: number | null
  is_active: boolean | null
  notes: string | null
  created_at?: string | null
  updated_at?: string | null
}

type DeliveryZoneForm = {
  name: string
  fee: string
  minimum_order: string
  estimated_time_min: string
  estimated_time_max: string
  is_active: boolean
  notes: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

const emptyForm: DeliveryZoneForm = {
  name: '',
  fee: '',
  minimum_order: '',
  estimated_time_min: '',
  estimated_time_max: '',
  is_active: true,
  notes: '',
}

function formFromZone(zone: DeliveryZone): DeliveryZoneForm {
  return {
    name: zone.name || '',
    fee: String(zone.fee ?? ''),
    minimum_order: String(zone.minimum_order ?? ''),
    estimated_time_min: String(zone.estimated_time_min ?? ''),
    estimated_time_max: String(zone.estimated_time_max ?? ''),
    is_active: zone.is_active !== false,
    notes: zone.notes || '',
  }
}

function estimatedTime(zone: DeliveryZone) {
  const min = zone.estimated_time_min
  const max = zone.estimated_time_max

  if (min && max) return `${min}-${max} min`
  if (min) return `${min} min`
  if (max) return `até ${max} min`

  return 'Não definido'
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="min-w-0 rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 truncate text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{value}</p>
      <p className="mt-2 text-sm font-bold leading-5 text-slate-500">{detail}</p>
    </article>
  )
}

export default function DeliveryZonesManager() {
  const [companyId, setCompanyId] = useState('')
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [form, setForm] = useState<DeliveryZoneForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)

  async function loadZones(companyRef?: string) {
    setLoading(true)
    setError('')

    try {
      const currentCompanyId = companyRef || companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      const { data, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('id, company_id, name, fee, minimum_order, estimated_time_min, estimated_time_max, is_active, notes, created_at, updated_at')
        .eq('company_id', currentCompanyId)
        .order('name', { ascending: true })

      if (zonesError) throw zonesError

      setZones((data || []) as DeliveryZone[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar taxas de entrega.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadZones()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateForm(field: keyof DeliveryZoneForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  function startCreate() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    window.setTimeout(() => document.getElementById('taxa-entrega-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function startEdit(zone: DeliveryZone) {
    setEditingId(zone.id)
    setForm(formFromZone(zone))
    setShowForm(true)
    window.setTimeout(() => document.getElementById('taxa-entrega-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function validateForm() {
    const name = normalizeText(form.name)
    const fee = numberFromInput(form.fee)
    const minimumOrder = numberFromInput(form.minimum_order)
    const estimatedMin = form.estimated_time_min === '' ? null : integerFromInput(form.estimated_time_min)
    const estimatedMax = form.estimated_time_max === '' ? null : integerFromInput(form.estimated_time_max)

    if (!name) return 'Informe a região ou bairro.'
    if (fee < 0) return 'A taxa não pode ser negativa.'
    if (minimumOrder < 0) return 'O pedido mínimo não pode ser negativo.'
    if (estimatedMin !== null && estimatedMin < 0) return 'O tempo mínimo não pode ser negativo.'
    if (estimatedMax !== null && estimatedMax < 0) return 'O tempo máximo não pode ser negativo.'
    if (estimatedMin !== null && estimatedMax !== null && estimatedMax < estimatedMin) return 'O tempo máximo não pode ser menor que o tempo mínimo.'

    return ''
  }

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const validation = validateForm()
      if (validation) throw new Error(validation)

      const currentCompanyId = companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      const payload = {
        company_id: currentCompanyId,
        name: normalizeText(form.name),
        fee: numberFromInput(form.fee),
        minimum_order: numberFromInput(form.minimum_order),
        estimated_time_min: form.estimated_time_min === '' ? null : integerFromInput(form.estimated_time_min),
        estimated_time_max: form.estimated_time_max === '' ? null : integerFromInput(form.estimated_time_max),
        is_active: form.is_active,
        notes: normalizeText(form.notes) || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('delivery_zones')
          .update(payload)
          .eq('id', editingId)
          .eq('company_id', currentCompanyId)

        if (updateError) throw updateError
        setMessage('Taxa de entrega atualizada com sucesso.')
      } else {
        const { error: insertError } = await supabase
          .from('delivery_zones')
          .insert(payload)

        if (insertError) throw insertError
        setMessage('Taxa de entrega cadastrada com sucesso.')
      }

      resetForm()
      await loadZones(currentCompanyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar taxa de entrega.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleZone(zone: DeliveryZone) {
    if (!companyId) return
    setMessage('')
    setError('')

    const { error: toggleError } = await supabase
      .from('delivery_zones')
      .update({ is_active: zone.is_active === false, updated_at: new Date().toISOString() })
      .eq('id', zone.id)
      .eq('company_id', companyId)

    if (toggleError) {
      setError(toggleError.message)
      return
    }

    setMessage(zone.is_active === false ? 'Região ativada.' : 'Região inativada.')
    await loadZones(companyId)
  }

  async function deleteZone(zone: DeliveryZone) {
    if (!companyId) return
    const confirmed = window.confirm(`Excluir a taxa de ${zone.name}?`)
    if (!confirmed) return

    setMessage('')
    setError('')

    const { error: deleteError } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', zone.id)
      .eq('company_id', companyId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage('Taxa de entrega excluída.')
    if (editingId === zone.id) resetForm()
    await loadZones(companyId)
  }

  const stats = useMemo(() => {
    const fees = zones.map((zone) => Number(zone.fee || 0)).filter((fee) => Number.isFinite(fee))

    return {
      total: zones.length,
      active: zones.filter((zone) => zone.is_active !== false).length,
      minFee: fees.length ? Math.min(...fees) : 0,
      maxFee: fees.length ? Math.max(...fees) : 0,
    }
  }, [zones])

  const visibleZones = useMemo(() => {
    const term = search.trim().toLowerCase()
    return zones.filter((zone) => {
      const matchesSearch = !term || `${zone.name} ${zone.notes || ''}`.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && zone.is_active !== false)
        || (statusFilter === 'inactive' && zone.is_active === false)
      return matchesSearch && matchesStatus
    })
  }, [zones, search, statusFilter])

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl min-w-0 space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-28 h-36 w-36 rounded-full bg-emerald-100 blur-3xl" />
            <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação de entrega</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">📍 Taxas de entrega</h1>
                <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Configure bairros, regiões, valores, pedido mínimo e tempo estimado para suas entregas.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={startCreate} className={buttonPrimary}>Nova taxa</button>
                <button type="button" onClick={() => loadZones()} className={buttonSecondary}>Atualizar</button>
              </div>
            </div>
          </div>
        </header>

        {message ? <AlertMessage type="success">{message}</AlertMessage> : null}
        {error ? <AlertMessage type="error">{error}</AlertMessage> : null}

        {loading ? (
          <LoadingState title="Carregando taxas de entrega..." description="Buscando regiões cadastradas no Supabase." />
        ) : (
          <>
            <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Regiões cadastradas" value={stats.total} detail="Bairros ou áreas cadastradas." />
              <StatCard label="Regiões ativas" value={stats.active} detail="Disponíveis para entrega." />
              <StatCard label="Menor taxa" value={money(stats.minFee)} detail="Valor mais baixo cadastrado." />
              <StatCard label="Maior taxa" value={money(stats.maxFee)} detail="Valor mais alto cadastrado." />
            </section>

            <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
              <div className="min-w-0 space-y-5">
                <section className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 sm:p-5">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="grid gap-2 text-sm font-black text-[#071b3a]">
                      Buscar bairro/região
                      <input value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="Ex: Centro, Pajuçara..." />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-[#071b3a]">
                      Status
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={inputClass}>
                        <option value="all">Todas</option>
                        <option value="active">Ativas</option>
                        <option value="inactive">Inativas</option>
                      </select>
                    </label>
                  </div>
                </section>

                <form id="taxa-entrega-form" onSubmit={saveZone} className={`${panelClass} ${showForm ? 'block' : 'hidden xl:block'}`}>
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Cadastro</p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{editingId ? 'Editar taxa' : 'Nova taxa'}</h2>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Use valores claros para o checkout calcular a entrega sem depender de conversa no WhatsApp.</p>
                    </div>
                    {editingId || showForm ? <button type="button" onClick={resetForm} className={buttonSecondary}>Fechar</button> : null}
                  </div>

                  <div className="mt-5 grid min-w-0 gap-4">
                    <label className={labelClass}>Região/Bairro<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={inputClass} placeholder="Ex: Centro, Massagueira, Pajuçara" /></label>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <label className={labelClass}>Valor da taxa<input type="number" min="0" step="0.01" value={form.fee} onChange={(event) => updateForm('fee', event.target.value)} className={inputClass} placeholder="0,00" /></label>
                      <label className={labelClass}>Pedido mínimo<input type="number" min="0" step="0.01" value={form.minimum_order} onChange={(event) => updateForm('minimum_order', event.target.value)} className={inputClass} placeholder="0,00" /></label>
                    </div>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <label className={labelClass}>Tempo mínimo<input type="number" min="0" value={form.estimated_time_min} onChange={(event) => updateForm('estimated_time_min', event.target.value)} className={inputClass} placeholder="30" /></label>
                      <label className={labelClass}>Tempo máximo<input type="number" min="0" value={form.estimated_time_max} onChange={(event) => updateForm('estimated_time_max', event.target.value)} className={inputClass} placeholder="60" /></label>
                    </div>
                    <label className={labelClass}>Observações<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className={`${inputClass} min-h-24 resize-none`} placeholder="Ex: entrega apenas até a praça principal." /></label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-black"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} />Ativo para checkout</label>
                    <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar taxa'}</button>
                  </div>
                </form>
              </div>

              <section className="min-w-0 space-y-4">
                {visibleZones.length === 0 ? (
                  <EmptyState title="Nenhuma taxa de entrega cadastrada." description="Cadastre bairros ou regiões para organizar suas entregas." />
                ) : (
                  <>
                    <div className="hidden min-w-0 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 lg:block">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px] text-left text-sm">
                          <thead className="bg-[#f5f8ff] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            <tr>
                              <th className="px-5 py-4">Região/Bairro</th>
                              <th className="px-5 py-4">Taxa</th>
                              <th className="px-5 py-4">Pedido mínimo</th>
                              <th className="px-5 py-4">Tempo</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Observações</th>
                              <th className="px-5 py-4">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-50">
                            {visibleZones.map((zone) => (
                              <tr key={zone.id} className="align-top">
                                <td className="max-w-[210px] px-5 py-5 font-black text-[#071b3a]">{zone.name}</td>
                                <td className="px-5 py-5 font-black text-[#05245c]">{money(zone.fee)}</td>
                                <td className="px-5 py-5 font-bold text-slate-600">{money(zone.minimum_order)}</td>
                                <td className="px-5 py-5 font-bold text-slate-600">{estimatedTime(zone)}</td>
                                <td className="px-5 py-5"><StatusBadge active={zone.is_active !== false} /></td>
                                <td className="max-w-[240px] px-5 py-5 font-bold leading-6 text-slate-500">{zone.notes || 'Sem observação'}</td>
                                <td className="px-5 py-5">
                                  <div className="grid min-w-[170px] grid-cols-2 gap-2">
                                    <button type="button" onClick={() => startEdit(zone)} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c]">Editar</button>
                                    <button type="button" onClick={() => toggleZone(zone)} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c]">{zone.is_active === false ? 'Ativar' : 'Inativar'}</button>
                                    <button type="button" onClick={() => deleteZone(zone)} className="col-span-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Excluir</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-4 lg:hidden">
                      {visibleZones.map((zone) => (
                        <article key={zone.id} className={`${cardClass} min-w-0 overflow-hidden`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge active={zone.is_active !== false} />
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{money(zone.fee)}</span>
                          </div>
                          <h3 className="mt-4 break-words text-2xl font-black tracking-[-0.04em]">{zone.name}</h3>
                          <div className="mt-4 grid min-w-0 gap-3 text-sm font-bold text-slate-500">
                            <p><span className="text-slate-400">Pedido mínimo:</span> {money(zone.minimum_order)}</p>
                            <p><span className="text-slate-400">Tempo estimado:</span> {estimatedTime(zone)}</p>
                            <p><span className="text-slate-400">Status:</span> {zone.is_active !== false ? 'Ativo' : 'Inativo'}</p>
                          </div>
                          {zone.notes ? <p className="mt-4 break-words rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">{zone.notes}</p> : null}
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => startEdit(zone)} className={buttonSecondary}>Editar</button>
                            <button type="button" onClick={() => toggleZone(zone)} className={buttonSecondary}>{zone.is_active === false ? 'Ativar' : 'Inativar'}</button>
                            <button type="button" onClick={() => deleteZone(zone)} className={`${buttonDanger} col-span-2`}>Excluir</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
