import Link from 'next/link'
import {formatMoney} from '@/lib/wealth/core'
import {sourceLabels,type PlanningLink,type PlanningOption} from '@/lib/wealth/planning'
import styles from './calendar.module.css'
export default function WealthPlanningLinks({links,options}:{links:PlanningLink[];options:PlanningOption[]}){
 return <>{links.length?<ul className={styles.agenda}>{links.map((l,i)=>{
  const record=options.find(o=>o.id===l.id&&o.kind===l.kind)
  return <li key={i} className={styles.bill}><p>{sourceLabels[l.kind]}{l.id?' · ':''}{record?<Link href={record.href}>{record.title}</Link>:l.id?'Referência indisponível — revise o vínculo':''}</p>
   {l.planned_cents!==undefined&&<p>Valor planejado da fonte: {formatMoney(l.planned_cents)}. Não adicionado ao reservado ou ao aporte mensal.</p>}
   {record?.amount&&<p className={styles.muted}>Referência atual: {formatMoney(record.amount)} ({l.kind==='goal'?'objetivo da meta':l.kind==='debt'?'passivo declarado':l.kind==='recurring'?'valor por ocorrência':'receita declarada'}). Não somada ao funding.</p>}
  </li>
 })}</ul>:<p>Nenhuma referência vinculada. Você pode definir fontes quando editar o planejamento.</p>}
 <p className={styles.muted}>Referências podem se sobrepor entre metas e carteiras. Nenhum vínculo transfere, bloqueia ou soma recursos; o valor reservado continua sendo sua declaração.</p></>
}
