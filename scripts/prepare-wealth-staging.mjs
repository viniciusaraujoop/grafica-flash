import fs from 'node:fs'
import {createHash} from 'node:crypto'
const target='zwxulgpjucxudadjdqov'
const files={lifecycle:'supabase/migrations/20260926103114_wealth_lifecycle_aggregates.sql'}
const file=files[process.argv[2]]
if(!file)throw Error('Specify an allowlisted migration: lifecycle')
if(fs.readFileSync('supabase/.temp/project-ref','utf8').trim()!==target)throw Error('Wrong linked project')
const sql=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')
const [version,...parts]=file.split('/').at(-1).replace(/\.sql$/,'').split('_'),name=parts.join('_')
const lit=s=>"'"+s.replaceAll("'","''")+"'"
const guard=`do $guard$ begin
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) then raise exception 'EMPTY_STAGING_REQUIRED'; end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20260926030809' and name='production_schema_baseline')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20260926014103' and name='ecosystem_identity_wealth') then raise exception 'CERTIFIED_BASELINE_REQUIRED'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version=${lit(version)}) then raise exception 'ALREADY_APPLIED'; end if;
end $guard$;`
if(!/^begin;$/m.test(sql)||!sql.trimEnd().endsWith('commit;'))throw Error('Expected transactional migration')
const out='.local-qa/reconciliation/apply-wealth-continuation.sql'
fs.writeFileSync(out,sql.replace(/^begin;$/m,()=>`begin;\n${guard}`).replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values (${lit(version)},${lit(name)},array[${lit(sql)}]);\nnotify pgrst, 'reload schema';\ncommit;`))
console.log(JSON.stringify({target,file,version,name,sha256NormalizedLF:createHash('sha256').update(sql).digest('hex'),executionFile:out},null,2))
