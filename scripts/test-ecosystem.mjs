import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { safeNextPath } from '../lib/auth-navigation.ts'
import { products, getProduct, productIds, isProductId } from '../lib/ecosystem/products.ts'
import { activeGrant, evaluateProductAccess, permitsContextTransfer } from '../lib/ecosystem/access.ts'
import { parseMoney, parseRateBps, financialDate, simulateGoal, summarizeEntries, validateEntry, validateProfile, validateGoal } from '../lib/wealth/core.ts'

const now = Date.parse('2026-09-26T12:00:00Z')
test('auth redirects preserve product paths and deny protocol-relative/backslash/encoded targets',()=>{
 assert.equal(safeNextPath('/apps/wealth'),'/apps/wealth')
 for(const target of ['https://evil.test','//evil.test','/\\evil.test','/%5cevil.test','/%255cevil.test','/apps%0d%0aLocation:evil.test','/login','/mfa'])assert.equal(safeNextPath(target),'/painel/inicio')
})
const grant = { product_id: 'wealth', user_id: 'a', company_id: null, permissions: ['wealth.read','wealth.write'], status: 'active', starts_at: '2026-01-01T00:00:00Z', expires_at: null }
const input = { product: getProduct('wealth'), actorId: 'a', context: { kind: 'personal', id: 'a' }, member: true, permission: 'wealth.read', permissionAllowed: true, rolloutEnabled: true, grants: [grant], now }

