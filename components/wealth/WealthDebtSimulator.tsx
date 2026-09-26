'use client'
import {useState} from 'react'
import {simulateDebtPlan,debtStrategies,type DebtPlanInput,type DebtStrategy} from '@/lib/wealth/debt'
import {parseMoney,formatMoney,integer} from '@/lib/wealth/core'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default function WealthDebtSimulator({debts}:{debts:DebtPlanInput[]}){
 const [result,setResult]=useState<ReturnType<typeof simulateDebtPlan>|null>(null),[error,setError]=useState('')
 if(debts.length>50)return <p>A simulação está indisponível: existem mais de 50 dívidas abertas. Nenhum total parcial foi apresentado.</p>
 if(!debts.length)return <p>Detalhe uma dívida com saldo em aberto para comparar estratégias.</p>
 return <><p>Usa as {debts.length} dívidas detalhadas e abertas. Taxas mensais fixas, juros antes do pagamento, mínimos primeiro e o restante na ordem escolhida. Sem novas compras, multas ou tarifas; valores arredondados por dívida em centavos. Datas de vencimento e parcelas são registros informativos, sem simulação de juros diários. Resultado hipotético, não é garantia nem acordo com credores.</p>
 <form aria-label="Simular dívidas" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{setResult(simulateDebtPlan(debts,parseMoney(form.get('budget'),false),String(form.get('strategy')) as DebtStrategy,integer(form.get('months'),1,600)));setError('')}catch(e){setResult(null);setError(e instanceof Error?e.message:'Confira os campos.')}}} className={styles.formGrid}>
 <label>Orçamento mensal total (R$)<input name="budget" inputMode="decimal" required/></label>
 <label>Estratégia<select name="strategy">{Object.entries(debtStrategies).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>Prazo máximo de simulação (meses)<input name="months" type="number" min="1" max="600" defaultValue="360" required/></label>
 <button className={styles.primaryButton}>Simular quitação</button></form>
 {error&&<p role="alert">{error}</p>}
 {result&&<div role="status" className={`${styles.notice} ${styles.debtResult}`}>
 <h3>Resultado da simulação</h3>
 <p>{result.status==='paid_off'?`Quitação simulada em ${result.months} mês(es).`:result.status==='budget_below_minimums'?`Orçamento insuficiente para os mínimos: ${formatMoney(result.requiredMinimumCents)} no mês ${result.months}. Não foi projetada uma data de quitação.`:`Ainda há saldo após ${result.months} meses. Não foi projetada uma data de quitação.`}</p>
 <p>Saldo inicial: {formatMoney(result.initialCents)}. Juros simulados: {formatMoney(result.interestCents)}. Total pago na simulação: {formatMoney(result.paidCents)}. Saldo final: {formatMoney(result.remainingCents)}.</p>
 <ul>{result.debts.map(d=><li key={d.id}>{d.title}: {d.paidOffMonth===null?'não quitada no cenário':`quitada no mês ${d.paidOffMonth}`} · juros {formatMoney(d.interestCents)}.</li>)}</ul>
 <details><summary>Ver evolução mensal</summary><div className={styles.tableWrap}><table className={styles.table}><caption>Valores hipotéticos por mês</caption><thead><tr><th scope="col">Mês</th><th scope="col">Pago</th><th scope="col">Juros</th><th scope="col">Saldo</th></tr></thead><tbody>{result.timeline.map(row=><tr key={row.month}><td>{row.month}</td><td>{formatMoney(row.paidCents)}</td><td>{formatMoney(row.interestCents)}</td><td>{formatMoney(row.remainingCents)}</td></tr>)}</tbody></table></div></details>
 </div>}</>
}
