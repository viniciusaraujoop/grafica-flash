import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {integer,formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {eventTypes,scenarios,planStatuses,type LifePlan} from '@/lib/wealth/planning'
import {planningOptions,planningToday} from '@/lib/wealth/planning-server'
import WealthPlanningForm from '@/components/wealth/WealthPlanningForm'
import styles from '@/components/wealth/calendar.module.css'
export default async function LifePlanningPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Planos de vida</h1><p>O acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 let page:number;try{page=integer((await searchParams).page??'1',1,100000)}catch{return <><h1>Página inválida</h1><Link href="/apps/wealth/planejamento">Voltar aos planos</Link></>}
 const {db,user}=read.identity
 const [result,options,today]=await Promise.all([db.from('wealth_life_plans').select('id,title,event_type,target_date,scenario,status,upfront_cents',{count:'exact'}).eq('user_id',user.id).order('target_date').order('id').range((page-1)*25,page*25-1),write.allowed?planningOptions(db,user.id):Promise.resolve([]),planningToday(db,user.id)])
 if(result.error||result.count===null)throw Error('Não foi possível consultar seus planos.')
 const plans=result.data as LifePlan[],pages=Math.max(1,Math.ceil(result.count/25))
 return <div className={styles.page}>
  <nav className={styles.nav} aria-label="Planejamento Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/metas">Metas</Link><Link href="/apps/wealth/planejamento" aria-current="page">Planos de vida</Link></nav>
  <header className={styles.hero}><div><span className={styles.kicker}>Seu futuro, em perspectiva</span><h1>Planos de vida</h1><p>Transforme uma decisão importante em valores, prazos e escolhas que você consegue comparar.</p></div><aside>Simulações com suas premissas. Cada cenário é independente e não altera metas, dívidas, carteiras ou seu patrimônio.</aside></header>
  <section className={styles.section}><h2>Seus cenários</h2><p>{result.count} plano(s) · página {page} de {pages} · até 25 por página</p>
   {plans.length?<ul className={styles.agenda}>{plans.map(p=><li className={styles.bill} key={p.id}><div className={styles.billHeader}><div><h3><Link href={`/apps/wealth/planejamento/${p.id}`}>{p.title}</Link></h3><p>{eventTypes[p.event_type]} · {scenarios[p.scenario]} · {planStatuses[p.status]} · {formatFinancialDate(p.target_date)}</p></div><strong>{formatMoney(p.upfront_cents)}<span className={styles.muted}> · custo inicial</span></strong></div></li>)}</ul>:<p className={styles.empty}>Nenhum plano nesta página. Comece com o custo inicial de um evento e refine suas premissas.</p>}
   <nav className={styles.nav} aria-label="Paginação dos planos">{page>1&&<Link href={`?page=${page-1}`}>Página anterior</Link>}{page<pages&&<Link href={`?page=${page+1}`}>Próxima página</Link>}</nav>
  </section>
  {write.allowed&&<details className={styles.details}><summary>Criar plano de vida</summary><WealthPlanningForm options={options} token={crypto.randomUUID()} today={today}/></details>}
 </div>
}