test('exactly eight unique products; Life is not a product', () => {
  assert.equal(products.length,8); assert.equal(new Set(products.map(p=>p.id)).size,8)
  assert.deepEqual(products.map(p=>p.id), productIds); assert.equal(getProduct('life'),undefined)
  assert.equal(isProductId('__proto__'),false); assert.equal(isProductId(null),false)
})
test('every declared image is a real asset; no invented primary for missing artwork', () => {
  for(const product of products){ assert.ok(existsSync(`public${product.brand.secondary}`)); if(product.brand.primary)assert.ok(existsSync(`public${product.brand.primary}`)); assert.equal(product.domain,null); assert.equal(product.installability.enabled,false) }
  assert.equal(getProduct('business').brand.primary,null)
})
test('an active grant plus ownership and permission allows access', () => assert.deepEqual(evaluateProductAccess(input),{allowed:true,reason:'allowed'}))
for(const [name,patch,reason] of [
  ['other user',{actorId:'b'},'context'], ['other personal workspace',{context:{kind:'personal',id:'b'}},'context'],
  ['company context for personal product',{context:{kind:'company',id:'a'}},'context'],
  ['no membership',{member:false},'context'],['no grant',{grants:[]},'entitlement'],
  ['missing permission',{permission:'wealth.execute'},'permission'],['denied permission',{permissionAllowed:false},'permission'],
  ['closed release switch',{rolloutEnabled:false},'unavailable'], ['planned product',{product:getProduct('flow')},'unavailable'],
  ['forged company grant',{grants:[{...grant,user_id:null,company_id:'a'}]},'entitlement'],
  ['expired grant',{grants:[{...grant,expires_at:new Date(now).toISOString()}]},'entitlement'],
  ['revoked grant',{grants:[{...grant,status:'revoked'}]},'entitlement'],
]) test(`access denies ${name}`,()=> assert.deepEqual(evaluateProductAccess({...input,...patch}),{allowed:false,reason}))
test('malformed time and future grants deny',()=>{assert.equal(activeGrant({...grant,expires_at:'invalid'},now),false);assert.equal(activeGrant({...grant,starts_at:'2200-01-01'},now),false);assert.equal(activeGrant(grant,NaN),false)})
const contract = { id:'consent', actor_id:'a', source_product:'business',target_product:'wealth',source_context:{kind:'company',id:'company-a'},target_context:{kind:'personal',id:'a'},data_scope:'financial.summary',purpose:'personal.planning',granted_at:'2026-01-01',expires_at:'2027-01-01',revoked_at:null }
const request = {actorId:'a',sourceProduct:'business',targetProduct:'wealth',sourceContext:contract.source_context,targetContext:contract.target_context,dataScope:contract.data_scope,purpose:contract.purpose,sourceAuthorized:true,targetAuthorized:true,now}
test('consent is valid only for the exact authorized contract',()=>assert.equal(permitsContextTransfer(contract,request),true))
for(const [name,patch] of [['another user',{actorId:'b'}],['another purpose',{purpose:'advertising'}],['wildcard scope',{dataScope:'*'}],['another tenant',{sourceContext:{kind:'company',id:'company-b'}}],['unauthorized source',{sourceAuthorized:false}],['unauthorized target',{targetAuthorized:false}],['expiry',{now:Date.parse('2027-01-01')}]])test(`consent denies ${name}`,()=>assert.equal(permitsContextTransfer(contract,{...request,...patch}),false))
test('revocation is immediate',()=>assert.equal(permitsContextTransfer({...contract,revoked_at:'2026-09-26'},request),false))
test('money parsing is exact in cents with comma or point',()=>{assert.equal(parseMoney('0,29'),29);assert.equal(parseMoney('49.90'),4990);assert.equal(parseMoney('0'),0)})
for(const value of ['1e4','1,234.56','-1','NaN','0.001','Infinity',null,12])test(`money rejects ${String(value)}`,()=>assert.throws(()=>parseMoney(value)))
test('dates reject overflow, non-leap February and ambiguous input',()=>{assert.throws(()=>financialDate('2026-02-29'));assert.throws(()=>financialDate('2026-04-31'));assert.throws(()=>financialDate('26/09/2026'));assert.equal(financialDate('2028-02-29'),'2028-02-29')})
test('zero-return scenario sums contributions exactly',()=>{const result=simulateGoal({initialCents:29,monthlyCents:10,monthlyRateBps:0,months:12});assert.equal(result.finalCents,149);assert.equal(result.kind,'scenario')})
test('user-facing percentage converts to integer basis points exactly',()=>{assert.equal(parseRateBps('0,50'),50);assert.equal(parseRateBps('-1.25'),-125);assert.throws(()=>parseRateBps('101'));assert.throws(()=>parseRateBps('1e3'))})
test('compound monthly scenario uses integer rounding and end-month deposits',()=>{assert.equal(simulateGoal({initialCents:10000,monthlyCents:1000,monthlyRateBps:100,months:2}).finalCents,12211)})
test('negative return scenario and precision limits',()=>{assert.equal(simulateGoal({initialCents:10000,monthlyCents:1000,monthlyRateBps:-10000,months:2}).finalCents,1000);assert.throws(()=>simulateGoal({initialCents:100000000000000,monthlyCents:0,monthlyRateBps:10000,months:600}))})
test('summary separates current-month cash flow from registered assets',()=>{const entries=[{kind:'income',amount_cents:10000,financial_date:'2026-09-01'},{kind:'expense',amount_cents:2000,financial_date:'2026-08-01'},{kind:'asset',amount_cents:50000,financial_date:'2026-01-01'},{kind:'liability',amount_cents:10000,financial_date:'2026-01-01'}];assert.deepEqual(summarizeEntries(entries,'2026-09'),{income:10000,expenses:0,assets:50000,liabilities:10000,netWorth:40000,cashFlow:10000})})
test('validators whitelist fields and reject malformed record types',()=>{
 const entry=validateEntry({title:' Salário ',kind:'income',category:'salary',amount:'25.45',financial_date:'2026-09-26',recurrence:'none',idempotency_key:'11111111-1111-4111-8111-111111111111',user_id:'victim'})
 assert.equal(entry.user_id,undefined);assert.equal(entry.amount_cents,2545);assert.equal(entry.title,'Salário');assert.throws(()=>validateEntry({...entry,kind:'execute'}))
 assert.throws(()=>validateGoal({title:'Meta',target:'0',saved:'0',monthly_contribution:'0',target_date:'2026-09-26'}))
 assert.throws(()=>validateProfile({monthly_income:'10',monthly_budget:'10',dependents:'1',emergency_months:'6',timezone:'invalid'}))
})
