import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {addDays,calendarViews,eventStates,eventSources,eventExplanation,parseCalendar,readCalendar,type Search} from '@/lib/wealth/calendar'
import s from '@/components/wealth/calendar.module.css'

export default async function CalendarPage({searchParams}:{searchParams:Promise<Search>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Calendário financeiro</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const db=access.identity.db
 const profile=await db.from('wealth_profiles').select('timezone').eq('user_id',access.identity.user.id).maybeSingle()
 let zone=profile.data?.timezone||'America/Sao_Paulo'
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:zone}).format(0)}catch{zone='America/Sao_Paulo'}
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date())
 let f:ReturnType<typeof parseCalendar>
 try{f=parseCalendar(await searchParams,today)}catch{return <><h1>Confira os filtros</h1><Link href="/apps/wealth/calendario">Limpar filtros do calendário</Link></>}
 const [response,portfolios]=await Promise.all([
  db.rpc('wealth_calendar',{p_from:f.from,p_to:f.to,p_page:f.page,p_source:f.source,p_direction:f.direction,p_status:f.status,p_portfolio:f.portfolio||null}),
  db.from('wealth_portfolios').select('id,name',{count:'exact'}).eq('user_id',access.identity.user.id).order('name').order('id').limit(100),
 ])
 if(response.error)return <><h1>Calendário financeiro</h1><p>Não foi possível consultar seus eventos agora.</p><Link href="/apps/wealth/calendario">Tentar novamente</Link></>
 const data=readCalendar(response.data),pages=Math.max(1,Math.ceil(Number(data.count)/50))
 const href=(patch:Record<string,string>)=>`/apps/wealth/calendario?${new URLSearchParams({view:f.view,date:f.date,days:f.days,source:f.source,direction:f.direction,status:f.status,portfolio:f.portfolio,...patch})}`
 const days:Array<string|null>=[]
 if(['month','week'].includes(f.view)){
  const offset=(new Date(`${f.from}T12:00:00Z`).getUTCDay()+6)%7
  for(let n=0;n<offset;n++)days.push(null)
  for(let date=f.from;date<=f.to;date=addDays(date,1))days.push(date)
 }
 const adjacent=(direction:number)=>{if(f.view==='month'){const d=new Date(`${f.from}T12:00:00Z`);d.setUTCMonth(d.getUTCMonth()+direction);return d.toISOString().slice(0,10)}return addDays(f.date,direction*(f.view==='week'?7:30))}
 return <div className={s.page}>
  <nav className={s.nav} aria-label="Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/recorrencias">Contas e recorrências</Link><Link href="/apps/wealth/carteiras">Carteiras</Link></nav>
  <header className={s.hero}><div><span className={s.kicker}>Wealth · Seu tempo financeiro</span><h1>O que vem pela frente.</h1><p>Encontre receitas, compromissos e marcos no mesmo calendário. Abra a origem para entender ou ajustar cada registro.</p></div><aside>Uma data organiza sua atenção.<br/>Ela não confirma um pagamento.<br/><strong>{data.count} eventos no período</strong></aside></header>
  <nav className={s.nav} aria-label="Visualização do calendário">{Object.entries(calendarViews).map(([value,label])=><Link key={value} href={href({view:value,page:'1',status:value==='overdue'?'OVERDUE':''})} aria-current={f.view===value?'page':undefined}>{label}</Link>)}</nav>
  <form className={s.filters} action="/apps/wealth/calendario"><input type="hidden" name="view" value={f.view}/>
   <label>Data de referência<input name="date" type="date" defaultValue={f.date} min="1901-01-01" max="2199-12-01" required/></label>
   <label>Origem<select name="source" defaultValue={f.source}><option value="">Todas as origens</option>{Object.entries(eventSources).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Direção<select name="direction" defaultValue={f.direction}><option value="">Todas</option><option value="income">Receita</option><option value="expense">Despesa</option><option value="neutral">Marco ou posição</option></select></label>
   <label>Estado<select name="status" defaultValue={f.status}><option value="">Todos</option>{Object.entries(eventStates).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Carteira<select name="portfolio" defaultValue={f.portfolio}><option value="">Todas</option>{(portfolios.data||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{f.portfolio&&!portfolios.data?.some(p=>p.id===f.portfolio)&&<option value={f.portfolio}>Carteira selecionada</option>}</select></label>
   <button className={s.button}>Aplicar filtros</button>
  </form>
  {(portfolios.count||0)>100&&<p className={s.muted}>O seletor mostra as primeiras 100 carteiras por nome. Um filtro já selecionado permanece ativo.</p>}
  <section className={s.section} aria-label="Período financeiro"><div className={s.toolbar}><h2>{formatFinancialDate(f.from)} — {formatFinancialDate(f.to)}</h2><nav className={s.nav} aria-label="Mudar período"><Link href={href({date:adjacent(-1),page:'1'})}>Anterior</Link><Link href={href({date:today,page:'1'})}>Hoje</Link><Link href={href({date:adjacent(1),page:'1'})}>Próximo</Link></nav></div>
   {days.length>0&&<><div className={s.weekdays} aria-hidden="true">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><span key={d}>{d}</span>)}</div><div className={s.grid} aria-label="Dias do calendário">{days.map((date,i)=>date?<Link key={date} className={s.day} data-today={date===data.localDate} href={href({view:'agenda',date,days:'1',page:'1'})} aria-label={`${formatFinancialDate(date)}: ${data.days.find(d=>d.date===date)?.count||'0'} eventos`}><span>{Number(date.slice(-2))}</span><small>{data.days.find(d=>d.date===date)?.count ? data.days.find(d=>d.date===date)?.count+' eventos' : '\u00a0'}</small></Link>:<span key={`blank-${i}`} aria-hidden="true"/>)}</div></>}
  </section>
  <section className={s.section} aria-label="Eventos financeiros"><h2>Seu roteiro financeiro</h2><p>Registrado = declarado no Wealth. Valores de dívidas, metas, investimentos e previsões têm significados diferentes e não são somados como saldo.</p>
   {data.events.length?<ol className={s.agenda}>{data.events.map(e=><li key={e.event_id} className={s.event}><div><time dateTime={e.event_at}>{formatFinancialDate(e.event_at)}</time><span className={s.tag} data-state={e.status}>{eventStates[e.status]}</span></div><div><h3><Link href={e.href}>{e.title}</Link></h3><p>{eventSources[e.source_type]} · {e.event_type==='dividend'?'Dividendo':e.event_type==='interest'?'Juros':e.direction==='income'?'Receita':e.direction==='expense'?'Despesa':'Marco ou posição'}{e.context.recurring?' · Recorrente':''}<br/>{eventExplanation(e)}<br/>{e.timezone}</p></div><strong>{e.amount===null?'Valor não informado':formatMoney(e.amount)}</strong></li>)}</ol>:<p className={s.empty}>{f.status==='HYPOTHETICAL'?'Não há hipóteses com datas nesta fonte. Os Labs permanecem separados do patrimônio real.':'Nenhum evento neste período e nestes filtros.'} <Link href="/apps/wealth/recorrencias">Organizar recorrências</Link></p>}
   <div className={s.toolbar}><p className={s.muted}>{data.count} eventos · página {f.page} de {pages}. Até 50 por página; o calendário conta todos os eventos do período.</p><nav className={s.nav} aria-label="Paginação">{f.page>1&&<Link href={href({page:String(f.page-1)})}>Página anterior</Link>}{f.page<pages&&<Link href={href({page:String(f.page+1)})}>Próxima página</Link>}</nav></div>
  </section>
 </div>
}
