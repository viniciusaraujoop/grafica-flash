import Link from 'next/link'
import {randomUUID} from 'node:crypto'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {formatMoney,formatFinancialDate} from '@/lib/wealth/core'
import {parseWealthFilters} from '@/lib/wealth/records'
import type {DebtEntry,DebtTerms} from '@/lib/wealth/debt'
import WealthDebtForm from '@/components/wealth/WealthDebtForm'
import WealthDebtSimulator from '@/components/wealth/WealthDebtSimulator'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function DebtsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [read,write]=await Promise.all([getPersonalProductAccess('wealth','wealth.read'),getPersonalProductAccess('wealth','wealth.write')])
 if(!read.allowed||!read.identity)return <><h1>Central de dívidas</h1><p>Seu acesso às dívidas não está liberado.</p><Link href="/apps">Voltar ao Hub</Link></>
 let page:number
 try{page=parseWealthFilters({page:(await searchParams).page}).page}catch{return <><h1>Confira a página</h1><Link href="/apps/wealth/dividas">Voltar à central</Link></>}
 const {db,user}=read.identity
 const [listed,simulation]=await Promise.all([
  db.from('wealth_entries').select('id,title,amount_cents,financial_date,version,terms:wealth_debt_terms(*)',{count:'exact'}).eq('user_id',user.id).eq('kind','liability').is('archived_at',null).order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1),
  db.from('wealth_debt_terms').select('monthly_rate_bps,minimum_cents,priority,entry:wealth_entries!inner(id,title,amount_cents,version)').eq('entry.user_id',user.id).is('entry.archived_at',null).gt('entry.amount_cents',0).order('id').limit(51),
 ])
 if(listed.error||listed.count===null||simulation.error)return <><h1>Central de dívidas</h1><p>Não foi possível consultar suas dívidas. Nenhum saldo foi estimado.</p></>
 const entries=listed.data as unknown as DebtEntry[],pages=Math.max(1,Math.ceil(listed.count/25))
 const rows=simulation.data as unknown as (Pick<DebtTerms,'monthly_rate_bps'|'minimum_cents'|'priority'>&{entry:Pick<DebtEntry,'id'|'title'|'amount_cents'|'version'>})[]
 const today=new Date().toISOString().slice(0,10)
 return <><Link className={styles.textButton} href="/apps/wealth">← Visão geral do Wealth</Link><p className={styles.eyebrow}>Planejamento pessoal</p><h1>Central de dívidas</h1>
 <p className={styles.lead}>Conheça seus saldos, registre condições e compare caminhos de quitação. São informações declaradas por você; o Orçaly não faz pagamentos nem negocia com credores.</p>
 <section className={styles.panel}><h2>Seus passivos</h2><p>{listed.count} registro(s) não arquivado(s) · página {page} de {pages}. Cada dívida usa o mesmo saldo do patrimônio. Para um passivo já registrado, use “Detalhar dívida” abaixo.</p>
 {entries.map(entry=><article className={styles.panel} key={entry.id} aria-label={entry.title}><h3>{entry.title}</h3><p>Saldo: {formatMoney(entry.amount_cents)} · {entry.amount_cents===0?'Quitada conforme saldo declarado':'Em aberto'} · informado em {formatFinancialDate(entry.financial_date)}.</p>
 {entry.terms?<p>Principal original: {formatMoney(entry.terms.principal_cents)}. Juros: {(entry.terms.monthly_rate_bps/100).toLocaleString('pt-BR')}% ao mês. Mínimo: {formatMoney(entry.terms.minimum_cents)}. {entry.terms.installment_count!==null&&`${entry.terms.remaining_installments} de ${entry.terms.installment_count} parcelas restantes.`} {entry.terms.next_due_date&&`Próximo vencimento: ${formatFinancialDate(entry.terms.next_due_date)}.`} Prioridade: {entry.terms.priority}.</p>:<p>Condições ainda não detalhadas; este passivo não participa da simulação.</p>}
 {write.allowed&&<Link className={styles.textButton} href={`/apps/wealth/dividas/${entry.id}`}>{entry.terms?'Editar dívida':'Detalhar dívida'}</Link>}</article>)}
 {!entries.length&&<p>Nenhuma dívida nesta página.</p>}
 <nav className={styles.actions} aria-label="Paginação de dívidas">{page>1&&<Link href={`/apps/wealth/dividas?page=${page-1}`}>Página anterior</Link>}{page<pages&&<Link href={`/apps/wealth/dividas?page=${page+1}`}>Próxima página</Link>}{page>pages&&<Link href="/apps/wealth/dividas">Primeira página</Link>}</nav></section>
 <section className={styles.panel}><h2>Comparar estratégias</h2><WealthDebtSimulator key={rows.map(r=>r.entry.id+':'+r.entry.version).join(',')} debts={rows.map(r=>({id:r.entry.id,title:r.entry.title,balanceCents:r.entry.amount_cents,monthlyRateBps:r.monthly_rate_bps,minimumCents:r.minimum_cents,priority:r.priority}))}/></section>
 {write.allowed&&<section className={styles.panel}><h2>Nova dívida</h2><p>Cria um novo passivo no patrimônio. Use esta opção apenas se ele ainda não foi registrado. Para editar ou arquivar passivos existentes, use a lista ou o histórico.</p><WealthDebtForm token={randomUUID()} today={today}/></section>}
 <Link className={styles.textButton} href="/apps/wealth/lancamentos?kind=liability">Histórico de passivos e arquivamento →</Link>
 </>
}
