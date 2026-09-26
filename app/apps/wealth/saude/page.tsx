import Link from 'next/link'
import {getPersonalProductAccess} from '@/lib/ecosystem/server'
import {readHealthInputs,healthIndicators} from '@/lib/wealth/health'
import type {DebtEntry,DebtTerms} from '@/lib/wealth/debt'
import WealthDebtSimulator from '@/components/wealth/WealthDebtSimulator'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default async function FinancialHealthPage(){
 const access=await getPersonalProductAccess('wealth','wealth.read')
 if(!access.allowed||!access.identity)return <><h1>Saúde financeira</h1><p>O acesso ao Wealth não está disponível para esta conta.</p><Link href="/apps">App Hub</Link></>
 const {db,user}=access.identity
 const [result,simulation]=await Promise.all([
  db.rpc('wealth_health_inputs'),
  db.from('wealth_debt_terms').select('monthly_rate_bps,minimum_cents,priority,entry:wealth_entries!inner(id,title,amount_cents,version)').eq('entry.user_id',user.id).is('entry.archived_at',null).gt('entry.amount_cents',0).order('id').limit(51),
 ])
 let input
 try{if(result.error||simulation.error)throw Error('unavailable');input=readHealthInputs(result.data)}catch{return <><h1>Saúde financeira</h1><p>Não foi possível confirmar os indicadores. Nenhum valor foi estimado.</p><Link href="/apps/wealth">Voltar ao Wealth</Link></>}
 const rows=simulation.data as unknown as (Pick<DebtTerms,'monthly_rate_bps'|'minimum_cents'|'priority'>&{entry:Pick<DebtEntry,'id'|'title'|'amount_cents'|'version'>})[]
 return <>
  <Link className={styles.textButton} href="/apps/wealth">← Visão geral</Link><p className={styles.eyebrow}>Orçaly Wealth · Clareza financeira</p><h1>Entenda os sinais.<br/>Veja de onde vêm.</h1>
  <p className={styles.lead}>Indicadores dos seus registros pessoais, com regras abertas. Não há nota única de saúde financeira. Dados incompletos não viram conclusões sobre sua vida.</p>
  <p><Link href="/apps/wealth/patrimonio">Patrimônio e snapshots</Link> · <Link href="/apps/wealth/dividas">Central de Dívidas</Link> · <Link href="/apps/wealth/recorrencias">Recorrências</Link></p>
  {healthIndicators(input).map(indicator=><article key={indicator.id} className={styles.panel} aria-label={indicator.title}>
   <h2>{indicator.title}</h2><p className={styles.debtResult}><strong>{indicator.value}</strong></p>
   <dl className={styles.healthDetails}><dt>Fonte</dt><dd>{indicator.source}</dd><dt>Período</dt><dd>{indicator.period}</dd><dt>Regra</dt><dd>{indicator.rule}</dd><dt>Interpretação</dt><dd>{indicator.interpretation}</dd><dt>Limitação</dt><dd>{indicator.limitation}</dd></dl>
  </article>)}
  <section className={styles.panel} aria-label="Trajetória de quitação"><h2>Trajetória de quitação</h2>
   <dl className={styles.healthDetails}><dt>Valor</dt><dd>Informe um orçamento para calcular um cenário; nenhum prazo é presumido.</dd><dt>Fonte</dt><dd>As dívidas abertas e detalhadas na Central de Dívidas. {input.debts.detailedCount} de {input.debts.openCount} passivos abertos têm termos.</dd><dt>Período</dt><dd>Cenário mensal a partir dos saldos atuais, até o horizonte escolhido.</dd><dt>Regra</dt><dd>Taxa fixa declarada, juros antes dos pagamentos, mínimos primeiro e orçamento restante na ordem escolhida.</dd><dt>Interpretação</dt><dd>Compara como o saldo poderia evoluir com o orçamento informado; não é um calendário contratado.</dd><dt>Limitação</dt><dd>Sem tarifas, novas compras ou taxas variáveis. Passivos sem termos ficam fora. Máximo de 50 dívidas e 600 meses; acima do limite, cálculo indisponível, sem total parcial.</dd></dl>
   <WealthDebtSimulator debts={rows.map(r=>({id:r.entry.id,title:r.entry.title,balanceCents:r.entry.amount_cents,monthlyRateBps:r.monthly_rate_bps,minimumCents:r.minimum_cents,priority:r.priority}))}/>
  </section>
 </>
}
