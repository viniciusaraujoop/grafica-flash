import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {integer,formatFinancialDate} from '@/lib/wealth/core'
import {alertPriorities,alertSources,alertViews,readAlertsOverview,type AlertView} from '@/lib/wealth/alerts'
import {AlertActions,AlertPreferences} from '@/components/wealth/WealthAlertForms'
import s from '@/components/wealth/calendar.module.css'

export default async function AlertsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Wealth Alerts</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const raw=await searchParams;let page:number,view:AlertView
 try{page=integer(raw.page??1,1,100000);if(Array.isArray(raw.view))throw Error();view=String(raw.view??'active') as AlertView;if(!Object.hasOwn(alertViews,view))throw Error()}catch{return <><h1>Revise os filtros</h1><Link href="/apps/wealth/alertas">Limpar filtros</Link></>}
 const result=await access.identity.db.rpc('wealth_alerts_overview',{p_page:page,p_view:view})
 if(result.error)throw Error('Não foi possível consultar seus alertas.')
 const data=readAlertsOverview(result.data),write=(await getPersonalProductAccess('wealth','wealth.write')).allowed,pages=Math.max(1,Number((BigInt(data.count)+BigInt(24))/BigInt(25)))
 const href=(next:number)=>`?view=${view}&page=${next}`
 return <div className={s.page}>
  <nav className={s.nav} aria-label="Alertas Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/alertas" aria-current="page">Alertas</Link><Link href="/apps/wealth/briefing?mode=morning">Morning</Link><Link href="/apps/wealth/automacoes">Automações</Link></nav>
  <header className={s.hero}><div><span className={s.kicker}>Sinais factuais, sem barulho artificial</span><h1>Wealth Alerts</h1><p>Priorize condições que já existem nos seus próprios dados e escolha o que adiar, dispensar ou silenciar.</p></div><aside>Data local: <strong>{formatFinancialDate(data.date)}</strong><br/>{data.timezone}<br/>Cooldown de entrega: {data.preferences.cooldown_hours}h</aside></header>
  <p className={s.notice}>Alertas não confirmam cobrança, pagamento, cotação, cobertura ou imposto externo. O centro não executa transações e não envia mensagens nesta versão; o cooldown controla a elegibilidade para futuros canais de entrega.</p>
  <dl className={s.stats}><div><dt>Ativos</dt><dd>{data.summary.active}<small>{data.summary.urgent} urgente(s) · {data.summary.attention} atenção</small></dd></div><div><dt>Adiados</dt><dd>{data.summary.snoozed}<small>Voltam quando o prazo termina.</small></dd></div><div><dt>Dispensados</dt><dd>{data.summary.dismissed}<small>Ficam ocultos enquanto a mesma condição existir.</small></dd></div><div><dt>Silenciados</dt><dd>{data.summary.muted}<small>Filtrados pelas suas preferências.</small></dd></div></dl>
  <nav className={s.nav} aria-label="Visualizações de alertas">{Object.entries(alertViews).map(([k,v])=><Link key={k} href={`?view=${k}&page=1`} aria-current={view===k?'page':undefined}>{v}</Link>)}</nav>
  {write&&<details className={s.details}><summary>Preferências e noise control</summary><AlertPreferences preferences={data.preferences} token={randomUUID()}/></details>}
  <section className={s.section}><h2>{alertViews[view]}</h2><p>{data.count} alerta(s) nesta visualização · página {page} de {pages}.</p>
   {data.alerts.length?<ol className={s.agenda}>{data.alerts.map(alert=><li key={alert.alert_key} className={s.bill} data-alert-priority={alert.priority}>
    <div className={s.billHeader}><h3>{alert.title}</h3><strong>{alertPriorities[alert.priority]}</strong></div>
    <p><strong>{alertSources[alert.source]}</strong> · {alert.reason}</p><p>{alert.detail}</p>
    {alert.event_date&&<p>Data de referência: {formatFinancialDate(alert.event_date)}.</p>}
    {alert.state==='snoozed'&&alert.snoozed_until&&<p>Adiado até {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:data.timezone}).format(new Date(alert.snoozed_until))}.</p>}
    {alert.notification_eligible?<p>Elegível para uma futura entrega, respeitando suas preferências.</p>:alert.cooldown_until&&<p>Cooldown de entrega até {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:data.timezone}).format(new Date(alert.cooldown_until))}.</p>}
    <p><Link href={alert.deep_link}>Revisar fonte →</Link></p>
    {write&&alert.state!=='muted'&&<AlertActions alert={alert} tokens={{dismiss:randomUUID(),snooze:randomUUID(),restore:randomUUID()}}/>}
   </li>)}</ol>:<p className={s.empty}>Nenhum alerta factual nesta visualização.</p>}
   <nav className={s.nav} aria-label="Paginação dos alertas">{page>1&&<Link href={href(page-1)}>Página anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima página</Link>}</nav>
  </section>
  <section className={s.section}><h2>Cobertura de fontes</h2><ul>{Object.entries(data.source_coverage).map(([source,status])=><li key={source}>{alertSources[source as keyof typeof alertSources]}: <strong>{status}</strong></li>)}</ul><p className={s.muted}>Vault usa somente validade declarada explicitamente. Nenhuma validade é inferida da data do documento ou do conteúdo do arquivo.</p></section>
 </div>
}
