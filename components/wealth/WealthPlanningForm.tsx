'use client'
import {useActionState,useState} from 'react'
import {savePlanning} from '@/app/apps/wealth/planejamento/actions'
import {moneyInputValue} from '@/lib/wealth/core'
import {eventTypes,planStatuses,scenarios,sourceLabels,planningCategories,type GoalFunding,type LifePlan,type PlanningLink,type PlanningOption} from '@/lib/wealth/planning'
import styles from './calendar.module.css'

type PlanningFormProps={goal?:{id:string;version:number;funding:GoalFunding|null};plan?:LifePlan;options:PlanningOption[];token:string;today:string}
export default function WealthPlanningForm(props:PlanningFormProps){
 const [state,action,pending]=useActionState(savePlanning,{ok:false,message:''})
 return <form action={action}>
  <PlanningFields key={props.goal?.version??props.plan?.version??props.token} {...props} pending={pending}/>
  {state.message&&<p role="status" aria-live="polite" className={styles.status}>{state.message}</p>}
 </form>
}
function PlanningFields({goal,plan,options,token,today,pending}:PlanningFormProps&{pending:boolean}){
 const initial=goal?.funding?.sources??plan?.links??[]
 const [links,setLinks]=useState<PlanningLink[]>(initial)
 const allowed=goal?['recurring','portfolio','income']:['goal','debt','portfolio']
 const filtered=options.filter(o=>allowed.includes(o.kind))
 const money=(name:string,label:string,value:number|null=0)=><label key={name}>{label}<input name={name} inputMode="decimal" defaultValue={value===null?'':moneyInputValue(value)} maxLength={16}/></label>
 return <fieldset disabled={pending}>
  <input type="hidden" name="operation" value={goal?'funding':'life'}/><input type="hidden" name="idempotency_key" value={token}/>
  {(goal||plan)&&<><input type="hidden" name="id" value={goal?.id??plan?.id}/><input type="hidden" name="version" value={goal?.version??plan?.version}/></>}
   <div className={styles.fields}>
    {goal?<>
     <label>Prioridade<select name="priority" defaultValue={goal.funding?.priority??'normal'}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
     <label>Categoria do orçamento<select name="category" defaultValue={goal.funding?.category??''}><option value="">Sem vínculo</option>{Object.entries(planningCategories).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </>:<>
     <label>Nome do plano<input name="title" required maxLength={160} defaultValue={plan?.title}/></label>
     <label>Evento<select name="event_type" defaultValue={plan?.event_type??'house'}>{Object.entries(eventTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Data desejada<input name="target_date" type="date" required min="1900-01-01" max="2200-12-31" defaultValue={plan?.target_date??today}/></label>
     <label>Cenário simulado<select name="scenario" defaultValue={plan?.scenario??'BASE'}>{Object.entries(scenarios).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>Status do plano<select name="status" defaultValue={plan?.status??'draft'}>{Object.entries(planStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     {money('upfront','Custo inicial estimado (R$)',plan?.upfront_cents)}
     {money('monthly_impact','Custo mensal adicional (R$)',plan?.monthly_impact_cents)}
     <label>Meses de custo adicional<input name="impact_months" type="number" min={0} max={600} required defaultValue={plan?.impact_months??12}/></label>
     {money('current_funding','Já destinado ao custo inicial (R$)',plan?.current_funding_cents)}
     {money('monthly_capacity','Capacidade mensal antes do evento (R$)',plan?.monthly_capacity_cents)}
     {money('reserve','Reserva disponível declarada (R$) · opcional',plan?.reserve_cents??null)}
     {money('reserve_draw','Parcela da reserva a usar (R$)',plan?.reserve_draw_cents)}
    </>}
   </div>
   {!goal&&<><p className={styles.muted}>A reserva a usar já deve estar incluída no valor destinado. Os campos não serão somados entre si. Cada cenário usa os valores que você informar, sem multiplicadores automáticos.</p><label>Premissas do cenário<textarea name="assumptions" required maxLength={2000} defaultValue={plan?.assumptions} placeholder="Ex.: custo estimado por orçamento; renda constante; nenhum financiamento contratado."/></label></>}
   <h3 className={styles.subheading}>{goal?'Fontes de funding':'Registros relacionados'}</h3>
   <p className={styles.muted}>Até 20 referências. Os seletores mostram até 100 registros ativos por tipo, além dos já vinculados. Vínculos não reservam dinheiro e podem aparecer em outros planos.</p>
   {links.map((link,i)=>{
    const value=link.kind?`${link.kind}${link.id?'|'+link.id:''}`:''
    const unavailable=Boolean(link.id&&!filtered.some(o=>o.kind===link.kind&&o.id===link.id))
    return <div className={styles.sourceRow} key={i}>
     <label>Fonte {i+1}<select name={`source_${i}`} value={value} onChange={e=>{const [kind,id]=e.target.value.split('|');setLinks(links.map((l,j)=>j===i?{...l,kind:kind as PlanningLink['kind'],id:id||null}:l))}}>
      <option value="">Sem fonte</option>{goal&&<><option value="manual">Aporte manual planejado</option><option value="budget_surplus">Sobra do orçamento</option></>}
      {unavailable&&<option value={value}>Referência indisponível · remova ou substitua</option>}
      {filtered.map(o=><option value={`${o.kind}|${o.id}`} key={`${o.kind}|${o.id}`}>{sourceLabels[o.kind]} · {o.title}</option>)}
     </select></label>
     {goal&&<label>Valor planejado da fonte {i+1} (R$)<input name={`planned_${i}`} inputMode="decimal" defaultValue={moneyInputValue(Number(link.planned_cents||0))}/></label>}
     <button type="button" className={styles.button} onClick={()=>setLinks(links.map((l,j)=>j===i?{kind:'' as PlanningLink['kind']}:l))}>Limpar fonte {i+1}</button>
    </div>
   })}
   {links.length<20&&<button type="button" className={styles.button} onClick={()=>setLinks([...links,{kind:'' as PlanningLink['kind']}])}>Adicionar referência</button>}
   <label className={styles.subheading}>Notas<textarea name="notes" maxLength={2000} defaultValue={goal?.funding?.notes??plan?.notes??''}/></label>
   <label className={styles.confirm}><input type="checkbox" name="confirmed" value="yes" required/>Confirmo que estes dados são de planejamento e não movimentam dinheiro.</label>
   <button type="submit" className={styles.button}>{pending?'Salvando…':goal?'Salvar funding':'Salvar plano de vida'}</button>
 </fieldset>
}
