import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {briefingMode,readDailyBriefing,type BriefingMode} from '@/lib/wealth/briefing'
import s from '@/components/wealth/calendar.module.css'

const labels:{[K in BriefingMode]:{title:string;kicker:string;lead:string}}={
 morning:{title:'Wealth Morning',kicker:'Comece pelo que merece atenção',lead:'Uma leitura curta do que já está registrado para hoje e para os próximos dias.'},
 night:{title:'Wealth Night',kicker:'Feche o dia com contexto',lead:'O que foi registrado hoje, o que ficou pendente e o que já aparece para amanhã.'},
}

export default async function WealthBriefingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Wealth Briefing</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const raw=(await searchParams).mode
 let mode:BriefingMode
 try{if(Array.isArray(raw))throw Error();mode=briefingMode(raw??'morning')}catch{return <><h1>Confira o briefing</h1><p>Escolha Morning ou Night.</p><Link href="/apps/wealth/briefing?mode=morning">Abrir Morning</Link></>}
 const {db,user}=access.identity
 const profile=await db.from('wealth_profiles').select('timezone').eq('user_id',user.id).maybeSingle()
 let zone=profile.data?.timezone||'America/Sao_Paulo'
 try{new Intl.DateTimeFormat('pt-BR',{timeZone:zone}).format(0)}catch{zone='America/Sao_Paulo'}
 const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const response=await db.rpc('wealth_daily_briefing',{p_mode:mode,p_local_date:localDate})
 if(response.error)return <><h1>{labels[mode].title}</h1><p>Não foi possível montar o briefing com dados confirmados agora.</p><Link href="/apps/wealth">Voltar ao Wealth</Link></>
 let briefing
 try{briefing=readDailyBriefing(response.data)}catch{return <><h1>{labels[mode].title}</h1><p>O briefing retornou dados que não puderam ser validados. Nenhuma conclusão foi exibida.</p></>}
 const stats=briefing.stats
 return <div className={s.page}>
  <nav className={s.nav} aria-label="Wealth Briefing"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/briefing?mode=morning" aria-current={mode==='morning'?'page':undefined}>Morning</Link><Link href="/apps/wealth/briefing?mode=night" aria-current={mode==='night'?'page':undefined}>Night</Link><Link href="/apps/wealth/calendario">Calendário</Link></nav>
  <header className={s.hero}><div><span className={s.kicker}>{labels[mode].kicker}</span><h1>{labels[mode].title}</h1><p>{labels[mode].lead}</p></div><aside>{formatFinancialDate(briefing.date)}<br/>{briefing.timezone}<br/><strong>Observe → Entenda → Aja</strong></aside></header>
  <p className={s.notice}>Este briefing usa somente dados declarados no Wealth. Banco e mercado permanecem {briefing.bank_provider_status}/{briefing.market_provider_status}; ausência de item não significa ausência de obrigação, saldo ou evento externo.</p>
  <dl className={s.stats}>
   <div><dt>Fluxo registrado hoje</dt><dd>{formatMoney(stats.today_cash_flow)}<small>{stats.today_cash_records} lançamento(s) de caixa.</small></dd></div>
   <div><dt>Recorrências vencidas</dt><dd>{stats.overdue_recurrences}<small>Próxima data declarada anterior a hoje.</small></dd></div>
   <div><dt>Dívidas vencidas</dt><dd>{stats.overdue_debts}<small>Com saldo aberto e vencimento declarado anterior a hoje.</small></dd></div>
   <div><dt>Amanhã</dt><dd>{stats.tomorrow_items}<small>Compromisso(s) já registrado(s).</small></dd></div>
  </dl>
  <section className={s.section}><h2>{mode==='morning'?'Seu roteiro de hoje':'O fechamento de hoje'}</h2>
   {briefing.items.length?<ol className={s.agenda}>{briefing.items.map(item=><li className={s.bill} key={item.source+':'+item.kind} data-briefing-item={item.status}>
    <div className={s.billHeader}><h3>{item.title}</h3>{item.amount_cents!==null&&<strong>{formatMoney(item.amount_cents)}</strong>}</div>
    <p><strong>Observe.</strong> {item.observe}</p>
    <p><strong>Entenda.</strong> {item.understand}</p>
    {item.event_date&&<p>Data de referência: {formatFinancialDate(item.event_date)}.</p>}
    <p><strong>Aja.</strong> <Link href={item.href}>{item.action_label}</Link></p>
   </li>)}</ol>:<p className={s.empty}>Nenhum ponto factual entrou neste briefing. Isso significa apenas que as fontes consultadas não geraram itens para esta data.</p>}
  </section>
  <section className={s.section}><h2>Cobertura desta leitura</h2><p>{stats.active_goals} meta(s) ativa(s), {stats.open_debts} dívida(s) aberta(s), {stats.next7_recurrences} recorrência(s) e {stats.next7_debts} dívida(s) com data nos próximos 7 dias.</p><p>{stats.unknown_valuations} posição(ões) com avaliação indisponível e {stats.tax_gaps} venda(s) com evidência fiscal incompleta nos últimos 365 dias. Esses números são fatos de cobertura, não recomendações.</p></section>
 </div>
}
