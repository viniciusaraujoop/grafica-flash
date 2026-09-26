'use client'
import { useActionState } from 'react'
import { changeWealthLifecycle } from '@/app/apps/wealth/lifecycle-actions'
import { moneyInputValue, type WealthGoal } from '@/lib/wealth/core'
import { goalStatuses } from '@/lib/wealth/lifecycle'
import styles from '@/components/ecosystem/ecosystem.module.css'
export default function WealthGoalEditor({goal}:{goal:WealthGoal}) {
 const [state,action,pending] = useActionState(changeWealthLifecycle,{ok:false,message:''})
 return <form action={action}>
  <input type="hidden" name="record_id" value={goal.id}/><input type="hidden" name="record_type" value="goal"/><input type="hidden" name="operation" value="edit"/><input type="hidden" name="version" value={goal.version}/>
  <fieldset className={styles.formGrid} disabled={pending}>
   <label>Nome da meta<input name="title" defaultValue={goal.title} maxLength={160} required/></label>
   <label>Objetivo (R$)<input name="target" inputMode="decimal" defaultValue={moneyInputValue(goal.target_cents)} required/></label>
   <label>Já reservado (R$)<input name="saved" inputMode="decimal" defaultValue={moneyInputValue(goal.saved_cents)} required/></label>
   <label>Aporte mensal planejado (R$)<input name="monthly_contribution" inputMode="decimal" defaultValue={moneyInputValue(goal.monthly_contribution_cents)} required/></label>
   <label>Data desejada<input name="target_date" type="date" min="1900-01-01" max="2200-12-31" defaultValue={goal.target_date} required/></label>
   <label>Status da meta<select name="status" defaultValue={goal.status}>{Object.entries(goalStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <button className={styles.primaryButton} type="submit">{pending?'Salvando…':'Salvar meta'}</button>
  </fieldset>{state.message&&<p role="status" aria-live="polite" className={styles.notice}>{state.message}</p>}
  <a className={styles.textButton} href={`/apps/wealth/metas/${goal.id}`}>Reabrir versão atual</a>
 </form>
}
