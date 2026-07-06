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
  labelClass,
  normalizeText,
  panelClass,
} from '@/components/food/food-shared'

type PaymentMethodType = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'delivery_card' | 'online' | 'other'

type PaymentMethod = {
  id: string
  company_id: string
  name: string
  type: PaymentMethodType | string
  is_active: boolean | null
  requires_change: boolean | null
  allow_delivery_payment: boolean | null
  allow_online_payment: boolean | null
  instructions: string | null
  created_at?: string | null
  updated_at?: string | null
}

type PaymentForm = {
  name: string
  type: PaymentMethodType
  is_active: boolean
  requires_change: boolean
  allow_delivery_payment: boolean
  allow_online_payment: boolean
  instructions: string
}

const typeOptions: Array<{ value: PaymentMethodType; label: string }> = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'delivery_card', label: 'Cartão na entrega' },
  { value: 'online', label: 'Link externo' },
  { value: 'other', label: 'Outro' },
]

const typeLabels = Object.fromEntries(typeOptions.map((option) => [option.value, option.label])) as Record<PaymentMethodType, string>

const emptyForm: PaymentForm = {
  name: '',
  type: 'pix',
  is_active: true,
  requires_change: false,
  allow_delivery_payment: true,
  allow_online_payment: false,
  instructions: '',
}

function formFromMethod(method: PaymentMethod): PaymentForm {
  const type = typeOptions.some((option) => option.value === method.type) ? method.type as PaymentMethodType : 'other'

  return {
    name: method.name || '',
    type,
    is_active: method.is_active !== false,
    requires_change: Boolean(method.requires_change),
    allow_delivery_payment: method.allow_delivery_payment !== false,
    allow_online_payment: method.allow_online_payment === true,
    instructions: method.instructions || '',
  }
}

function labelForType(type: string) {
  return typeLabels[type as PaymentMethodType] || 'Outro'
}

