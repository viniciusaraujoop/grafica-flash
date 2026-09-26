'use client'
import {useActionState} from 'react'
import {saveBillDetails} from '@/app/apps/wealth/recorrencias/bill-actions'
import {billTypes,type Bill} from '@/lib/wealth/calendar'
import s from './calendar.module.css'
export default function WealthBillForm({bill,predecessors}:{bill:Bill;predecessors:{id:string;title:string}[]}){
 const [state,action,pending]=useActionState(saveBillDetails,{ok:false,message:''})
 return <form action={action} aria-label={`Classificar ${bill.title}`}><input type="hidden" name="id" value={bill.id}/><input type="hidden" name="version" value={bill.detail_version}/><fieldset disabled={pending}><div className={s.fields}>
  <label>Tipo de conta<select name="bill_type" defaultValue={bill.bill_type||(bill.kind==='income'?'income':'expense')}>{Object.entries(billTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label>Fornecedor ou referência<input name="provider" maxLength={120} defaultValue={bill.provider||''}/></label>
  <label>Versão anterior cancelada<select name="predecessor" defaultValue={bill.predecessor_id||''}><option value="">Sem vínculo comprovado</option>{predecessors.filter(p=>p.id!==bill.id).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}{bill.predecessor_id&&!predecessors.some(p=>p.id===bill.predecessor_id)&&<option value={bill.predecessor_id}>Vínculo atual</option>}</select></label>
 </div><p className={s.muted}>Vincule apenas a mesma conta, com movimento, frequência e intervalo iguais. O vínculo registra sua declaração; não compara consumo nem confirma cobrança. O seletor lista até 100 agendamentos cancelados.</p>
 <label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Revisei a classificação e confirmo o vínculo informado.</label><button className={s.button}>{pending?'Salvando…':'Salvar revisão'}</button></fieldset>{state.message&&<p className={s.status} role="status">{state.message}</p>}</form>
}
