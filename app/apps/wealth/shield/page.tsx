import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {notFound} from 'next/navigation'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {integer,uuid,formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {protectionCategories,premiumPeriods,termLabels,shieldFilters,type ShieldOverview,type ProtectionPolicy,type ShieldOptions} from '@/lib/wealth/shield'
import {recurrenceStatuses} from '@/lib/wealth/recurrence'
import {WealthProtectionForm} from '@/components/wealth/WealthProtectionForm'
import s from '@/components/wealth/calendar.module.css'
const money=(v:string|null)=>v===null?'Não informado':formatMoney(v)
function PolicyFacts({p}:{p:ProtectionPolicy}){return <>
 <p><span className={s.tag}>{termLabels[p.temporal]}</span> · {protectionCategories[p.category]} · {p.insurer||'Seguradora não informada'}</p>
 <p>Início: {p.starts_on?formatFinancialDate(p.starts_on):'não informado'} · fim: {p.ends_on?formatFinancialDate(p.ends_on):'não informado'}.</p>
 <dl className={s.stats}><div><dt>Cobertura nominal declarada</dt><dd>{money(p.coverage_cents)}</dd></div><div><dt>Franquia declarada</dt><dd>{money(p.deductible_cents)}</dd></div><div><dt>Prêmio declarado</dt><dd>{money(p.premium_cents)}<small>{premiumPeriods[p.premium_period]}. Não comprova pagamento.</small></dd></div></dl>
 </>}
export default async function ShieldPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const access=await getPersonalProductAccess('wealth','wealth.read');if(!access.allowed||!access.identity)return <><h1>Wealth Shield</h1><p>Seu acesso ao Wealth não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 const {db,user}=access.identity,raw=await searchParams;let page:number,filter:keyof typeof shieldFilters,id:string|null
 try{if(Object.values(raw).some(Array.isArray))throw Error();page=integer(raw.page??1,1,100000);filter=String(raw.filter??'current') as keyof typeof shieldFilters;if(!Object.hasOwn(shieldFilters,filter))throw Error();id=raw.id?uuid(raw.id):null}catch{return <><h1>Revise os filtros</h1><Link href="/apps/wealth/shield">Limpar filtros</Link></>}
 const profile=await db.from('wealth_profiles').select('timezone').eq('user_id',user.id).maybeSingle();if(profile.error)throw Error('Não foi possível confirmar a data local.')
 const zone=profile.data?.timezone??'America/Sao_Paulo',today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const [r,write]=await Promise.all([db.rpc('wealth_shield_overview',{p_date:today,p_page:page,p_filter:filter,p_id:id}),getPersonalProductAccess('wealth','wealth.write')]);if(r.error)throw Error('Não foi possível consultar o Shield.')
 const v=r.data as ShieldOverview,p=v.selected;if(id&&!p)notFound()
 let options:ShieldOptions|undefined
 if(write.allowed){
  const [assets,documents,schedules]=await Promise.all([
   db.from('wealth_entries').select('id,title').eq('user_id',user.id).eq('kind','asset').is('archived_at',null).order('id').limit(100),
   db.from('wealth_documents').select('id,title').eq('user_id',user.id).eq('status','active').order('id').limit(100),
   db.from('wealth_recurring_schedules').select('id,title').eq('user_id',user.id).eq('kind','expense').order('id').limit(100)
  ]);if(assets.error||documents.error||schedules.error)throw Error('Não foi possível confirmar os vínculos privados.')
  const preserve=(rows:{id:string;title:string}[],selected:{id:string;title:string}|null)=>selected&&!rows.some(r=>r.id===selected.id)?[...rows,selected]:rows
  options={assets:preserve(assets.data??[],p?.asset&&!p.asset.archived?p.asset:null),documents:preserve(documents.data??[],p?.document??null),schedules:preserve(schedules.data??[],p?.schedule??null)}
 }
 const href=(n:number)=>`?${new URLSearchParams({filter,page:String(n)})}`
 return <div className={s.page}><nav className={s.nav} aria-label="Proteção Wealth"><Link href="/apps/wealth">Visão geral</Link><Link href="/apps/wealth/shield" aria-current="page">Shield</Link><Link href="/apps/wealth/documentos">Documentos</Link><Link href="/apps/wealth/recorrencias">Contas recorrentes</Link></nav>
 <header className={s.hero}><div><span className={s.kicker}>Sua proteção, organizada</span><h1>Wealth Shield</h1><p>Reúna seus seguros declarados, veja os prazos informados e encontre os documentos para a próxima revisão.</p></div><aside>Consulta em {formatFinancialDate(today)} · {zone}. Seguradoras: NOT_CONFIGURED. Nenhuma vigência, cobertura ou quitação é confirmada externamente.</aside></header>
 <p className={s.notice}>Uma apólice cadastrada não comprova proteção ativa. Cobertura nominal e franquia são dados informados por você; condições, exclusões e limites precisam ser conferidos no documento. Valores de apólices diferentes não são somados nem comparados automaticamente com o patrimônio.</p>
 <dl className={s.stats}><div><dt>Registros não arquivados</dt><dd>{v.summary.current}<small>Inclui cancelamentos informados; não é contagem de seguros ativos.</small></dd></div><div><dt>Fim informado em até 30 dias</dt><dd>{v.summary.ending}<small>Inclui hoje; revise o documento antes de decidir sobre renovação.</small></dd></div><div><dt>Dados incompletos</dt><dd>{v.summary.unknown}<small>{v.summary.missing_document} sem documento disponível · {v.summary.expired} com prazo informado encerrado.</small></dd></div></dl>
 {write.allowed&&!p&&<details className={s.details}><summary>Adicionar seguro declarado</summary><p>Campos vazios permanecem desconhecidos. Um valor zero precisa ser informado explicitamente. O prêmio é uma referência; não cria despesa nem recorrência.</p><WealthProtectionForm operation="save" token={randomUUID()} options={options}/><p className={s.muted}>Vínculos: primeiros 100 bens não arquivados, documentos ativos e contas próprias. São referências privadas; não concedem compartilhamento.</p></details>}
 {p&&<section className={s.section} aria-label="Registro selecionado"><h2>{p.title}</h2><PolicyFacts p={p}/><p>Referência: {p.reference||'não informada'}. Versão {p.version}.</p><p>{p.notes||'Sem observações.'}</p><ul>
 <li>Bem: {p.asset?<Link href={`/apps/wealth/lancamentos/${p.asset.id}`}>{p.asset.title}{p.asset.archived?' (arquivado)':''}</Link>:p.asset_id?'vínculo indisponível':'sem vínculo'}.</li>
 <li>Documento: {p.document?<Link href={`/apps/wealth/documentos/${p.document.id}`}>{p.document.title}</Link>:p.document_id?'vínculo indisponível':'sem vínculo'}.</li>
 <li>Conta: {p.schedule?<Link href={`/apps/wealth/recorrencias?schedule=${p.schedule.id}`}>{p.schedule.title}</Link>:p.schedule_id?'vínculo indisponível':'sem vínculo'}. {p.schedule&&<span>Estado atual: {recurrenceStatuses[p.schedule.status as keyof typeof recurrenceStatuses]??p.schedule.status}. Sua execução e seu valor são administrados na Central de Recorrências.</span>}</li></ul>
 {write.allowed&&<>{!p.archived_at&&<details className={s.details}><summary>Editar declaração</summary><WealthProtectionForm operation="save" token={randomUUID()} policy={p} options={options}/><p className={s.muted}>Vínculos mostram até 100 opções e preservam os atuais disponíveis. Remova vínculos indisponíveis antes de salvar. Cancelamento informado não cancela a conta recorrente.</p></details>}<details className={s.details}><summary>{p.archived_at?'Restaurar este registro':'Arquivar este registro'}</summary><WealthProtectionForm operation={p.archived_at?'restore':'archive'} token={randomUUID()} policy={p}/></details></>}
 <Link href="/apps/wealth/shield">Voltar à lista e adicionar outro registro</Link></section>}
 <form className={s.filters}><label>Mostrar registros<select name="filter" defaultValue={filter}>{Object.entries(shieldFilters).map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label><button className={s.button}>Consultar proteção</button></form>
 <section className={s.section}><h2>Seus registros</h2><p>{v.count} registro(s) neste filtro · página {page} · até 25 por página, por fim informado. Totais acima consideram todos os seus registros. Vigências incompletas continuam explícitas.</p>{v.policies.length?<ul className={s.agenda}>{v.policies.map(item=><li key={item.id} className={s.bill} data-protection-policy={item.id}><h3>{item.title}</h3><PolicyFacts p={item}/><Link href={`?${new URLSearchParams({id:item.id,filter,page:String(page)})}`}>Revisar {item.title}</Link></li>)}</ul>:<p className={s.empty}>Nenhum registro neste filtro. Cadastre apenas dados que você possui ou ajuste a consulta; esta ausência não indica falta de proteção.</p>}</section>
 <nav className={s.nav} aria-label="Paginação Shield">{page>1&&<Link href={href(page-1)}>Página anterior</Link>}{BigInt(page)*BigInt(25)<BigInt(v.count)&&<Link href={href(page+1)}>Próxima página</Link>}</nav>
 <section className={s.section}><h2>O que revisar agora</h2><p>Abra o documento, confira vigência, limites, franquias e condições, e atualize sua declaração quando tiver informações. Contratação, renovação, cancelamento e sinistros são tratados diretamente com a seguradora; o Shield não os executa nem recomenda produtos.</p><p>Arquivar organiza a lista; não cancela contratos, contas ou arquivos. Family e One não compartilham estes registros automaticamente. Os vínculos com documentos mantêm as permissões do Vault.</p></section></div>
}
