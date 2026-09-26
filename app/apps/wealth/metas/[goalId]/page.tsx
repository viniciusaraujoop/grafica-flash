import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { uuid, type WealthGoal } from '@/lib/wealth/core'
import { progressPercent } from '@/lib/wealth/lifecycle'
import WealthGoalEditor from '@/components/wealth/WealthGoalEditor'
import WealthLifecycleControl from '@/components/wealth/WealthLifecycleControl'
import styles from '@/components/ecosystem/ecosystem.module.css'
export default async function WealthGoalPage({params}:{params:Promise<{goalId:string}>}) {
 const [read,write] = await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity||!write.allowed)return <><h1>Sua meta</h1><p>Sem permissão para editar metas agora.</p><Link href="/apps/wealth/metas">Voltar às metas</Link></>
 let id:string;try{id=uuid((await params).goalId)}catch{notFound()}
 const result=await read.identity.db.from('wealth_goals').select('id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,status,version,archived_at').eq('user_id',read.identity.user.id).eq('id',id).maybeSingle()
 if(result.error)return <><h1>Sua meta</h1><p>Não foi possível consultar a meta agora.</p></>
 if(!result.data)notFound()
 const goal=result.data as WealthGoal
 return <><Link className={styles.textButton} href="/apps/wealth/metas">← Minhas metas</Link><p className={styles.eyebrow}>Orçaly Wealth</p><h1>Sua meta</h1><p className={styles.lead}>Progresso declarado: {progressPercent(goal.saved_cents,goal.target_cents)}%. A conclusão exige que o valor reservado alcance o objetivo.</p>
 {!goal.archived_at&&<section className={styles.panel} aria-labelledby="goal-details"><h2 id="goal-details">Editar meta</h2><WealthGoalEditor goal={goal}/></section>}
 <WealthLifecycleControl id={goal.id} version={Number(goal.version)} archived={Boolean(goal.archived_at)} type="goal"/></>
}
