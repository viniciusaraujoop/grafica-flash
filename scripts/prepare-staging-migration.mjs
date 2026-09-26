import fs from 'node:fs'
import {createHash} from 'node:crypto'

// Explicit order only. Never pass the historical migrations directory to db push.
const target='zwxulgpjucxudadjdqov'
const stage=process.argv[2]
if(!['baseline','wealth'].includes(stage))throw new Error('Usage: node scripts/prepare-staging-migration.mjs baseline|wealth')
if(fs.readFileSync('supabase/.temp/project-ref','utf8').trim()!==target)throw new Error('CLI is not linked to the approved staging project')
const manifest=JSON.parse(fs.readFileSync('supabase/baselines/manifest.json','utf8'))
if(manifest.onlyAllowedTarget!==target)throw new Error('Target mismatch')
const file=stage==='baseline'?manifest.file:manifest.followingMigration
const sql=fs.readFileSync(file,'utf8')
const hash=createHash('sha256').update(sql).digest('hex')
if(stage==='baseline'&&hash!==manifest.sha256)throw new Error('Baseline changed since manifest generation')
const version=file.split('/').at(-1).split('_')[0]
const name=stage==='baseline'?manifest.name:'ecosystem_identity_wealth'
const lit=s=>"'"+s.replaceAll("'","''")+"'"
const ledger=`
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
 version text primary key, statements text[], name text,
 created_by text, idempotency_key text, rollback text[]
);
revoke all on schema supabase_migrations from public, anon, authenticated;
revoke all on supabase_migrations.schema_migrations from public, anon, authenticated;
insert into supabase_migrations.schema_migrations(version,name,statements)
values (${lit(version)},${lit(name)},array[${lit(sql)}]);
`
const guard=`do $staging_guard$ begin
 if current_setting('orcaly.staging_guard',true) is distinct from '${target}' then raise exception 'STAGING_GUARD_REQUIRED'; end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) then raise exception 'STAGING_MUST_HAVE_NO_CUSTOMER_DATA'; end if;
 ${stage==='wealth'?`if not exists(select 1 from supabase_migrations.schema_migrations where version='${manifest.version}' and name='production_schema_baseline') then raise exception 'BASELINE_REQUIRED'; end if;`:''}
end $staging_guard$;`
if(!/\bcommit;\s*$/i.test(sql))throw new Error('Expected a single terminal transaction commit')
// Callback replacements preserve literal $ sequences inside the recorded function SQL.
const body=sql.replace(/\bbegin;/i,()=>`begin;\nset local orcaly.staging_guard = '${target}';\n${guard}`).replace(/\bcommit;\s*$/i,()=>ledger+'\ncommit;')
const out=`.local-qa/reconciliation/apply-${stage}-staging.sql`
fs.writeFileSync(out,body)
console.log(JSON.stringify({target,stage,file,version,sha256:hash,executionFile:out,bytes:Buffer.byteLength(body)},null,2))
