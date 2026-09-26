'use client'
import {useActionState,useState,type ReactNode} from 'react'
import {managePortfolio} from '@/app/apps/wealth/carteiras/actions'
import shared from '@/components/ecosystem/ecosystem.module.css'
import styles from './portfolio.module.css'

export default function PortfolioForm({operation,token,label,ids={},children}:{operation:string;token:string;label:string;ids?:Record<string,string|number>;children:ReactNode}){
 const [state,action,pending]=useActionState(managePortfolio,{ok:false,message:''})
 // Keep one command receipt through revalidation. A new operation requires reopening.
 const [commandToken]=useState(token)
 return <form action={action} aria-label={label} className={styles.form}>
  <input type="hidden" name="operation" value={operation}/><input type="hidden" name="idempotency_key" value={commandToken}/>
  {Object.entries(ids).map(([name,value])=><input type="hidden" key={name} name={name} value={value}/>)}
  <fieldset disabled={pending||state.ok}><legend>{label}</legend><div className={styles.fields}>{children}</div>
   <label className={styles.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Conferi os dados desta operação.</label>
   <button className={shared.primaryButton}>{pending?'Confirmando…':label}</button>
  </fieldset>{state.message&&<p role="status">{state.message}{state.ok&&<> <a href="">Iniciar outra operação</a></>}</p>}
 </form>
}
