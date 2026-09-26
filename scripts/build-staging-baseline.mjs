import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'

const source='.local-qa/reconciliation'
const schema=JSON.parse(fs.readFileSync(`${source}/production-schema.json`,'utf8'))
const initial=JSON.parse(fs.readFileSync(`${source}/staging-initial-schema.json`,'utf8'))
const comments=JSON.parse(fs.readFileSync(`${source}/production-comments.json`,'utf8'))
const app=['public','api','orcaly_private']
const q=value=>'"'+value.replaceAll('"','""')+'"'
const name=row=>`${q(row.schema)}.${q(row.name)}`
const literal=value=>"'"+value.replaceAll("'","''")+"'"
const sha=value=>createHash('sha256').update(value).digest('hex')
const generated=fs.readdirSync('.local-qa/staging-workdir/supabase/migrations').find(f=>f.endsWith('_production_schema_baseline.sql'))
if(!generated)throw new Error('First generate a baseline filename using supabase migration new in the isolated workdir.')
const relations=schema.relations.filter(r=>app.includes(r.schema))
if(schema.types?.length||relations.some(r=>!['r','v','S'].includes(r.kind)||r.partition||r.persistence!=='p'))throw new Error('Unsupported object type: baseline requires explicit generator extension/review.')
const sql=['-- Schema-only catalog baseline. No client/auth/Vault rows, cron jobs or external calls.','-- Generated from production metadata; apply ONLY to the verified empty staging project.', 'begin;', "set local statement_timeout = '90s';", "set local lock_timeout = '5s';", 'set local check_function_bodies = false;', 'set local search_path = pg_catalog, public, extensions;',
`do $guard$ begin
 if current_setting('orcaly.staging_guard', true) is distinct from 'zwxulgpjucxudadjdqov' then raise exception 'STAGING_GUARD_REQUIRED'; end if;
 if current_user <> 'postgres' then raise exception 'BASELINE_REQUIRES_POSTGRES_OWNER'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) then raise exception 'BASELINE_REQUIRES_EMPTY_PUBLIC_SCHEMA'; end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) or exists(select 1 from vault.secrets) then raise exception 'BASELINE_REQUIRES_NO_PERSONAL_DATA_OR_SECRETS'; end if;
end $guard$;`]
const add=value=>sql.push(value)
for(const e of schema.extensions){if(!initial.extensions.some(s=>s.name===e.name)){if(e.name!=='pg_cron')throw new Error('Unreviewed extension '+e.name);add(`create extension if not exists ${q(e.name)} with schema ${q(e.schema)} version ${literal(e.version)};`)}else if(!initial.extensions.some(s=>s.name===e.name&&s.version===e.version&&s.schema===e.schema))throw new Error('Extension version mismatch '+e.name)}
for(const s of schema.schemas.filter(s=>app.includes(s.name)&&s.name!=='public'))add(`create schema ${q(s.name)} authorization ${q(s.owner)};`)
for(const table of relations.filter(r=>r.kind==='r')){
 const columns=schema.columns.filter(c=>c.schema===table.schema&&c.table===table.name).map(c=>{
  let def=`  ${q(c.name)} ${c.type}`
  if(c.generated){if(c.generated!=='s'||!c.default)throw new Error('Unknown generated column kind');def+=` generated always as (${c.default}) stored`}
  if(c.identity){const seq=schema.sequences.find(s=>s.owned_by===`${c.schema}.${c.table}.${c.name}`);if(!seq)throw new Error('Missing identity sequence');def+=` generated ${c.identity==='a'?'always':'by default'} as identity (sequence name ${name(seq)} start with ${seq.start} increment by ${seq.increment} minvalue ${seq.min} maxvalue ${seq.max} cache ${seq.cache}${seq.cycle?' cycle':' no cycle'})`}
  if(c.not_null)def+=' not null'
  return def
 })
 add(`create table ${name(table)} (\n${columns.join(',\n')}\n);`)
}
// Table composite return types must exist before CREATE FUNCTION. The two stored
// generated columns in this snapshot use only built-in lower/btrim functions.
for(const f of schema.functions.filter(f=>app.includes(f.schema))){
 if(/https?:\/\/|net\.http|http_post|dblink|eyJ[A-Za-z0-9_-]{20}/i.test(f.definition))throw new Error('Potential external action/credential requires review: '+f.name)
 add(f.definition.trimEnd()+';')
}
for(const c of schema.columns.filter(c=>app.includes(c.schema)&&c.default!==null&&!c.generated))add(`alter table ${q(c.schema)}.${q(c.table)} alter column ${q(c.name)} set default ${c.default};`)
for(const type of ['p','u','c','x','f'])for(const c of schema.constraints.filter(c=>app.includes(c.schema)&&c.type===type))add(`alter table ${q(c.schema)}.${q(c.table)} add constraint ${q(c.name)} ${c.definition};`)
for(const idx of schema.indexes.filter(i=>app.includes(i.schema)&&!i.constraint))add(idx.definition+';')
const waiting=relations.filter(r=>r.kind==='v'),created=new Set()
while(waiting.length){const ix=waiting.findIndex(v=>!waiting.some(other=>other!==v&&new RegExp('\\b'+other.name+'\\b').test(v.view)));if(ix<0)throw new Error('Unresolved view dependency');const [v]=waiting.splice(ix,1);add(`create view ${name(v)}${v.options?.length?' with ('+v.options.join(', ')+')':''} as ${v.view.trim().replace(/;$/,'')};`);created.add(v.name)}
for(const t of relations.filter(r=>r.kind==='r')){if(t.rls)add(`alter table ${name(t)} enable row level security;`);if(t.force_rls)add(`alter table ${name(t)} force row level security;`);if(t.options?.length)add(`alter table ${name(t)} set (${t.options.join(', ')});`);if(t.replica_identity!=='d')throw new Error('Unexpected replica identity for '+t.name)}
for(const p of schema.policies.filter(p=>app.includes(p.schemaname)||p.schemaname==='storage'))add(`create policy ${q(p.policyname)} on ${q(p.schemaname)}.${q(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'PUBLIC':q(r)).join(', ')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`)
for(const t of schema.triggers.filter(t=>app.includes(t.schema))){add(t.definition+';');if(t.enabled!=='O')add(`alter table ${q(t.schema)}.${q(t.table)} ${t.enabled==='D'?'disable':t.enabled==='A'?'enable always':'enable replica'} trigger ${q(t.name)};`)}
const privilege={a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE',U:'USAGE',C:'CREATE',c:'CONNECT',T:'TEMPORARY'}
function aclEntries(acl){if(acl===null)return null;if(!/^\{[^"\\]*\}$/.test(acl))throw new Error('Complex ACL requires explicit parser review');return acl.slice(1,-1).split(',').filter(Boolean).map(item=>{const [role,rest]=item.split('=');const [letters,grantor]=rest.split('/');return {role,letters,grantor}})}
function acl(kind,object,raw,owner){
 const entries=aclEntries(raw)??[{role:owner,letters:kind==='FUNCTION'?'X':kind==='SCHEMA'?'UC':kind==='SEQUENCE'?'rwU':'arwdDxtm',grantor:owner},...(kind==='FUNCTION'?[{role:'',letters:'X',grantor:owner}]:[])]
 const roles=[...new Set(['','anon','authenticated','service_role',owner,...entries.map(e=>e.role)])]
 add(`revoke all privileges on ${kind} ${object} from ${roles.map(r=>r?q(r):'PUBLIC').join(', ')};`)
 for(const entry of entries){for(let i=0;i<entry.letters.length;i++){const letter=entry.letters[i];if(!privilege[letter])throw new Error('Unknown privilege '+letter);const grantOption=entry.letters[i+1]==='*';if(grantOption)i++;add(`grant ${privilege[letter]} on ${kind} ${object} to ${entry.role?q(entry.role):'PUBLIC'}${grantOption?' with grant option':''};`)}}
}
for(const s of schema.schemas.filter(s=>app.includes(s.name)))acl('SCHEMA',q(s.name),s.acl,s.owner)
for(const r of relations)acl(r.kind==='S'?'SEQUENCE':'TABLE',name(r),r.acl,r.owner)
for(const f of schema.functions.filter(f=>app.includes(f.schema)))acl('FUNCTION',`${name(f)}(${f.args})`,f.acl,f.owner)
for(const c of schema.columns.filter(c=>app.includes(c.schema)&&c.acl)){
 const entries=aclEntries(c.acl)
 const target=`${q(c.schema)}.${q(c.table)}`
 const roles=[...new Set(['','anon','authenticated','service_role',...entries.map(e=>e.role)])]
 add(`revoke all privileges (${q(c.name)}) on table ${target} from ${roles.map(r=>r?q(r):'PUBLIC').join(', ')};`)
 for(const entry of entries){for(let i=0;i<entry.letters.length;i++){
  const letter=entry.letters[i];if(!'rawx'.includes(letter))throw new Error('Unsupported column privilege '+letter)
  const grantOption=entry.letters[i+1]==='*';if(grantOption)i++
  add(`grant ${privilege[letter]} (${q(c.name)}) on table ${target} to ${entry.role?q(entry.role):'PUBLIC'}${grantOption?' with grant option':''};`)
 }}
}
// Default privileges are platform prerequisites, checked against the clean target snapshot.
for(const d of schema.default_acl.filter(d=>d.schema!=='cron'))if(!initial.default_acl.some(i=>JSON.stringify(i)===JSON.stringify(d)))throw new Error('Default ACL mismatch requires explicit handling: '+JSON.stringify(d))
// Existing stock auth/storage grants and Supabase event triggers were compared read-only and are identical.
for(const c of comments){const target=c.kind==='function'?`function ${q(c.schema)}.${q(c.name)}(${c.subname})`:c.subname?`column ${q(c.schema)}.${q(c.name)}.${q(c.subname)}`:`${relations.find(r=>r.schema===c.schema&&r.name===c.name)?.kind==='v'?'view':'table'} ${q(c.schema)}.${q(c.name)}`;add(`comment on ${target} is ${literal(c.description)};`)}
add("do $guard$ begin if exists(select 1 from cron.job) then raise exception 'STAGING_CRON_MUST_REMAIN_EMPTY'; end if; end $guard$;")
add('commit;')
const ddl=sql.join('\n\n')+'\n'
const dir='supabase/baselines';fs.mkdirSync(dir,{recursive:true})
const file=path.join(dir,generated);fs.writeFileSync(file,ddl)
const manifest={version:generated.split('_')[0],name:'production_schema_baseline',file:file.replaceAll('\\','/'),sha256:sha(ddl),sourceProject:'ozrasuktfthsvbqprtel',onlyAllowedTarget:'zwxulgpjucxudadjdqov',capturedAt:new Date().toISOString(),sourceSnapshotSha256:sha(fs.readFileSync(`${source}/production-schema.json`)),kind:'schema-only-catalog-baseline',counts:{tables:relations.filter(r=>r.kind==='r').length,views:relations.filter(r=>r.kind==='v').length,sequences:schema.sequences.length,functions:schema.functions.filter(f=>app.includes(f.schema)).length,policies:schema.policies.filter(p=>app.includes(p.schemaname)||p.schemaname==='storage').length,triggers:schema.triggers.filter(t=>app.includes(t.schema)).length},excluded:['All application rows','auth.users and other auth data','storage objects','Vault secrets','Migration ledger data','Cron jobs','External webhooks and connector credentials'],followingMigration:'supabase/migrations/20260926014103_ecosystem_identity_wealth.sql'}
fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({file,bytes:Buffer.byteLength(ddl),...manifest.counts,sha256:manifest.sha256},null,2))
