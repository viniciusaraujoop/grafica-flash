'use client'
import {useActionState} from 'react'
import {manageWealthRecurrence} from '@/app/apps/wealth/recorrencias/actions'
import type {WealthRecurrence} from '@/lib/wealth/recurrence'
import styles from '@/components/ecosystem/ecosystem.module.css'
export default function WealthRecurrenceControls({schedule}:{schedule?:WealthRecurrence}){
 const [state,action,pending]=useActionState(manageWealthRecurrence,{ok:false,message:''})
 if(schedule&&['completed','cancelled'].includes(schedule.status))return <p>Agendamento encerrado. Os lançamentos anteriores permanecem no histórico.</p>
 return <form action={action}>
 {schedule?<><input type="hidden" name="record_id" value={schedule.id}/><input type="hidden" name="version" value={schedule.version}/></>:<input type="hidden" name="operation" value="run"/>}
 <fieldset disabled={pending}>
 <label><input type="checkbox" name="confirmed" value="yes" required/> {schedule?'Confirmo a alteração. Retomar inclui datas vencidas; cancelar é definitivo.':'Confirmo a geração dos lançamentos vencidos dos meus agendamentos.'}</label>
 <div className={styles.actions}>{schedule?<><button className={styles.primaryButton} name="operation" value={schedule.status==='paused'?'resume':'pause'}>{pending?'Salvando…':schedule.status==='paused'?'Retomar':'Pausar'}</button><button className={styles.textButton} name="operation" value="cancel">Cancelar agendamento</button></>:<button className={styles.primaryButton}>{pending?'Atualizando…':'Atualizar lançamentos vencidos'}</button>}</div>
 </fieldset>{state.message&&<p role="status" aria-live="polite">{state.message}</p>}
 </form>
}
