'use client'
import {useActionState} from 'react'
import {manageAlert} from '@/app/apps/wealth/alertas/actions'
import {alertPriorities,alertSources,type WealthAlert,type WealthAlertsOverview} from '@/lib/wealth/alerts'
import styles from './calendar.module.css'
export function AlertPreferences({preferences,token}:{preferences:WealthAlertsOverview['preferences'];token:string}){
 const [state,action,pending]=useActionState(manageAlert,{ok:false,message:''})
 return <form action={action}><fieldset disabled={pending}><input type="hidden" name="operation" value="configure"/><input type="hidden" name="version" value={preferences.version}/><input type="hidden" name="idempotency_key" value={token}/><input type="hidden" name="confirmed" value="yes"/>
  <label className={styles.confirm}><input type="checkbox" name="enabled" value="yes" defaultChecked={preferences.enabled}/>Exibir alertas ativos</label>
  <label>Prioridade mínima<select name="minimum_priority" defaultValue={preferences.minimum_priority}>{Object.entries(alertPriorities).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Cooldown de entrega<select name="cooldown_hours" defaultValue={preferences.cooldown_hours}>{[1,6,12,24,48,72,168,720].map(h=><option key={h} value={h}>{h<24?`${h} h`:`${h/24} dia(s)`}</option>)}</select></label>
  <fieldset><legend>Silenciar fontes</legend>{Object.entries(alertSources).map(([k,v])=><label className={styles.confirm} key={k}><input type="checkbox" name="muted_source" value={k} defaultChecked={preferences.muted_sources.includes(k as keyof typeof alertSources)}/>{v}</label>)}</fieldset>
  <button className={styles.button}>Salvar preferências</button>
 </fieldset><p role="status" className={styles.status}>{pending?'Salvando…':state.message}</p></form>
}
export function AlertActions({alert,tokens}:{alert:WealthAlert;tokens:{dismiss:string;snooze:string;restore:string}}){
 const [dismissState,dismissAction,dismissPending]=useActionState(manageAlert,{ok:false,message:''})
 const [snoozeState,snoozeAction,snoozePending]=useActionState(manageAlert,{ok:false,message:''})
 const [restoreState,restoreAction,restorePending]=useActionState(manageAlert,{ok:false,message:''})
 if(alert.state==='dismissed'||alert.state==='snoozed')return <form action={restoreAction}><input type="hidden" name="operation" value="restore"/><input type="hidden" name="alert_key" value={alert.alert_key}/><input type="hidden" name="idempotency_key" value={tokens.restore}/><input type="hidden" name="confirmed" value="yes"/><button className={styles.button} disabled={restorePending}>Reativar</button><span role="status">{restoreState.message}</span></form>
 return <div className={styles.actions}><form action={snoozeAction}><input type="hidden" name="operation" value="snooze"/><input type="hidden" name="alert_key" value={alert.alert_key}/><input type="hidden" name="idempotency_key" value={tokens.snooze}/><input type="hidden" name="confirmed" value="yes"/><label>Adiar<select name="snooze_hours" defaultValue="24"><option value="24">1 dia</option><option value="72">3 dias</option><option value="168">7 dias</option><option value="720">30 dias</option></select></label><button className={styles.button} disabled={snoozePending}>Adiar</button><span role="status">{snoozeState.message}</span></form>
 <form action={dismissAction}><input type="hidden" name="operation" value="dismiss"/><input type="hidden" name="alert_key" value={alert.alert_key}/><input type="hidden" name="idempotency_key" value={tokens.dismiss}/><input type="hidden" name="confirmed" value="yes"/><button className={styles.button} disabled={dismissPending}>Dispensar enquanto esta condição existir</button><span role="status">{dismissState.message}</span></form></div>
}
