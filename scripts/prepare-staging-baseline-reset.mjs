import fs from 'node:fs'
// Only for rehearsing the newly created, empty staging baseline. Never a production reset.
const target='zwxulgpjucxudadjdqov'
if(fs.readFileSync('supabase/.temp/project-ref','utf8').trim()!==target)throw new Error('Wrong linked project')
const snapshot=JSON.parse(fs.readFileSync('.local-qa/reconciliation/staging-baseline-schema.json','utf8'))
const app=['public','api','orcaly_private'],q=s=>'"'+s.replaceAll('"','""')+'"'
const sql=[`begin;
set local statement_timeout='90s';
set local orcaly.staging_guard='${target}';
do $guard$ declare r record; occupied boolean; begin
 if current_setting('orcaly.staging_guard') <> '${target}' then raise exception 'WRONG_TARGET'; end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20260926030809' and name='production_schema_baseline') then raise exception 'ONLY_NEW_BASELINE_CAN_BE_RESET'; end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) or exists(select 1 from vault.secrets) or exists(select 1 from cron.job) then raise exception 'STAGING_NOT_EMPTY'; end if;
 for r in select schemaname,tablename from pg_tables where schemaname in ('public','api','orcaly_private') loop
  execute format('select exists(select 1 from %I.%I limit 1)',r.schemaname,r.tablename) into occupied;
  if occupied then raise exception 'TABLE_NOT_EMPTY: %.%',r.schemaname,r.tablename; end if;
 end loop;
end $guard$;`]
for(const p of snapshot.policies.filter(p=>p.schemaname==='storage'))sql.push(`drop policy ${q(p.policyname)} on ${q(p.schemaname)}.${q(p.tablename)};`)
for(const r of snapshot.relations.filter(r=>app.includes(r.schema)&&['v','r'].includes(r.kind)).sort((a,b)=>a.kind==='v'?-1:b.kind==='v'?1:0))sql.push(`drop ${r.kind==='v'?'view':'table'} if exists ${q(r.schema)}.${q(r.name)} cascade;`)
for(const f of snapshot.functions.filter(f=>app.includes(f.schema)))sql.push(`drop function if exists ${q(f.schema)}.${q(f.name)}(${f.args}) cascade;`)
sql.push('drop schema api;','drop schema orcaly_private;','drop schema supabase_migrations cascade;','commit;')
fs.writeFileSync('.local-qa/reconciliation/reset-empty-staging-baseline.sql',sql.join('\n')+'\n')
console.log('Prepared reset of ONLY the empty staging baseline. Public schema/default privileges and Supabase managed objects are retained.')
