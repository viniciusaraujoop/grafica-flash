'use client'
import {useState,type FormEvent} from 'react'
import {rebalance,futureScenario,type PortfolioView} from '@/lib/wealth/portfolio'
import {parseMoney,parseRateBps,integer,formatMoney,moneyInputValue} from '@/lib/wealth/core'
import {classLabels} from '@/lib/wealth/net-worth'
import styles from './portfolio.module.css'
import shared from '@/components/ecosystem/ecosystem.module.css'

export default function PortfolioSimulators({view,initial,goalGap,goalContribution,debtMinimum}:{view:Pick<PortfolioView,'portfolio'|'unknownValuations'|'groups'>;initial:string;goalGap:string;goalContribution:string;debtMinimum:string}){
 const [allocation,setAllocation]=useState<ReturnType<typeof rebalance>|null>(null),[future,setFuture]=useState<ReturnType<typeof futureScenario>|null>(null),[error,setError]=useState('')
 const lab=view.portfolio.kind==='lab'
 function allocationSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');try{
  if(!lab&&view.unknownValuations!=='0')throw Error('Avalie todas as posições antes de simular o rebalanceamento.')
  const form=new FormData(e.currentTarget);setAllocation(rebalance(lab?view.portfolio.lab_positions:view.groups.filter(g=>g.dimension==='class').map(g=>({class:g.label,amount:g.amount})),view.portfolio.targets,String(parseMoney(form.get('contribution')))))
 }catch(err){setAllocation(null);setError(err instanceof Error?err.message:'Premissas inválidas')}}
 function futureSubmit(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');try{
  const f=new FormData(e.currentTarget);setFuture(futureScenario({initial,goalGap,monthly:String(parseMoney(f.get('monthly'))),monthlyReturnBps:parseRateBps(f.get('return')),monthlyInflationBps:integer(parseRateBps(f.get('inflation')),0,10000),months:integer(f.get('months'),1,600)}))
 }catch(err){setFuture(null);setError(err instanceof Error?err.message:'Premissas inválidas')}}
 return <section className={styles.section} id="simuladores"><h2>Explore possibilidades</h2><p>Cenários pessoais. Nenhuma ordem, movimentação financeira ou recomendação é executada.</p>
  <details className={styles.details}><summary>Rebalanceamento por classe</summary><p>Compara os valores {lab?'hipotéticos':'conhecidos'} com seus alvos. Inclui aporte novo e distribui centavos residuais de forma determinística. Diferença negativa indica redução hipotética; tarifas, tributos e restrições de negociação não estão incluídos.</p>
   <form onSubmit={allocationSubmit} aria-label="Simular rebalanceamento" className={styles.form}><div className={styles.fields}><label>Aporte hipotético (R$)<input name="contribution" inputMode="decimal" required defaultValue="0"/></label></div><button className={shared.primaryButton}>Calcular distribuição</button></form>
   {allocation&&<div className={styles.table} tabIndex={0} role="region" aria-label="Distribuição hipotética"><table><caption>Simulação · não movimenta a carteira</caption><thead><tr><th>Classe</th><th>Atual</th><th>Alvo</th><th>Diferença</th></tr></thead><tbody>{allocation.map(r=><tr key={r.class}><td>{classLabels[r.class]}</td><td>{formatMoney(r.current)}</td><td>{formatMoney(r.target)}</td><td>{formatMoney(r.difference)}</td></tr>)}</tbody></table></div>}
  </details>
  <details className={styles.details}><summary>Future Simulator</summary><p>Parte de {formatMoney(initial)} de patrimônio {lab?'hipotético do Lab':'líquido conhecido, já descontados os passivos'}. Faltam {formatMoney(goalGap)} para as metas declaradas; seus aportes planejados somam {formatMoney(goalContribution)} por mês. Mínimos das dívidas detalhadas: {formatMoney(debtMinimum)} por mês.</p>
   <p>Informe um aporte líquido após despesas e serviço da dívida. Passivos não são subtraídos novamente. Retorno mensal constante só incide sobre saldo positivo; inflação deflaciona o saldo final. Não simula contratos de dívida, impostos ou tarifas. Metas são referência, não recebem recursos automaticamente.</p>
   <form onSubmit={futureSubmit} aria-label="Simular futuro" className={styles.form}><div className={styles.fields}>
    <label>Aporte líquido mensal (R$)<input name="monthly" inputMode="decimal" required defaultValue={BigInt(goalContribution)<=BigInt(100000000000000)?moneyInputValue(Number(goalContribution)):'0'}/></label>
    <label>Retorno mensal hipotético (%)<input name="return" inputMode="decimal" required defaultValue="0"/></label>
    <label>Inflação mensal hipotética (%)<input name="inflation" inputMode="decimal" required defaultValue="0"/></label>
    <label>Horizonte (meses)<input name="months" type="number" min="1" max="600" required defaultValue="120"/></label></div><button className={shared.primaryButton}>Calcular cenário</button></form>
   {future&&<div className={styles.result} role="status">Saldo nominal hipotético: <strong>{formatMoney(future.nominal)}</strong><br/>Em poder de compra de hoje: <strong>{formatMoney(future.real)}</strong><br/>Novos aportes no período: {formatMoney(future.contributed)}. A lacuna atual das metas é {formatMoney(future.goalGap)}; não foi abatida do saldo.</div>}
  </details>{error&&<p className={styles.notice} role="alert">{error}</p>}
 </section>
}
