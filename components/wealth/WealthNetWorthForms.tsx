'use client'
import {useActionState} from 'react'
import {manageNetWorth} from '@/app/apps/wealth/patrimonio/actions'
import {assetClasses,liabilityClasses,liquidityLabels} from '@/lib/wealth/net-worth'
import styles from '@/components/ecosystem/ecosystem.module.css'

export function PositionClassification({entry}:{entry:{id:string;version:number;kind:'asset'|'liability';title:string;position_class:string|null;liquidity:string}}){
 const [state,action,pending]=useActionState(manageNetWorth,{ok:false,message:''})
 return <form action={action} aria-label={`Classificar ${entry.title}`}>
  <input name="operation" type="hidden" value="classify"/><input name="entry_id" type="hidden" value={entry.id}/><input name="version" type="hidden" value={entry.version}/>
  <fieldset className={styles.formGrid} disabled={pending}>
   <label>Classe<select name="position_class" defaultValue={entry.position_class??'unclassified'}><option value="unclassified">Não classificado</option>{Object.entries(entry.kind==='asset'?assetClasses:liabilityClasses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Liquidez declarada<select name="liquidity" defaultValue={entry.liquidity}>{Object.entries(liquidityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <button className={styles.primaryButton}>{pending?'Salvando…':'Salvar classificação'}</button>
  </fieldset>{state.message&&<p role="status" className={styles.notice}>{state.message}</p>}
 </form>
}
export function CaptureNetWorth({token}:{token:string}){
 const [state,action,pending]=useActionState(manageNetWorth,{ok:false,message:''})
 return <form action={action} aria-label="Registrar snapshot">
  <input name="operation" type="hidden" value="capture"/><input name="idempotency_key" type="hidden" value={token}/>
  <fieldset disabled={pending}><label className={styles.confirmation}><input type="checkbox" name="confirmed" value="yes" required/>Confirmo o registro dos valores declarados neste momento.</label><button className={styles.primaryButton}>{pending?'Registrando…':'Registrar snapshot'}</button></fieldset>
  {state.message&&<p role="status" className={styles.notice}>{state.message}</p>}
 </form>
}
