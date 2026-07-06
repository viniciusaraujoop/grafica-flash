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

export default function DeliveryZonesManager() {
  const [companyId, setCompanyId] = useState('')
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [form, setForm] = useState<DeliveryZoneForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação Food</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Taxas de entrega</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Cadastre bairros, regiões, valores, pedido mínimo e prazo estimado. Tudo salvo por empresa, como gente civilizada deveria ter feito desde o começo.</p>
            </div>
            <button type="button" onClick={() => loadZones()} className={buttonPrimary}>Atualizar</button>
          </div>
        </header>

        {message ? <AlertMessage type="success">{message}</AlertMessage> : null}
        {error ? <AlertMessage type="error">{error}</AlertMessage> : null}

        {loading ? (
          <LoadingState title="Carregando taxas de entrega..." description="Buscando regiões cadastradas no Supabase." />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total de regiões</p><p className="mt-3 text-3xl font-black">{stats.total}</p><p className="mt-2 text-sm font-bold text-slate-500">Bairros ou áreas cadastradas.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Regiões ativas</p><p className="mt-3 text-3xl font-black">{stats.active}</p><p className="mt-2 text-sm font-bold text-slate-500">Disponíveis para entrega.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Menor taxa</p><p className="mt-3 text-3xl font-black">{money(stats.minFee)}</p><p className="mt-2 text-sm font-bold text-slate-500">Valor mais baixo cadastrado.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Maior taxa</p><p className="mt-3 text-3xl font-black">{money(stats.maxFee)}</p><p className="mt-2 text-sm font-bold text-slate-500">Valor mais alto cadastrado.</p></article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form onSubmit={saveZone} className={panelClass}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.04em]">{editingId ? 'Editar taxa' : 'Nova taxa'}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">A região salva aqui já fica disponível para o controle de entregas.</p>
                  </div>
                  {editingId ? <button type="button" onClick={resetForm} className={buttonSecondary}>Cancelar</button> : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <label className={labelClass}>Região/bairro<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={inputClass} placeholder="Ex: Centro, Massagueira, Pajuçara" /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Valor da taxa<input type="number" min="0" step="0.01" value={form.fee} onChange={(event) => updateForm('fee', event.target.value)} className={inputClass} placeholder="0,00" /></label>
                    <label className={labelClass}>Pedido mínimo<input type="number" min="0" step="0.01" value={form.minimum_order} onChange={(event) => updateForm('minimum_order', event.target.value)} className={inputClass} placeholder="0,00" /></label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={labelClass}>Tempo mínimo estimado<input type="number" min="0" value={form.estimated_time_min} onChange={(event) => updateForm('estimated_time_min', event.target.value)} className={inputClass} placeholder="30" /></label>
                    <label className={labelClass}>Tempo máximo estimado<input type="number" min="0" value={form.estimated_time_max} onChange={(event) => updateForm('estimated_time_max', event.target.value)} className={inputClass} placeholder="60" /></label>
                  </div>
                  <label className={labelClass}>Observações<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className={`${inputClass} min-h-28 resize-none`} placeholder="Ex: Entrega só até a praça principal." /></label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} />Ativo</label>
                  <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar taxa'}</button>
                </div>
              </form>

              <section className="space-y-4">
                {zones.length === 0 ? (
                  <EmptyState title="Nenhuma taxa de entrega cadastrada." description="Cadastre bairros ou regiões para organizar suas entregas." />
                ) : (
                  zones.map((zone) => (
                    <article key={zone.id} className={cardClass}>
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge active={zone.is_active !== false} />
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{money(zone.fee)}</span>
                          </div>
                          <h3 className="mt-4 text-2xl font-black tracking-[-0.04em]">{zone.name}</h3>
                          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-500 md:grid-cols-2">
                            <p><span className="text-slate-400">Taxa:</span> {money(zone.fee)}</p>
                            <p><span className="text-slate-400">Pedido mínimo:</span> {money(zone.minimum_order)}</p>
                            <p><span className="text-slate-400">Tempo estimado:</span> {estimatedTime(zone)}</p>
                            <p><span className="text-slate-400">Status:</span> {zone.is_active !== false ? 'Ativo' : 'Inativo'}</p>
                          </div>
                          {zone.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">{zone.notes}</p> : null}
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <button type="button" onClick={() => { setEditingId(zone.id); setForm(formFromZone(zone)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={buttonSecondary}>Editar</button>
                          <button type="button" onClick={() => toggleZone(zone)} className={buttonSecondary}>{zone.is_active === false ? 'Ativar' : 'Inativar'}</button>
                          <button type="button" onClick={() => deleteZone(zone)} className={buttonDanger}>Excluir</button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
