import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate,integer,financialDate,uuid} from '@/lib/wealth/core'
import {recurrenceFrequencies,recurrenceStatuses} from '@/lib/wealth/recurrence'
import {billTypes,readBills,single,type Search} from '@/lib/wealth/calendar'
import WealthRecurrenceForm from '@/components/wealth/WealthRecurrenceForm'
import WealthRecurrenceControls from '@/components/wealth/WealthRecurrenceControls'
import WealthBillForm from '@/components/wealth/WealthBillForm'
import s from '@/components/wealth/calendar.module.css'

export default async function RecurrencesPage({searchParams}:{searchParams:Promise<Search>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Contas e recorrências</h1><p>Seu acesso aos agendamentos não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const db=read.identity.db,profile=await db.from('wealth_profiles').select('timezone').eq('user_id',read.identity.user.id).maybeSingle()
 let zone=profile.data?.timezone||'America/Sao_Paulo'
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:zone}).format(0)}catch{zone='America/Sao_Paulo'}
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(new Date())
 let page:number,status:string,month:string,selected:string
 try{const input=await searchParams;page=integer(single(input,'page','1'),1,100000);status=single(input,'status');if(status&&!Object.hasOwn(recurrenceStatuses,status))throw Error('status');month=financialDate(single(input,'month',today.slice(0,7))+'-01');selected=single(input,'schedule');if(selected)uuid(selected)}
 catch{return <><h1>Confira os filtros</h1><Link href="/apps/wealth/recorrencias">Limpar filtros</Link></>}
 const [result,previous]=await Promise.all([db.rpc('wealth_bills',{p_month:month,p_page:page,p_status:status,p_id:selected||null}),write.allowed?db.from('wealth_recurring_schedules').select('id,title').eq('user_id',read.identity.user.id).eq('status','cancelled').order('created_at',{ascending:false}).limit(100):Promise.resolve({data:[]})])
 if(result.error)return <><h1>Contas e recorrências</h1><p>Não foi possível consultar suas contas agora.</p><Link href="/apps/wealth/recorrencias">Tentar novamente</Link></>
 const data=readBills(result.data),pages=Math.max(1,Math.ceil(Number(data.count)/25)),t=data.totals
 const href=(value:number)=>'/apps/wealth/recorrencias?'+new URLSearchParams({page:String(value),status,month:month.slice(0,7),schedule:selected})
 return <div className={s.page}>
 <nav className={s.nav} aria-label="Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/calendario">Calendário financeiro</Link><Link href="/apps/wealth/lancamentos">Lançamentos</Link></nav>
 <header className={s.hero}><div><span className={s.kicker}>Wealth · Compromissos em perspectiva</span><h1>Contas e recorrências.</h1><p>O pequeno compromisso de cada mês também merece uma visão do ano. Revise o que continua, o que mudou e o que pode esperar.</p></div><aside><strong>{t.active} ativas · {t.paused} pausadas · {t.cancelled} canceladas</strong><br/>Agendamentos pessoais geram declarações.<br/>Nenhum pagamento é executado.</aside></header>
 <dl className={s.stats}><div><dt>Despesas · mês selecionado</dt><dd>{formatMoney(t.monthExpense)}<small>Agenda contratada de {month.slice(0,7)}</small></dd></div><div><dt>Despesas · próximos 12 meses</dt><dd>{formatMoney(t.annualExpense)}<small>{formatFinancialDate(data.today)} a {formatFinancialDate(data.annualEnd)}</small></dd></div><div><dt>Média mensal estimada</dt><dd>{formatMoney((BigInt(t.annualExpense)+BigInt(6))/BigInt(12))}<small>Projeção anual dividida por 12, arredondada ao centavo</small></dd></div></dl>
 <p className={s.muted}>Receitas previstas: {formatMoney(t.monthIncome)} no mês selecionado e {formatMoney(t.annualIncome)} nos próximos 12 meses. Totais incluem todas as contas ativas, independentemente dos filtros e páginas, respeitando datas finais e limites de ocorrências. São projeções dos contratos atuais, incluindo datas já registradas no período; não são despesas adicionais nem valores pagos.</p>
 <section className={s.section} aria-label="Contas recorrentes"><div className={s.toolbar}><h2>Seus agendamentos</h2>{write.allowed&&<a className={s.button} href="#novo-agendamento">Novo agendamento</a>}</div>
 <form action="/apps/wealth/recorrencias" className={s.filters}><label>Mês de referência<input type="month" name="month" defaultValue={month.slice(0,7)} min="1900-01" max="2199-12" required/></label><label>Status do agendamento<select name="status" defaultValue={status}><option value="">Todos os status</option>{Object.entries(recurrenceStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className={s.button}>Aplicar filtros</button></form>
 {selected&&<p><Link href="/apps/wealth/recorrencias">Mostrar todas as contas</Link></p>}
 <p className={s.muted}>{data.count} agendamento(s) · página {page} de {pages}.</p>
 {data.bills.length?data.bills.map(bill=><article key={bill.id} id={'bill-'+bill.id} className={s.bill} aria-label={bill.title}>
  <div className={s.billHeader}><div><h3>{bill.title}</h3><p>{bill.bill_type?billTypes[bill.bill_type]:'Ainda não classificada'}{bill.provider?' · '+bill.provider:''}<br/>{recurrenceStatuses[bill.status]} · {bill.kind==='income'?'Receita':'Despesa'} · {recurrenceFrequencies[bill.frequency]} a cada {bill.interval_count} período(s).</p></div><strong>{formatMoney(bill.amount_cents)}<span className={s.muted}> / ocorrência</span></strong></div>
  <p className={s.muted}>{['active','paused'].includes(bill.status)&&<>Próxima data {bill.status==='paused'?'suspensa':''}: <strong>{formatFinancialDate(bill.next_date)}</strong> às 12h · {bill.timezone}. </>}Início: {formatFinancialDate(bill.start_date)}. {bill.end_date&&'Fim: '+formatFinancialDate(bill.end_date)+'.'} {bill.max_occurrences&&'Limite: '+bill.max_occurrences+' ocorrências.'} Geradas: {bill.next_index}.<br/>Projeção anual: {formatMoney(bill.annual_amount)} · Mês selecionado: {formatMoney(bill.month_amount)}.</p>
  <div className={s.notice}>{bill.price_change!==null&&bill.previous_amount!==null?<p>{BigInt(bill.price_change)>BigInt(0)?'Aumento declarado':'Comparação com versão anterior'}: {formatMoney(bill.previous_amount)} → {formatMoney(bill.amount_cents)} por ocorrência. Diferença: {formatMoney(bill.price_change)}. Evidência: vínculo informado com o agendamento anterior cancelado.</p>:<p>Histórico comparável insuficiente para detectar aumento. Vincule uma versão anterior da mesma conta após cancelar e criar a revisão.</p>}{BigInt(bill.duplicate_candidates)>BigInt(0)&&<p>{bill.duplicate_candidates} possível(is) duplicidade(s): mesmo fornecedor informado, tipo, valor, frequência e movimento em outra conta ativa. Revise antes de cancelar.</p>}<p>Próxima renovação: {bill.bill_type==='renewal'&&bill.status==='active'?formatFinancialDate(bill.next_date):'não identificada como renovação anual.'} {bill.reviewed_at?'Última revisão: '+formatFinancialDate(bill.reviewed_at.slice(0,10))+'.':'Revisar assinatura: ainda sem revisão registrada.'} Sem dados de uso, não é possível afirmar que uma assinatura foi esquecida.</p></div>
  {bill.pause_reason==='access_unavailable'&&<p className={s.notice}>Geração pausada por falta de permissão. Após recuperar o acesso, confirme a retomada.</p>}
  {write.allowed&&<><details className={s.details}><summary>Classificar e revisar conta</summary><WealthBillForm bill={bill} predecessors={previous.data||[]}/></details><details className={s.details}><summary>Controlar agendamento</summary><WealthRecurrenceControls schedule={bill}/></details></>}
 </article>):<p className={s.empty}>Nenhum agendamento neste filtro. Organize a primeira conta abaixo ou ajuste os filtros.</p>}
 <nav className={s.nav} aria-label="Paginação de agendamentos">{page>1&&<Link href={href(page-1)}>Página anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima página</Link>}{page>pages&&<Link href={href(1)}>Primeira página</Link>}</nav>
 </section>
 {write.allowed&&<><section className={s.section}><h2>Atualizar pendências</h2><details className={s.details}><summary>Gerar lançamentos vencidos</summary><p className={s.muted}>Gere até 10 ocorrências por atualização. Cada ocorrência cria um lançamento declarado; não movimenta dinheiro.</p><WealthRecurrenceControls/></details></section><section className={s.section} id="novo-agendamento"><h2>Novo agendamento</h2><p>Organize salários, aluguel, assinaturas, parcelas e aportes planejados. Para alterar valor ou frequência, cancele e crie outro agendamento. Depois, registre o vínculo em “Classificar e revisar conta”.</p><details className={s.details}><summary>Preencher novo agendamento</summary><WealthRecurrenceForm idempotencyKey={randomUUID()} today={data.today}/></details></section></>}
 <p className={s.muted}>Datas mensais preservam o dia original e usam o último dia disponível quando necessário. Pausar interrompe a geração; retomar inclui pendências. Aportes planejados não compram ativos.</p>
 </div>
}
