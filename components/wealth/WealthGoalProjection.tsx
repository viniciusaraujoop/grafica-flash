'use client'
import {useState} from 'react'
import {formatFinancialDate,formatMoney,parseMoney,type WealthGoal} from '@/lib/wealth/core'
import {healthLabels,projectGoal} from '@/lib/wealth/planning'
import styles from './calendar.module.css'
export default function WealthGoalProjection({goal,today}:{goal:WealthGoal;today:string}){
 const [alternative,setAlternative]=useState('')
 const p=projectGoal(goal,today)
 let scenario:ReturnType<typeof projectGoal>|null=null,error=''
 if(alternative)try{scenario=projectGoal(goal,today,parseMoney(alternative))}catch{error='Use um valor com até duas casas decimais.'}
 return <section className={styles.section} aria-labelledby="goal-projection">
  <div className={styles.toolbar}><h2 id="goal-projection">Seu caminho até a meta</h2><span className={styles.tag}>{healthLabels[p.health]}</span></div>
  <progress className={styles.progress} value={Math.min(goal.saved_cents,goal.target_cents)} max={Math.max(1,goal.target_cents)} aria-label="Progresso declarado da meta"/>
  <dl className={styles.stats}>
   <div><dt>Objetivo</dt><dd>{formatMoney(goal.target_cents)}</dd></div>
   <div><dt>Já reservado · declarado</dt><dd>{formatMoney(goal.saved_cents)}</dd></div>
   <div><dt>Falta reservar</dt><dd>{formatMoney(p.remaining)}</dd></div>
   <div><dt>Aporte mensal planejado</dt><dd>{formatMoney(goal.monthly_contribution_cents)}</dd></div>
   <div><dt>Conclusão pelo plano atual</dt><dd>{p.projectedDate?formatFinancialDate(p.projectedDate):p.months?'Além do horizonte de 2200':'Sem estimativa'}</dd></div>
   <div><dt>Aporte necessário até {formatFinancialDate(goal.target_date)}</dt><dd>{p.required===null?'Rever prazo':formatMoney(p.required)}<small>Cálculo de planejamento, não recomendação de investimento.</small></dd></div>
  </dl>
  <p>{p.explanation}</p><p className={styles.muted}>{p.assumption}</p>
  <div className={styles.notice}><label>E se eu reservar outro valor por mês? (R$)<input value={alternative} onChange={e=>setAlternative(e.target.value)} inputMode="decimal" placeholder="Ex.: 500,00" maxLength={16}/></label>
   <p role="status" aria-live="polite">{error|| (scenario?scenario.projectedDate?`Simulação alternativa: ${formatFinancialDate(scenario.projectedDate)}. Este valor não foi salvo.`:'Este aporte não produz uma data dentro do horizonte de 2200.':'Digite um aporte para comparar, sem alterar sua meta.')}</p>
  </div>
 </section>
}
