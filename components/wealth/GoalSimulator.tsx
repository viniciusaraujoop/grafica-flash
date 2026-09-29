'use client'

import { useState } from 'react'
import { simulateGoal, parseMoney, parseRateBps, integer, formatMoney } from '@/lib/wealth/core'
import styles from '@/components/ecosystem/ecosystem.module.css'

export default function GoalSimulator() {
  const [result, setResult] = useState<ReturnType<typeof simulateGoal> | null>(null)
  const [error, setError] = useState('')
  function calculate(form: FormData) {
    try {
      setResult(simulateGoal({ initialCents: parseMoney(form.get('initial')), monthlyCents: parseMoney(form.get('monthly')), months: integer(form.get('months'), 1, 600), monthlyRateBps: parseRateBps(form.get('rate')) }))
      setError('')
    } catch (failure) { setResult(null); setError(failure instanceof Error ? failure.message : 'Confira o cenário.') }
  }
  return <section className={styles.panel} aria-labelledby="simulation-title"><h2 id="simulation-title">Simule um caminho para sua meta</h2><p>Cenário hipotético, não uma previsão de retorno. Os valores são calculados no seu dispositivo e não são enviados a um provedor.</p>
    <form action={calculate} className={styles.formGrid}>
      <label>Valor inicial (R$)<input name="initial" inputMode="decimal" defaultValue="0" required /></label>
      <label>Aporte mensal (R$)<input name="monthly" inputMode="decimal" defaultValue="100" required /></label>
      <label>Prazo em meses<input name="months" type="number" min="1" max="600" defaultValue="12" required /></label>
      <label>Taxa mensal hipotética (%)<input name="rate" inputMode="decimal" defaultValue="0" required /><small>Use 0 para simular somente aportes. Uma taxa positiva é uma hipótese, não uma garantia.</small></label>
      <button className={styles.primaryButton} type="submit">Calcular cenário</button>
    </form>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {result && <div aria-live="polite" className={styles.notice}><strong>Valor no cenário: {formatMoney(result.finalCents)}</strong><p>Aportes acumulados: {formatMoney(result.points.at(-1)!.contributedCents)}.</p><p>{result.assumption} O resultado pode variar e não representa promessa de rendimento.</p></div>}
  </section>
}