export default function PaymentMethodsManager() {
  const [companyId, setCompanyId] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [form, setForm] = useState<PaymentForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadMethods(companyRef?: string) {
    setLoading(true)
    setError('')

    try {
      const currentCompanyId = companyRef || companyId || (await getCurrentCompanyClient()).company.id
      setCompanyId(currentCompanyId)

      const { data, error: methodsError } = await supabase
        .from('payment_methods')
        .select('id, company_id, name, type, is_active, requires_change, allow_delivery_payment, allow_online_payment, instructions, created_at, updated_at')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false })

      if (methodsError) throw methodsError

      setMethods((data || []) as PaymentMethod[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar formas de pagamento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMethods()
    }, 0)

    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateForm(field: keyof PaymentForm, value: string | boolean) {
    setForm((current) => {
      if (field === 'type') {
        const typedValue = value as PaymentMethodType
        const shouldReplaceName = !current.name.trim() || typeOptions.some((option) => option.label === current.name)
        return { ...current, type: typedValue, name: shouldReplaceName ? labelForType(typedValue) : current.name }
      }

      return { ...current, [field]: value }
    })
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function validateForm() {
    if (!normalizeText(form.name)) return 'Informe o nome da forma de pagamento.'
    if (!typeOptions.some((option) => option.value === form.type)) return 'Tipo de pagamento inválido.'
    return ''
  }

  async function saveMethod(event: FormEvent<HTMLFormElement>) {
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
        type: form.type,
        is_active: form.is_active,
        requires_change: form.requires_change,
        allow_delivery_payment: form.allow_delivery_payment,
        allow_online_payment: form.allow_online_payment,
        instructions: normalizeText(form.instructions) || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('payment_methods')
          .update(payload)
          .eq('id', editingId)
          .eq('company_id', currentCompanyId)

        if (updateError) throw updateError
        setMessage('Forma de pagamento atualizada com sucesso.')
      } else {
        const { error: insertError } = await supabase
          .from('payment_methods')
          .insert(payload)

        if (insertError) throw insertError
        setMessage('Forma de pagamento cadastrada com sucesso.')
      }

      resetForm()
      await loadMethods(currentCompanyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar forma de pagamento.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleMethod(method: PaymentMethod) {
    if (!companyId) return
    setMessage('')
    setError('')

    const { error: toggleError } = await supabase
      .from('payment_methods')
      .update({ is_active: method.is_active === false, updated_at: new Date().toISOString() })
      .eq('id', method.id)
      .eq('company_id', companyId)

    if (toggleError) {
      setError(toggleError.message)
      return
    }

    setMessage(method.is_active === false ? 'Forma de pagamento ativada.' : 'Forma de pagamento inativada.')
    await loadMethods(companyId)
  }

  async function deleteMethod(method: PaymentMethod) {
    if (!companyId) return
    const confirmed = window.confirm(`Excluir ${method.name}?`)
    if (!confirmed) return

    setMessage('')
    setError('')

    const { error: deleteError } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', method.id)
      .eq('company_id', companyId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage('Forma de pagamento excluída.')
    if (editingId === method.id) resetForm()
    await loadMethods(companyId)
  }

  const stats = useMemo(() => ({
    total: methods.length,
    active: methods.filter((method) => method.is_active !== false).length,
    delivery: methods.filter((method) => method.allow_delivery_payment !== false).length,
    online: methods.filter((method) => method.allow_online_payment === true).length,
  }), [methods])

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Operação Food</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Formas de pagamento</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Cadastre Pix, dinheiro, cartão e regras de pagamento por empresa. Dados reais, salvos no Supabase, sem teatro de botão decorativo.</p>
            </div>
            <button type="button" onClick={() => loadMethods()} className={buttonPrimary}>Atualizar</button>
          </div>
        </header>

        {message ? <AlertMessage type="success">{message}</AlertMessage> : null}
        {error ? <AlertMessage type="error">{error}</AlertMessage> : null}

        {loading ? (
          <LoadingState title="Carregando formas de pagamento..." description="Buscando opções cadastradas no Supabase." />
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total</p><p className="mt-3 text-3xl font-black">{stats.total}</p><p className="mt-2 text-sm font-bold text-slate-500">Formas cadastradas.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ativas</p><p className="mt-3 text-3xl font-black">{stats.active}</p><p className="mt-2 text-sm font-bold text-slate-500">Disponíveis para uso.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Na entrega</p><p className="mt-3 text-3xl font-black">{stats.delivery}</p><p className="mt-2 text-sm font-bold text-slate-500">Aceitam pagamento presencial.</p></article>
              <article className={cardClass}><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Online</p><p className="mt-3 text-3xl font-black">{stats.online}</p><p className="mt-2 text-sm font-bold text-slate-500">Links externos ou combinados.</p></article>
            </section>

            <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <form onSubmit={saveMethod} className={panelClass}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.04em]">{editingId ? 'Editar forma' : 'Nova forma'}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Defina tipo, instruções e disponibilidade para pagamento na entrega ou link externo.</p>
                  </div>
                  {editingId ? <button type="button" onClick={resetForm} className={buttonSecondary}>Cancelar</button> : null}
                </div>

                <div className="mt-5 grid gap-4">
                  <label className={labelClass}>Tipo<select value={form.type} onChange={(event) => updateForm('type', event.target.value as PaymentMethodType)} className={inputClass}>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className={labelClass}>Nome<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className={inputClass} placeholder="Ex: Pix da loja, Dinheiro, Cartão" /></label>
                  <label className={labelClass}>Instruções<textarea value={form.instructions} onChange={(event) => updateForm('instructions', event.target.value)} className={`${inputClass} min-h-28 resize-none`} placeholder="Ex: Enviar comprovante pelo WhatsApp." /></label>
                  <div className="grid gap-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} />Ativo</label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={form.allow_delivery_payment} onChange={(event) => updateForm('allow_delivery_payment', event.target.checked)} />Aceita pagamento na entrega</label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={form.allow_online_payment} onChange={(event) => updateForm('allow_online_payment', event.target.checked)} />Aceita link externo</label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black"><input type="checkbox" checked={form.requires_change} onChange={(event) => updateForm('requires_change', event.target.checked)} />Precisa de troco</label>
                  </div>
                  <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar forma'}</button>
                </div>
              </form>

              <section className="space-y-4">
                {methods.length === 0 ? (
                  <EmptyState title="Nenhuma forma de pagamento cadastrada." description="Cadastre Pix, dinheiro, cartão ou outras opções para seus clientes." />
                ) : (
                  methods.map((method) => (
                    <article key={method.id} className={cardClass}>
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge active={method.is_active !== false} />
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{labelForType(method.type)}</span>
                            {method.allow_delivery_payment !== false ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Na entrega</span> : null}
                            {method.allow_online_payment ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Link externo</span> : null}
                            {method.requires_change ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Troco</span> : null}
                          </div>
                          <h3 className="mt-4 text-2xl font-black tracking-[-0.04em]">{method.name}</h3>
                          <div className="mt-4 grid gap-3 text-sm font-bold text-slate-500 md:grid-cols-2">
                            <p><span className="text-slate-400">Tipo:</span> {labelForType(method.type)}</p>
                            <p><span className="text-slate-400">Status:</span> {method.is_active !== false ? 'Ativo' : 'Inativo'}</p>
                            <p><span className="text-slate-400">Pagamento na entrega:</span> {method.allow_delivery_payment !== false ? 'Sim' : 'Não'}</p>
                            <p><span className="text-slate-400">Link externo:</span> {method.allow_online_payment ? 'Sim' : 'Não'}</p>
                          </div>
                          {method.instructions ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">{method.instructions}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          <button type="button" onClick={() => { setEditingId(method.id); setForm(formFromMethod(method)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={buttonSecondary}>Editar</button>
                          <button type="button" onClick={() => toggleMethod(method)} className={buttonSecondary}>{method.is_active === false ? 'Ativar' : 'Inativar'}</button>
                          <button type="button" onClick={() => deleteMethod(method)} className={buttonDanger}>Excluir</button>
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
