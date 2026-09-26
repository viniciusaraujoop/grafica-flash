import Link from 'next/link'
import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { formatMoney,formatFinancialDate,type WealthGoal } from '@/lib/wealth/core'
import { parseWealthFilters,recordsQuery,recordsPageSize } from '@/lib/wealth/records'
import { archiveStates,goalStatuses,progressPercent } from '@/lib/wealth/lifecycle'
import styles from '@/components/ecosystem/ecosystem.module.css'
export default async function WealthGoalsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Minhas metas</h1><p>O acesso às metas não está liberado para esta conta.</p><Link href="/apps">Voltar ao Hub</Link></>
 const input=await searchParams
 let filters,status:string
 try{filters=parseWealthFilters({page:input.page,archive:input.archive});if(Array.isArray(input.status)|| (input.status && !Object.hasOwn(goalStatuses,input.status)))throw Error('Status inválido.');status=input.status||''}
 catch{return <><h1>Confira os filtros</h1><Link href="/apps/wealth/metas">Limpar filtros</Link></>}
 let query=read.identity.db.from('wealth_goals').select('id,title,target_cents,saved_cents,monthly_contribution_cents,target_date,status,version,archived_at',{count:'exact'}).eq('user_id',read.identity.user.id).order('target_date').order('id')
 if(!filters.archive||filters.archive==='active')query=query.is('archived_at',null)
 if(filters.archive==='archived')query=query.not('archived_at','is',null)
 if(status)query=query.eq('status',status)
 const result=await query.range((filters.page-1)*recordsPageSize,filters.page*recordsPageSize-1)
 if(result.error||result.count===null)return <><h1>Minhas metas</h1><p>Não foi possível consultar as metas agora.</p></>
 const pages=Math.max(1,Math.ceil(result.count/recordsPageSize)),goals=result.data as WealthGoal[]
 const href=(page:number)=>`/apps/wealth/metas?${recordsQuery(filters,page)}${status?`&status=${status}`:''}`
 return <><Link className={styles.textButton} href="/apps/wealth">← Visão geral do Wealth</Link><p className={styles.eyebrow}>Planejamento pessoal</p><h1>Minhas metas</h1><p className={styles.lead}>Acompanhe o que você reservou e ajuste seu planejamento. Arquivadas ficam fora dos totais ativos.</p>
 <section className={styles.panel}><h2>Encontrar metas</h2><form action="/apps/wealth/metas" method="get" className={styles.formGrid}>
 <label>Arquivamento<select name="archive" defaultValue={filters.archive||'active'}>{Object.entries(archiveStates).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Status da meta<select name="status" defaultValue={status}><option value="">Todos os status</option>{Object.entries(goalStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <button className={styles.primaryButton} type="submit">Aplicar filtros</button><Link href="/apps/wealth/metas">Limpar filtros</Link></form><p>{result.count} meta(s) encontrada(s). Até 25 por página.</p></section>
 <section className={styles.panel}><h2>Metas registradas</h2>{goals.length?<div className={styles.tableWrap}><table className={styles.table}><caption>Metas · página {filters.page} de {pages}</caption><thead><tr><th scope="col">Meta</th><th scope="col">Reservado / objetivo</th><th scope="col">Progresso</th><th scope="col">Data</th><th scope="col">Status</th></tr></thead><tbody>{goals.map(goal=><tr key={goal.id}><td>{write.allowed?<Link href={`/apps/wealth/metas/${goal.id}`}>{goal.title}</Link>:goal.title}</td><td>{formatMoney(goal.saved_cents)} / {formatMoney(goal.target_cents)}</td><td>{progressPercent(goal.saved_cents,goal.target_cents)}%</td><td>{formatFinancialDate(goal.target_date)}</td><td>{goalStatuses[goal.status||'active']}{goal.archived_at?' · Arquivada':''}</td></tr>)}</tbody></table></div>:<p>Nenhuma meta nesta página. Ajuste os filtros ou crie uma meta na visão geral.</p>}
 <nav className={styles.actions} aria-label="Paginação das metas">{filters.page>1&&<Link href={href(filters.page-1)}>Página anterior</Link>}{filters.page<pages&&<Link href={href(filters.page+1)}>Próxima página</Link>}{filters.page>pages&&<Link href={href(1)}>Primeira página</Link>}</nav></section></>
}
