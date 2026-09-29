import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {uuid,formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {projectLife,eventTypes,scenarios,planStatuses,type LifePlan} from '@/lib/wealth/planning'
import {planningOptions,planningToday} from '@/lib/wealth/planning-server'
import WealthPlanningForm from '@/components/wealth/WealthPlanningForm'
import WealthPlanningLinks from '@/components/wealth/WealthPlanningLinks'
import styles from '@/components/wealth/calendar.module.css'
export default async function LifePlanPage({params}:{params:Promise<{planId:string}>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Plano de vida</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 let id:string;try{id=uuid((await params).planId)}catch{notFound()}
 const {db,user}=read.identity
 const result=await db.from('wealth_life_plans').select('id,title,event_type,target_date,scenario,status,upfront_cents,monthly_impact_cents,impact_months,current_funding_cents,monthly_capacity_cents,reserve_cents,reserve_draw_cents,links,assumptions,notes,version').eq('user_id',user.id).eq('id',id).maybeSingle()
 if(result.error)throw Error('Não foi possível consultar este plano.');if(!result.data)notFound()
 const plan=result.data as LifePlan
 const [today,options]=await Promise.all([planningToday(db,user.id),planningOptions(db,user.id,plan.links)])
 const projection=projectLife(plan,today),p=projection.projection
 return <div className={styles.page}>
  <nav className={styles.nav} aria-label="Navegação do plano"><Link href="/apps/wealth/planejamento">← Planos de vida</Link><Link href="/apps/wealth/metas">Metas</Link></nav>
  <header className={styles.hero}><div><span className={styles.kicker}>Simulação · {scenarios[plan.scenario]}</span><h1>{plan.title}</h1><p>{eventTypes[plan.event_type]} · {planStatuses[plan.status]} · {formatFinancialDate(plan.target_date)}</p></div><aside>Premissas informadas: {plan.assumptions}</aside></header>
  <section className={styles.section}><h2>O tamanho do plano</h2><dl className={styles.stats}>
   <div><dt>Custo total estimado</dt><dd>{formatMoney(projection.cost)}<small>Inicial + {plan.impact_months} meses de custo adicional.</small></dd></div>
   <div><dt>Necessário no início</dt><dd>{formatMoney(plan.upfront_cents)}</dd></div>
   <div><dt>Já destinado · declarado</dt><dd>{formatMoney(plan.current_funding_cents)}</dd></div>
   <div><dt>Falta para o custo inicial</dt><dd>{formatMoney(projection.upfrontGap)}</dd></div>
   <div><dt>Falta para o custo total</dt><dd>{formatMoney(projection.costGap)}</dd></div>
   <div><dt>Impacto mensal adicional</dt><dd>{formatMoney(plan.monthly_impact_cents)}</dd></div>
   <div><dt>Capacidade mensal após o evento</dt><dd>{formatMoney(projection.monthlyAfter)}<small>Capacidade declarada − custo adicional; presume renda e outros gastos constantes.</small></dd></div>
   <div><dt>Reserva após uso planejado</dt><dd>{projection.remainingReserve===null?'Não informada':formatMoney(projection.remainingReserve)}<small>Reserva declarada − {formatMoney(plan.reserve_draw_cents)}. A parcela usada já integra o valor destinado.</small></dd></div>
   <div><dt>Custo inicial alcançado pelo ritmo planejado</dt><dd>{p.projectedDate?formatFinancialDate(p.projectedDate):'Sem data estimada'}<small>Aporte para a data desejada: {p.required===null?'rever prazo':formatMoney(p.required)}.</small></dd></div>
  </dl><p>{p.explanation}</p><p className={styles.muted}>{p.assumption}</p></section>
  <section className={styles.section}><h2>Impactos e escolhas</h2>
   <p>Metas: os valores reservados e aportes vinculados permanecem iguais. Se a capacidade após o evento for negativa, reveja custos, prazo ou aporte; não redistribuímos recursos automaticamente.</p>
   <p>Dívidas: nenhum novo crédito foi presumido. A falta de recursos é uma lacuna de financiamento, não uma dívida contratada; obrigações vinculadas continuam no seu passivo.</p>
   <p>Patrimônio: variação registrada agora é zero. Se todos os custos fossem despesas sem aquisição de ativos, a redução simulada seria {formatMoney(projection.cost)}. Este modelo não estima valorização de casa, carro, negócio ou retornos.</p>
   <p className={styles.notice}>O cenário {scenarios[plan.scenario].toLowerCase()} usa apenas suas premissas. Não há probabilidade atribuída, promessa de resultado ou recomendação financeira. Compare cenários criando outro plano com valores e premissas diferentes.</p>
  </section>
  <section className={styles.section}><h2>Metas, dívidas e carteiras relacionadas</h2><WealthPlanningLinks links={plan.links} options={options}/>{plan.notes&&<p>Notas: {plan.notes}</p>}</section>
  {write.allowed&&<details className={styles.details}><summary>Editar plano de vida</summary><WealthPlanningForm plan={plan} options={options} token={crypto.randomUUID()} today={today}/><Link href={`/apps/wealth/planejamento/${id}`}>Reabrir versão atual</Link></details>}
 </div>
}
