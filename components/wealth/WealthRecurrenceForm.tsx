'use client'
import {useActionState} from 'react'
import {manageWealthRecurrence} from '@/app/apps/wealth/recorrencias/actions'
import {recurrenceFrequencies} from '@/lib/wealth/recurrence'
import styles from '@/components/ecosystem/ecosystem.module.css'
const categories={salary:'Renda',housing:'Moradia',food:'Alimentação',transport:'Transporte',education:'Educação',health:'Saúde',leisure:'Lazer',investment:'Aporte planejado',property:'Bem',loan:'Parcela de dívida',other:'Assinatura / outros'}

export default function WealthRecurrenceForm({idempotencyKey,today}:{idempotencyKey:string;today:string}){
 const [state,action,pending]=useActionState(manageWealthRecurrence,{ok:false,message:''})
 return <form action={action}>
 <input type="hidden" name="operation" value="create"/><input type="hidden" name="idempotency_key" value={idempotencyKey}/>
 <fieldset className={styles.formGrid} disabled={pending}>
 <label>Nome do agendamento<input name="title" required maxLength={160}/></label>
 <label>Movimento<select name="kind"><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
 <label>Valor por ocorrência (R$)<input name="amount" inputMode="decimal" required/></label>
 <label>Categoria<select name="category">{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Frequência<select name="frequency" defaultValue="monthly">{Object.entries(recurrenceFrequencies).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>A cada quantos períodos<input name="interval_count" type="number" min="1" max="36" defaultValue="1" required/></label>
 <label>Primeira data<input name="start_date" type="date" min="1900-01-01" max="2200-12-31" defaultValue={today} required/></label>
 <label>Última data (opcional)<input name="end_date" type="date" min="1900-01-01" max="2200-12-31"/></label>
 <label>Número de ocorrências (opcional)<input name="max_occurrences" type="number" min="1" max="1200"/></label>
 <label>Fuso do agendamento<select name="timezone" defaultValue="America/Sao_Paulo"><option value="America/Sao_Paulo">Brasília</option><option value="America/Manaus">Manaus</option><option value="America/Rio_Branco">Rio Branco</option><option value="America/Noronha">Fernando de Noronha</option><option value="America/New_York">Nova York</option><option value="Europe/Lisbon">Lisboa</option><option value="UTC">UTC</option></select></label>
 <label className={styles.confirmation}><input type="checkbox" name="confirmed" value="yes" required/>Autorizo gerar lançamentos declarados nas datas previstas, inclusive datas já vencidas.</label>
 <button className={styles.primaryButton} type="submit">{pending?'Salvando…':'Criar agendamento'}</button>
 </fieldset>{state.message&&<p role="status" aria-live="polite" className={styles.notice}>{state.message}</p>}
 </form>
}
