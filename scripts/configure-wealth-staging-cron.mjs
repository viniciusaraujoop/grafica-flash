import fs from 'node:fs'
const target='zwxulgpjucxudadjdqov'
const mode=process.argv[2]
if(!['enable','pause','inspect'].includes(mode))throw Error('Use enable, pause or inspect')
if(fs.readFileSync('supabase/.temp/project-ref','utf8').trim()!==target)throw Error('Wrong linked project')
const name='orcaly-staging-wealth-recurrences'
// No HTTP endpoints, service secrets or production settings in the cron command.
const command="begin; set local statement_timeout='20s'; set local lock_timeout='2s'; select ecosystem_private.run_wealth_recurrence_batch(25); commit;"
const guard=`do $guard$ begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20260926030809' and name='production_schema_baseline')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20260926164000' and name='wealth_recurrence_clock') then raise exception 'CERTIFIED_STAGING_REQUIRED';end if;
 if exists(select 1 from cron.job where jobname<>'${name}') then raise exception 'UNEXPECTED_CRON_JOB';end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'PG_CRON_REQUIRED';end if;
end $guard$;`
const inspection=`select jobid,jobname,schedule,active,command from cron.job where jobname='${name}';
select d.runid,d.status,d.start_time,d.end_time from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='${name}' order by d.runid desc limit 5;`
const mutation=mode==='enable'?`select cron.schedule('${name}','* * * * *',${"'"+command.replaceAll("'","''")+"'"});`:
 mode==='pause'?`select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='${name}';`:''
const out='.local-qa/reconciliation/wealth-staging-cron.sql'
fs.writeFileSync(out,`begin;\n${guard}\n${mutation}\n${inspection}\ncommit;\n`)
console.log(JSON.stringify({target,mode,executionFile:out,networkCalls:false,jobType:'wealth.recurrence'}))
