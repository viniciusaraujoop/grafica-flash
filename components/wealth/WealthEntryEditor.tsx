'use client'

import { useActionState } from 'react'
import { updateWealthEntry } from '@/app/apps/wealth/lancamentos/actions'
import { moneyInputValue, wealthCategories, type WealthEntry } from '@/lib/wealth/core'
import { entryKindLabels } from '@/lib/wealth/records'
import styles from '@/components/ecosystem/ecosystem.module.css'

const categories: Record<string, string> = { salary: 'Renda', housing: 'Moradia', food: 'Alimentação', transport: 'Transporte', education: 'Educação', health: 'Saúde', leisure: 'Lazer', investment: 'Investimentos', property: 'Patrimônio', loan: 'Dívidas', other: 'Outros' }

export default function WealthEntryEditor({ entry, revision }: { entry: WealthEntry; revision: string }) {
  const [state, action, pending] = useActionState(updateWealthEntry, { ok: false, message: '' })
  return <form action={action}>
    <input type="hidden" name="entry_id" value={entry.id} />
    <input type="hidden" name="expected_revision" value={revision} />
    <fieldset disabled={pending} className={styles.formGrid}>
      <label>Nome do lançamento<input name="title" defaultValue={entry.title} maxLength={160} required /></label>
      <label>Tipo<select name="kind" defaultValue={entry.kind}>{Object.entries(entryKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Valor (R$)<input name="amount" inputMode="decimal" defaultValue={moneyInputValue(entry.amount_cents)} required /></label>
      <label>Data financeira<input name="financial_date" type="date" min="1900-01-01" max="2200-12-31" defaultValue={entry.financial_date} required /></label>
      <label>Categoria<select name="category" defaultValue={entry.category}>{wealthCategories.map(value => <option key={value} value={value}>{categories[value]}</option>)}</select></label>
      <label>Recorrência declarada<select name="recurrence" defaultValue={entry.recurrence}><option value="none">Sem recorrência</option><option value="monthly">Mensal (referência)</option><option value="yearly">Anual (referência)</option></select></label>
      <button className={styles.primaryButton} type="submit">{pending ? 'Salvando…' : 'Salvar alterações'}</button>
    </fieldset>
    {state.message && <p role="status" aria-live="polite" className={styles.notice}>{state.message}</p>}
    <a className={styles.textButton} href={`/apps/wealth/lancamentos/${entry.id}`}>Reabrir versão atual</a>
  </form>
}
