import fs from 'node:fs'
import {createHash} from 'node:crypto'

const [expectedFile,actualFile,label='schema-comparison']=process.argv.slice(2)
if(!expectedFile||!actualFile)throw new Error('Usage: node scripts/compare-schema-snapshots.mjs expected.json actual.json label')
const expected=JSON.parse(fs.readFileSync(expectedFile,'utf8')),actual=JSON.parse(fs.readFileSync(actualFile,'utf8'))
const keys={roles:['name'],types:['schema','name'],columns:['schema','table','name'],indexes:['schema','name'],schemas:['name'],policies:['schemaname','tablename','policyname'],triggers:['schema','table','name'],functions:['schema','name','args'],relations:['schema','name'],sequences:['schema','name'],extensions:['name'],constraints:['schema','table','name'],default_acl:['role','schema','type'],publications:['name'],event_triggers:['name']}
const hash=s=>createHash('sha256').update(s).digest('hex')
const canonical=value=>{if(Array.isArray(value))return value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value}
function normalize(row){const out={...row};delete out.position;if(typeof out.acl==='string')out.acl=out.acl.slice(1,-1).split(',').sort();if(out.acl===null&&'security_definer' in out)out.acl=[`=X/${out.owner}`,`${out.owner}=X/${out.owner}`].sort();return canonical(out)}
const changes=[],counts={}
for(const [category,fields] of Object.entries(keys)){
 const source=(expected[category]??[]).filter(r=>category!=='schemas'||r.name!=='supabase_migrations')
 const dest=(actual[category]??[]).filter(r=>category!=='schemas'||r.name!=='supabase_migrations')
 const key=r=>fields.map(f=>r[f]??'').join('.')
 const a=new Map(source.map(r=>[key(r),normalize(r)])),b=new Map(dest.map(r=>[key(r),normalize(r)]))
 counts[category]={expected:a.size,actual:b.size}
 for(const id of new Set([...a.keys(),...b.keys()])){const before=a.get(id),after=b.get(id);if(JSON.stringify(before)===JSON.stringify(after))continue;changes.push({category,id,kind:!before?'added':!after?'removed':'changed',fields:before&&after?Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])):null,before,after})}
}
// attnum gaps may differ after schema-only recreation, but visible column order must not.
for(const table of expected.relations.filter(r=>r.kind==='r')){const select=s=>s.columns.filter(c=>c.schema===table.schema&&c.table===table.name).sort((a,b)=>a.position-b.position).map(c=>c.name);if(JSON.stringify(select(expected))!==JSON.stringify(select(actual)))changes.push({category:'column_order',id:`${table.schema}.${table.name}`,kind:'changed',before:select(expected),after:select(actual)})}
const report={label,expectedSha256:hash(fs.readFileSync(expectedFile)),actualSha256:hash(fs.readFileSync(actualFile)),counts,changeCount:changes.length,changes:changes.map(({category,id,kind,fields,before,after})=>({category,id,kind,fields,beforeSha256:before?hash(JSON.stringify(before)):null,afterSha256:after?hash(JSON.stringify(after)):null})),normalizations:['ACL/metadata array ordering','Physical attnum gaps; visible column order checked separately','Migration-ledger schema ACL excluded; ledger intentionally starts at baseline','PostgreSQL/Supabase patch version strings excluded']}
fs.mkdirSync('docs/execution/reconciliation',{recursive:true})
fs.writeFileSync(`docs/execution/reconciliation/${label}.json`,JSON.stringify(report,null,2)+'\n')
fs.writeFileSync(`.local-qa/reconciliation/${label}-details.json`,JSON.stringify(changes,null,2)+'\n')
console.log(JSON.stringify({label,changeCount:changes.length,changes:report.changes.slice(0,12).map(({category,id,kind,fields})=>({category,id,kind,fields}))},null,2))
