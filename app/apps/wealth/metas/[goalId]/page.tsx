import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {uuid,type WealthGoal} from '@/lib/wealth/core'
import type {GoalFunding} from '@/lib/wealth/planning'
import {planningOptions,planningToday} from '@/lib/wealth/planning-server'
import WealthGoalEditor from '@/components/wealth/WealthGoalEditor'
import WealthLifecycleControl from '@/components/wealth/WealthLifecycleControl'
import WealthGoalProjection from '@/components/wealth/WealthGoalProjection'
import WealthPlanningForm from '@/components/wealth/WealthPlanningForm'
import WealthPlanningLinks from '@/components/wealth/WealthPlanningLinks'
import styles from '@/components/wealth/calendar.module.css'
export default async function WealthGoalPage({params}:{params:Promise<{goalId:string}>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Sua meta</h1><p>Sem permissão para consultar metas agora.</p><Link href="/apps">Voltar ao Hub</Link></>
 let id:string;try{id=uuid((await params).goalId)}catch{notFound()}
 const {db,user}=read.identity
 const [result,fundingResult]=await Promise.all([db.from('wealth_goals').select('id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,status,version,archived_at').eq('user_id',user.id).eq('id',id).maybeSingle(),db.from('wealth_goal_funding').select('priority,category,sources,notes').eq('user_id',user.id).eq('id',id).maybeSingle()])
 if(result.error||fundingResult.error)throw Error('Não foi possível consultar a meta agora.')
 if(!result.data)notFound()
 const goal=result.data as WealthGoal,funding=fundingResult.data as GoalFunding|null
 const [options,today]=await Promise.all([planningOptions(db,user.id,funding?.sources),planningToday(db,user.id)])
 return <div className={styles.page}>
  <nav className={styles.nav} aria-label="Navegação da meta"><Link href="/apps/wealth/metas">← Minhas metas</Link><Link href="/apps/wealth/planejamento">Planos de vida</Link></nav>
  <header className={styles.hero}><div><span className={styles.kicker}>Orçaly Wealth · Planejamento</span><h1>{goal.title}</h1><p>{goal.archived_at?'Meta arquivada · fora dos totais ativos.':'Uma meta, um próximo passo.'}</p></div><aside>O valor reservado é declarado por você. As fontes vinculadas explicam o plano e não criam outro saldo.</aside></header>
  <WealthGoalProjection goal={goal} today={today}/>
  <section className={styles.section}><h2>De onde virão os recursos</h2>
   {funding&&<p>Prioridade: {{low:'baixa',normal:'normal',high:'alta'}[funding.priority]}. {funding.notes}</p>}
   <WealthPlanningLinks links={funding?.sources??[]} options={options}/>
  </section>
  {write.allowed&&!goal.archived_at&&<>
   <details className={styles.details}><summary>Editar fontes de funding</summary><WealthPlanningForm key={goal.version} goal={{id,version:Number(goal.version),funding}} options={options} token={crypto.randomUUID()} today={today}/><Link href={`/apps/wealth/metas/${id}`}>Reabrir versão atual</Link></details>
   <section className={styles.section} aria-labelledby="goal-details"><h2 id="goal-details">Editar meta</h2><p>Para registrar um aporte já realizado, atualize o total reservado declarado. Não some novamente lançamentos ou fontes vinculadas.</p><WealthGoalEditor key={goal.version} goal={goal}/></section>
  </>}
  {write.allowed&&<div className={styles.legacySection}><WealthLifecycleControl id={goal.id} version={Number(goal.version)} archived={Boolean(goal.archived_at)} type="goal"/></div>}
 </div>
}
