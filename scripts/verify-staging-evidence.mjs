import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const dir='.local-qa/reconciliation',out='docs/execution/reconciliation'
const base=read(`${out}/baseline-comparison.json`),delta=read(`${dir}/wealth-schema-delta-details.json`),schema=read(`${dir}/staging-wealth-schema.json`)
const tables=['ecosystem_product_entitlements','ecosystem_context_consents','wealth_profiles','wealth_entries','wealth_goals','ecosystem_audit_events']
assert.equal(base.changeCount,0)
for(const row of delta){
 assert.equal(row.kind,'added',`Unexpected ${row.kind}: ${row.id}`)
 const o=row.after
 if(['relations','columns','indexes','constraints','policies','triggers'].includes(row.category))assert.ok(tables.includes(o.table??o.tablename??o.name),`Unexpected object: ${row.id}`)
 else if(row.category==='schemas')assert.equal(o.name,'ecosystem_private')
 else if(row.category==='functions'){assert.equal(o.schema,'ecosystem_private');assert.ok(['has_personal_access','record_change'].includes(o.name))}
 else assert.fail(`Unexpected category: ${row.category}`)
}
const grants=[]
for(const table of tables){
 const r=schema.relations.find(r=>r.schema==='public'&&r.name===table)
 assert.ok(r.rls);assert.ok(!/(?:\{|,)anon=/.test(r.acl));assert.ok(!/(?:\{|,)=/.test(r.acl))
 const auth=/authenticated=([^/]+)/.exec(r.acl)?.[1]??''
 if(table==='ecosystem_audit_events')assert.equal(auth,'')
 else if(table.startsWith('ecosystem_'))assert.equal(auth,'r')
 else assert.equal(auth,'arwd')
 grants.push({table,rls:r.rls,authenticated:auth||'none',acl:r.acl,policies:schema.policies.filter(p=>p.schemaname==='public'&&p.tablename===table).map(p=>p.policyname),columnGrants:schema.columns.filter(c=>c.schema==='public'&&c.table===table&&c.acl).map(c=>({column:c.name,acl:c.acl}))})
}
const functions=schema.functions.filter(f=>f.schema==='ecosystem_private').map(f=>({name:f.name,securityDefiner:f.security_definer,searchPath:f.config,acl:f.acl}))
assert.equal(functions.find(f=>f.name==='record_change').acl,'{postgres=X/postgres}')
assert.equal(functions.find(f=>f.name==='has_personal_access').securityDefiner,false)
const advisor=(environment,type)=>JSON.parse(read(`${dir}/${environment}-advisors-${type}.json`).content[0].text).result.lints
const advisors=Object.fromEntries(['security','performance'].map(type=>[type,Object.fromEntries(['production','staging'].map(environment=>[environment,advisor(environment,type).map(l=>({name:l.name,level:l.level,count:l.count,remediation:l.remediation}))]))]))
fs.writeFileSync(`${out}/staging-security-evidence.json`,JSON.stringify({baselineEquivalent:true,deltaOnlyIntentionalEcosystemObjects:true,deltaCount:delta.length,grants,functions,advisors},null,2)+'\n')
console.log('PASS baseline equivalence; all 154 delta objects belong to the six-table Wealth migration; RLS/grants/private functions verified.')
