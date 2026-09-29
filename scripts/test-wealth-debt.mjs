import assert from 'node:assert/strict'
import {test} from 'node:test'
import {registerHooks} from 'node:module'
const hook=registerHooks({resolve(specifier,ctx,next){return next(specifier==='./core'?new URL('../lib/wealth/core.ts',import.meta.url).href:specifier,ctx)}})
const {simulateDebtPlan}=await import('../lib/wealth/debt.ts');hook.deregister()
const {validateEntry}=await import('../lib/wealth/core.ts')
const debt=(extra={})=>({id:'a',title:'Sintética',balanceCents:10000,monthlyRateBps:0,minimumCents:1000,priority:1,...extra})
test('fixed budget rolls forward without overpayment and preserves the accounting identity',()=>{
 const result=simulateDebtPlan([debt()],3000,'snowball')
 assert.equal(result.status,'paid_off');assert.equal(result.months,4);assert.equal(result.paidCents,'10000');assert.equal(result.timeline.at(-1).paidCents,'1000')
 assert.equal(BigInt(result.initialCents)+BigInt(result.interestCents)-BigInt(result.paidCents),BigInt(result.remainingCents))
})
test('minimums are honored before strategy; avalanche and custom allocate extra to distinct targets',()=>{
 const rows=[debt({balanceCents:10000,priority:1}),debt({id:'b',balanceCents:20000,monthlyRateBps:200,priority:2})]
 const snow=simulateDebtPlan(rows,6000,'snowball'),avalanche=simulateDebtPlan(rows,6000,'avalanche'),custom=simulateDebtPlan(rows,6000,'custom')
 assert.ok(snow.debts[0].paidOffMonth<snow.debts[1].paidOffMonth)
 assert.ok(avalanche.debts[1].paidOffMonth<avalanche.debts[0].paidOffMonth)
 assert.ok(BigInt(avalanche.interestCents)<BigInt(snow.interestCents));assert.deepEqual(custom,snow)
})
test('insufficient budget never invents partial minimum payments or a payoff date',()=>{
 const result=simulateDebtPlan([debt(),debt({id:'b'})],1999,'avalanche')
 assert.equal(result.status,'budget_below_minimums');assert.equal(result.requiredMinimumCents,'2000');assert.equal(result.paidCents,'0')
 assert.ok(result.debts.every(d=>d.paidOffMonth===null))
})
test('unamortized debt reports the horizon, fixed interest compounds with exact BigInt arithmetic',()=>{
 const result=simulateDebtPlan([debt({balanceCents:100000000000000,minimumCents:0,monthlyRateBps:10000})],1,'avalanche',10)
 assert.equal(result.status,'horizon_reached');assert.equal(result.months,10)
 assert.equal(result.remainingCents,(100000000000000n*1024n-1023n).toString())
 assert.equal(BigInt(result.initialCents)+BigInt(result.interestCents)-BigInt(result.paidCents),BigInt(result.remainingCents))
 const half=simulateDebtPlan([debt({balanceCents:1,minimumCents:0,monthlyRateBps:5000})],2,'snowball');assert.equal(half.interestCents,'1')
})
test('paid debts, duplicate identity, fractional cents, invalid rates and oversized plans are explicit',()=>{
 const entry={title:'Quitada',kind:'liability',category:'loan',amount:'0',financial_date:'2026-09-26',recurrence:'none',idempotency_key:'11111111-1111-4111-8111-111111111111'}
 assert.equal(validateEntry(entry).amount_cents,0)
 for(const kind of ['income','expense','asset'])assert.throws(()=>validateEntry({...entry,kind}))
 assert.equal(simulateDebtPlan([debt({balanceCents:0})],1,'snowball').months,0)
 assert.throws(()=>simulateDebtPlan([debt(),debt()],1000,'snowball'),/repetida/)
 assert.throws(()=>simulateDebtPlan([debt({balanceCents:0.29})],1000,'snowball'))
 assert.throws(()=>simulateDebtPlan([debt({monthlyRateBps:-1})],1000,'snowball'))
 assert.throws(()=>simulateDebtPlan(Array.from({length:51},(_,i)=>debt({id:String(i)})),1000,'snowball'),/50/)
 assert.throws(()=>simulateDebtPlan([debt()],1000,'unknown'))
})
