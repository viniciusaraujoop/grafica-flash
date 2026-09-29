'use client'
import {useActionState} from 'react'
import Link from 'next/link'
import {manageProtection} from '@/app/apps/wealth/shield/actions'
import {protectionCategories,premiumPeriods,type ProtectionPolicy,type ShieldOptions} from '@/lib/wealth/shield'
import {moneyInputValue} from '@/lib/wealth/core'
import s from './calendar.module.css'
export function WealthProtectionForm({operation,token,policy,options}:{operation:'save'|'archive'|'restore';token:string;policy?:ProtectionPolicy;options?:ShieldOptions}){
 const [state,action,pending]=useActionState(manageProtection,{ok:false,message:''}),money=(v:string|null|undefined)=>v===null||v===undefined?'':moneyInputValue(Number(v))
 const label=operation==='save'?(policy?'Salvar alterações':'Registrar seguro declarado'):operation==='archive'?'Arquivar registro':'Restaurar registro'
 return <form action={action} aria-label={label} data-protection-operation={operation}><fieldset disabled={pending} key={policy?.version}>
 <input type="hidden" name="operation" value={operation}/><input type="hidden" name="idempotency_key" value={token}/>{policy&&<><input type="hidden" name="id" value={policy.id}/><input type="hidden" name="version" value={policy.version}/></>}
 {operation==='save'&&<div className={s.fields}>
 <label>Nome do registro<input name="title" maxLength={160} required defaultValue={policy?.title}/></label><label>Tipo de proteção<select name="category" defaultValue={policy?.category??'other'}>{Object.entries(protectionCategories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Seguradora informada<input name="insurer" maxLength={120} defaultValue={policy?.insurer}/></label><label>Referência da apólice<input name="reference" maxLength={160} defaultValue={policy?.reference}/></label>
 <label>Cobertura nominal informada (R$)<input name="coverage" inputMode="decimal" placeholder="Desconhecida" defaultValue={money(policy?.coverage_cents)}/></label><label>Franquia informada (R$)<input name="deductible" inputMode="decimal" placeholder="Desconhecida" defaultValue={money(policy?.deductible_cents)}/></label>
 <label>Prêmio informado (R$)<input name="premium" inputMode="decimal" placeholder="Desconhecido" defaultValue={money(policy?.premium_cents)}/></label><label>Periodicidade do prêmio<select name="premium_period" defaultValue={policy?.premium_period??'unknown'}>{Object.entries(premiumPeriods).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label>Início informado<input name="starts_on" type="date" min="1900-01-01" max="2200-12-31" defaultValue={policy?.starts_on??''}/></label><label>Fim informado<input name="ends_on" type="date" min="1900-01-01" max="2200-12-31" defaultValue={policy?.ends_on??''}/></label>
 <label>Situação declarada<select name="status" defaultValue={policy?.status??'declared'}><option value="declared">Sem cancelamento informado</option><option value="cancelled">Cancelamento informado por mim</option></select></label>
 {options&&([['asset_id','Bem relacionado','assets'],['document_id','Documento privado','documents'],['schedule_id','Conta recorrente relacionada','schedules']] as const).map(([key,text,list])=><label key={key}>{text}<select name={key} defaultValue={policy?.[key]??''}><option value="">Sem vínculo</option>{policy?.[key]&&!options[list].some(o=>o.id===policy[key])&&<option value={policy[key]!}>Vínculo anterior indisponível — remova para salvar</option>}{options[list].map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>)}
 <label>Observações e condições declaradas<textarea name="notes" maxLength={2000} defaultValue={policy?.notes}/></label>
 </div>}
 <label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Confirmo esta alteração no meu registro. Ela não contrata, cancela, renova ou paga um seguro.</label><button className={s.button}>{pending?'Salvando…':label}</button>
 </fieldset><p role="status" className={s.status}>{state.message}</p>{state.ok&&state.id&&!policy&&<Link href={`/apps/wealth/shield?id=${state.id}`}>Abrir registro salvo</Link>}</form>
}
