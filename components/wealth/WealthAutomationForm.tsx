'use client'
import {useActionState} from 'react'
import {manageAutomation} from '@/app/apps/wealth/automacoes/actions'
import type {AutomationOverview} from '@/lib/wealth/automation'
import s from './calendar.module.css'
type Operation='configure'|'run'|'pause'|'resume'|'cancel'|'retry'
const labels:Record<Operation,string>={configure:'Salvar preferências',run:'Executar lote agora',pause:'Pausar agendamento',resume:'Retomar agendamento',cancel:'Cancelar agendamento',retry:'Autorizar nova tentativa'}
export function WealthAutomationForm({operation,token,id,version,attempts,preferences}:{operation:Operation;token:string;id?:string;version?:number;attempts?:number;preferences?:AutomationOverview['preferences']}){
 const [state,action,pending]=useActionState(manageAutomation,{ok:false,message:''})
 return <form action={action} data-automation-operation={operation}><fieldset disabled={pending} key={version}>
 <input type="hidden" name="operation" value={operation}/><input type="hidden" name="idempotency_key" value={token}/>{id&&<input type="hidden" name="id" value={id}/>}{version!==undefined&&<input type="hidden" name="version" value={version}/>}{attempts!==undefined&&<input type="hidden" name="attempts" value={attempts}/>}
 {operation==='configure'&&preferences&&<><label>Período padrão do histórico<select name="history_days" defaultValue={preferences.history_days}>{[7,30,90,365].map(d=><option key={d} value={d}>{d} dias</option>)}</select></label><label className={s.confirm}><input type="checkbox" name="show_inactive" value="yes" defaultChecked={preferences.show_inactive}/>Mostrar agendamentos concluídos e cancelados por padrão</label></>}
 <label className={s.confirm}><input name="confirmed" type="checkbox" value="yes" required/>{operation==='run'?'Confirmo a execução de até 10 pendências próprias vencidas. Isso gera declarações, sem pagamentos.':operation==='cancel'?'Confirmo o cancelamento definitivo deste agendamento, preservando os registros anteriores.':operation==='resume'?'Confirmo a retomada, incluindo datas vencidas.':operation==='retry'?'Revisei o agendamento e autorizo nova tentativa deste trabalho, mantendo o histórico de tentativas.':'Confirmo esta alteração.'}</label><button className={s.button}>{pending?'Processando…':labels[operation]}</button></fieldset><p className={s.status} role="status">{state.message}</p></form>
}
