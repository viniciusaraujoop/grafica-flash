'use client'
import {useActionState} from 'react'
import {manageWealthDebt} from '@/app/apps/wealth/dividas/actions'
import {moneyInputValue} from '@/lib/wealth/core'
import type {DebtEntry} from '@/lib/wealth/debt'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default function WealthDebtForm({entry,token,today}:{entry?:DebtEntry;token?:string;today:string}){
 const [state,action,pending]=useActionState(manageWealthDebt,{ok:false,message:''})
 const terms=entry?.terms
 return <form action={action} aria-label={entry?'Editar dívida':'Nova dívida'}>
 <input type="hidden" name="operation" value="save"/><input type="hidden" name="idempotency_key" value={token??''}/>
 {entry&&<><input type="hidden" name="entry_id" value={entry.id}/><input type="hidden" name="version" value={entry.version}/></>}
 <fieldset className={styles.formGrid} disabled={pending}>
 <label>Nome da dívida<input name="title" defaultValue={entry?.title} required maxLength={160}/></label>
 <label>Saldo atual (R$)<input name="balance" defaultValue={entry?moneyInputValue(entry.amount_cents):undefined} inputMode="decimal" required/></label>
 <label>Principal original (R$)<input name="principal" defaultValue={moneyInputValue(terms?.principal_cents??entry?.amount_cents??0)} inputMode="decimal" required/></label>
 <label>Juros fixos ao mês (%)<input name="monthly_rate" defaultValue={moneyInputValue(terms?.monthly_rate_bps??0)} inputMode="decimal" required/></label>
 <label>Pagamento mínimo mensal (R$)<input name="minimum" defaultValue={moneyInputValue(terms?.minimum_cents??0)} inputMode="decimal" required/></label>
 <label>Total de parcelas (opcional)<input name="installment_count" defaultValue={terms?.installment_count??''} type="number" min="1" max="1200"/></label>
 <label>Parcelas restantes (opcional)<input name="remaining_installments" defaultValue={terms?.remaining_installments??''} type="number" min="0" max="1200"/></label>
 <label>Próximo vencimento (opcional)<input name="next_due_date" defaultValue={terms?.next_due_date??''} type="date" min="1900-01-01" max="2200-12-31"/></label>
 <label>Prioridade na minha ordem<input name="priority" defaultValue={terms?.priority??1} type="number" min="1" max="1000" required/></label>
 <label>Data do saldo declarado<input name="financial_date" defaultValue={entry?.financial_date??today} type="date" min="1900-01-01" max="2200-12-31" required/></label>
 <label className={styles.confirmation}><input name="confirmed" value="yes" type="checkbox" required/>Confirmo os valores declarados. Salvar não faz pagamentos.</label>
 <button className={styles.primaryButton}>{pending?'Salvando…':'Salvar dívida'}</button>
 </fieldset>{state.message&&<p role="status" className={styles.notice}>{state.message}</p>}
 </form>
}

export function WealthDebtPayoff({entry}:{entry:DebtEntry}){
 const [state,action,pending]=useActionState(manageWealthDebt,{ok:false,message:''})
 return <form action={action} aria-label="Declarar quitação">
 <input type="hidden" name="operation" value="settle"/><input type="hidden" name="entry_id" value={entry.id}/><input type="hidden" name="version" value={entry.version}/>
 <fieldset disabled={pending}><label><input type="checkbox" name="confirmed" value="yes" required/>Confirmo que esta dívida foi quitada fora do Orçaly. O saldo será zerado.</label><button className={styles.primaryButton}>{pending?'Confirmando…':'Declarar quitação'}</button></fieldset>
 {state.message&&<p role="status" className={styles.notice}>{state.message}</p>}
 </form>
}
