import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {parseWealthFilters} from '@/lib/wealth/records'
import {recurrenceFrequencies,recurrenceStatuses,type WealthRecurrence} from '@/lib/wealth/recurrence'
import WealthRecurrenceForm from '@/components/wealth/WealthRecurrenceForm'
import WealthRecurrenceControls from '@/components/wealth/WealthRecurrenceControls'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function RecurrencesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Agendamentos pessoais</h1><p>Seu acesso aos agendamentos não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const input=await searchParams
 let page:number,status:string
 try{page=parseWealthFilters({page:input.page}).page;if(Array.isArray(input.status)||(input.status&&!Object.hasOwn(recurrenceStatuses,input.status)))throw Error('Filtro inválido');status=input.status||''}
 catch{return <><h1>Confira os filtros</h1><Link href="/apps/wealth/recorrencias">Limpar filtros</Link></>}
 let query=read.identity.db.from('wealth_recurring_schedules').select('id,title,kind,category,amount_cents,frequency,interval_count,start_date,end_date,max_occurrences,timezone,status,pause_reason,next_index,next_date,next_run_at,last_run_at,version',{count:'exact'}).eq('user_id',read.identity.user.id).order('created_at',{ascending:false}).order('id')
 if(status)query=query.eq('status',status)
 const result=await query.range((page-1)*25,page*25-1)
 if(result.error||result.count===null)return <><h1>Agendamentos pessoais</h1><p>Não foi possível consultar seus agendamentos agora.</p></>
 const schedules=result.data as WealthRecurrence[],pages=Math.max(1,Math.ceil(result.count/25))
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const href=(value:number)=>`/apps/wealth/recorrencias?page=${value}${status?`&status=${status}`:''}`
 return <><Link className={styles.textButton} href="/apps/wealth">← Visão geral do Wealth</Link><p className={styles.eyebrow}>Planejamento pessoal</p><h1>Agendamentos pessoais</h1>
 <p className={styles.lead}>Organize salários, aluguel, assinaturas, parcelas e aportes planejados. Cada ocorrência cria um lançamento declarado, sem movimentar dinheiro ou contratar investimentos.</p>
 <div className={styles.notice}>Os registros vencem às 12h do fuso escolhido. Datas mensais usam o último dia disponível quando necessário e preservam o dia original nos meses seguintes. Pausar interrompe a geração; retomar inclui pendências. Aportes planejados são despesas declaradas, sem compra de ativos.</div>
 {write.allowed&&<section className={styles.panel}><h2>Atualizar pendências</h2><p>Consulte os registros vencidos e gere até 10 ocorrências por atualização. O histórico preserva as datas financeiras originais. A próxima data mostra o que ainda está pendente.</p><WealthRecurrenceControls/></section>}
 <section className={styles.panel}><h2>Seus agendamentos</h2><form action="/apps/wealth/recorrencias" method="get" className={styles.formGrid}><label>Status do agendamento<select name="status" defaultValue={status}><option value="">Todos os status</option>{Object.entries(recurrenceStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className={styles.primaryButton}>Aplicar filtros</button></form>
 <p>{result.count} agendamento(s) · página {page} de {pages}.</p>
 {schedules.length?schedules.map(schedule=><article key={schedule.id} className={styles.panel} aria-label={schedule.title}>
 <h3>{schedule.title}</h3><p>{recurrenceStatuses[schedule.status]} · {schedule.kind==='income'?'Receita':'Despesa'} · {formatMoney(schedule.amount_cents)} · {recurrenceFrequencies[schedule.frequency]} a cada {schedule.interval_count} período(s).</p>
 <p>Início: {formatFinancialDate(schedule.start_date)}. {schedule.end_date&&`Fim: ${formatFinancialDate(schedule.end_date)}.`} {schedule.max_occurrences&&`Limite: ${schedule.max_occurrences} ocorrências.`} Geradas: {schedule.next_index}.</p>
 {['active','paused'].includes(schedule.status)&&<p>Próxima data: {formatFinancialDate(schedule.next_date)} às 12h · {schedule.timezone}.</p>}
 {schedule.pause_reason==='access_unavailable'&&<p>Geração pausada por falta de permissão. Após recuperar o acesso, confirme a retomada.</p>}
 {write.allowed&&<WealthRecurrenceControls schedule={schedule}/>}
 </article>):<p>Nenhum agendamento neste filtro. Crie o primeiro abaixo.</p>}
 <nav className={styles.actions} aria-label="Paginação de agendamentos">{page>1&&<Link href={href(page-1)}>Página anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima página</Link>}{page>pages&&<Link href={href(1)}>Primeira página</Link>}</nav></section>
 {write.allowed&&<section className={styles.panel}><h2>Novo agendamento</h2><p>Use o número de ocorrências para parcelas. Deixe os limites vazios para continuar até cancelar. Para alterar valor ou frequência, cancele e crie outro agendamento.</p><WealthRecurrenceForm idempotencyKey={randomUUID()} today={today}/></section>}
 </>
}
