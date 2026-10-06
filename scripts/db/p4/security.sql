-- DISPOSABLE LOCAL ONLY. Synthetic fixtures, no auth.users, no permanent provisioning.
-- Execute AFTER signature capture. Any failed assertion aborts; fixtures always roll back.
begin;
create temporary table r10_results(test text primary key, result text not null);
create function pg_temp.expect_error(command text, wanted text) returns void
language plpgsql as $$
declare message text;
begin
  begin execute command; exception when others then get stacked diagnostics message = message_text; end;
  if message is distinct from wanted then raise exception 'R10_EXPECTED_REJECTION_MISSING'; end if;
end $$;
do $$
declare
  actor uuid; owner_actor uuid; prospector uuid; other_prospector uuid;
  missing uuid := gen_random_uuid(); lead uuid; other_lead uuid; invite uuid; test_invite uuid;
  r text; active boolean; cmd text; function_oid oid; spec text; f record;
  email_value text := 'r10-' || gen_random_uuid()::text || '@' || 'example.invalid';
  token_value text := repeat('a',64); expiry timestamptz := now() + interval '1 day';
  constraint_state text;
begin
  if inet_server_addr() is not null or current_user <> 'postgres' then raise exception 'R10_NOT_LOCAL_POSTGRES'; end if;
  if exists(select 1 from public.platform_admins) or exists(select 1 from public.founder_invites)
     or exists(select 1 from public.signup_leads) or exists(select 1 from auth.users)
  then raise exception 'R10_SYNTHETIC_TEST_REQUIRES_EMPTY_DATA'; end if;
  foreach r in array array['is_active','automatic_payout_enabled'] loop
    if (select pg_get_expr(d.adbin,d.adrelid) from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid='public.marketplace_payment_settings'::regclass and a.attname=r) is distinct from 'false'
    then raise exception 'R10_PAYMENT_DEFAULT_NOT_FALSE'; end if;
    insert into r10_results values ('payment_default_'||r,'PASS');
  end loop;
  foreach spec in array array[
    'public.create_founder_invite_for_sales_lead(uuid,uuid,text,text,timestamptz,integer)',
    'public.create_founder_test_invite(uuid,text,text,text,timestamptz)',
    'public.rotate_founder_invite_token(uuid,uuid,text,timestamptz)',
    'public.revoke_founder_invite(uuid,uuid,text)',
    'public.expire_pending_founder_invites()'
  ] loop
    function_oid := to_regprocedure(spec);
    if function_oid is null then raise exception 'R10_FUNCTION_SIGNATURE_MISSING'; end if;
    select * into strict f from pg_proc where oid=function_oid;
    if not f.prosecdef or pg_get_userbyid(f.proowner)<>'postgres'
       or f.proconfig is distinct from array['search_path=pg_catalog, public']::text[]
    then raise exception 'R10_FUNCTION_SECURITY_BOUNDARY_CHANGED'; end if;
    if exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) where grantee=0 and privilege_type='EXECUTE')
       or has_function_privilege('anon',function_oid,'EXECUTE')
       or has_function_privilege('authenticated',function_oid,'EXECUTE')
       or not has_function_privilege('service_role',function_oid,'EXECUTE')
    then raise exception 'R10_FUNCTION_EXECUTE_BOUNDARY_CHANGED'; end if;
    insert into r10_results values (spec,'PASS_SECURITY_DEFINER_OWNER_SEARCH_PATH_AND_EFFECTIVE_ACL');
  end loop;
  -- No owner exists: arbitrary/missing actor cannot exercise any of the four routes.
  foreach cmd in array array[
    format('select public.create_founder_test_invite(%L,%L,%L,%L,%L)',missing,email_value,'basico',token_value,expiry),
    format('select public.create_founder_invite_for_sales_lead(%L,%L,%L,%L,%L)',missing,missing,'basico',token_value,expiry),
    format('select public.rotate_founder_invite_token(%L,%L,%L,%L)',missing,missing,token_value,expiry),
    format('select public.revoke_founder_invite(%L,%L)',missing,missing)
  ] loop
    perform pg_temp.expect_error(cmd,case when cmd like '%create_founder_test_invite%' then 'FOUNDER_TEST_OWNER_ONLY' else 'FOUNDER_ACTOR_NOT_ALLOWED' end);
  end loop;
  insert into r10_results values ('zero_owner_missing_actor','PASS');
  -- Real client-role execution must fail with insufficient_privilege, not just catalog evidence.
  foreach r in array array['anon','authenticated'] loop
    execute format('set local role %I',r);
    constraint_state := null;
    begin
      perform public.create_founder_test_invite(missing,email_value,'basico',token_value,expiry);
    exception when others then get stacked diagnostics constraint_state=returned_sqlstate; end;
    reset role;
    if constraint_state is distinct from '42501' then raise exception 'R10_CLIENT_EXECUTE_NOT_DENIED'; end if;
    insert into r10_results values ('actual_execute_denied_'||r,'PASS');
  end loop;
  -- Actor matrix on ALL paths. Other recognized roles cannot inherit OWNER authority.
  foreach r in array array['NULL_ACTOR','admin','support','finance','super_admin','owner','prospector'] loop
    active := r not in ('owner','prospector'); -- inactive owner/prospector must fail too.
    actor := null;
    if r <> 'NULL_ACTOR' then
      insert into public.platform_admins(email,role,is_active) values('r10-'||gen_random_uuid()::text||'@'||'example.invalid',r,active) returning id into actor;
    end if;
    perform pg_temp.expect_error(format('select public.create_founder_test_invite(%L,%L,%L,%L,%L)',actor,email_value,'basico',token_value,expiry),'FOUNDER_TEST_OWNER_ONLY');
    perform pg_temp.expect_error(format('select public.create_founder_invite_for_sales_lead(%L,%L,%L,%L,%L)',actor,missing,'basico',token_value,expiry),'FOUNDER_ACTOR_NOT_ALLOWED');
    perform pg_temp.expect_error(format('select public.rotate_founder_invite_token(%L,%L,%L,%L)',actor,missing,token_value,expiry),'FOUNDER_ACTOR_NOT_ALLOWED');
    perform pg_temp.expect_error(format('select public.revoke_founder_invite(%L,%L)',actor,missing),'FOUNDER_ACTOR_NOT_ALLOWED');
    insert into r10_results values ('actor_rejected_'||r,'PASS');
  end loop;
  -- NULL/invalid roles are structurally impossible at the frozen head; never disable constraints.
  foreach r in array array[null::text,'r10_invalid_role'] loop
    constraint_state := null;
    begin
      insert into public.platform_admins(email,role,is_active) values('r10-'||gen_random_uuid()::text||'@'||'example.invalid',r,true);
    exception when others then get stacked diagnostics constraint_state=returned_sqlstate; end;
    if constraint_state is distinct from case when r is null then '23502' else '23514' end then raise exception 'R10_ROLE_CONSTRAINT_REJECTION_MISSING'; end if;
    insert into r10_results values (case when r is null then 'null_role' else 'invalid_role' end,'REJECTED_BY_CONSTRAINT_NOT_FUNCTION_EXECUTION');
  end loop;
  insert into public.platform_admins(email,role,is_active) values('r10-owner@'||'example.invalid','owner',true) returning id into owner_actor;
  constraint_state := null;
  begin
    insert into public.platform_admins(email,role,is_active) values('r10-second-owner@'||'example.invalid','owner',true);
  exception when others then get stacked diagnostics constraint_state=returned_sqlstate; end;
  if constraint_state is distinct from '23505' then raise exception 'R10_SINGLE_ACTIVE_OWNER_INVARIANT_MISSING'; end if;
  insert into r10_results values ('single_active_owner_invariant','PASS');
  insert into public.platform_admins(email,role,is_active) values('r10-prospector@'||'example.invalid','prospector',true) returning id into prospector;
  insert into public.platform_admins(email,role,is_active) values('r10-other@'||'example.invalid','prospector',true) returning id into other_prospector;
  insert into public.signup_leads(email,empresa_nome,assigned_to_admin_id) values('r10-lead@'||'example.invalid','Disposable R10',prospector) returning id into lead;
  insert into public.signup_leads(email,empresa_nome,assigned_to_admin_id) values('r10-other-lead@'||'example.invalid','Disposable R10',other_prospector) returning id into other_lead;
  perform pg_temp.expect_error(format('select public.create_founder_test_invite(%L,%L,%L,%L,%L)',prospector,email_value,'basico',token_value,expiry),'FOUNDER_TEST_OWNER_ONLY');
  perform pg_temp.expect_error(format('select public.create_founder_invite_for_sales_lead(%L,%L,%L,%L,%L)',prospector,other_lead,'basico',token_value,expiry),'FOUNDER_LEAD_NOT_OWNED');
  select (public.create_founder_invite_for_sales_lead(prospector,lead,'basico',token_value,expiry)).id into invite;
  if invite is null then raise exception 'R10_PROSPECTOR_CREATE_FAILED'; end if;
  perform public.rotate_founder_invite_token(prospector,invite,repeat('b',64),expiry);
  perform pg_temp.expect_error(format('select public.rotate_founder_invite_token(%L,%L,%L,%L)',other_prospector,invite,token_value,expiry),'FOUNDER_INVITE_NOT_OWNED');
  perform pg_temp.expect_error(format('select public.revoke_founder_invite(%L,%L)',other_prospector,invite),'FOUNDER_INVITE_NOT_OWNED');
  update public.signup_leads set assigned_to_admin_id=other_prospector where id=lead;
  perform pg_temp.expect_error(format('select public.rotate_founder_invite_token(%L,%L,%L,%L)',prospector,invite,token_value,expiry),'FOUNDER_INVITE_NOT_OWNED');
  perform pg_temp.expect_error(format('select public.revoke_founder_invite(%L,%L)',prospector,invite),'FOUNDER_INVITE_NOT_OWNED');
  update public.signup_leads set assigned_to_admin_id=prospector where id=lead;
  update public.founder_invites set sales_lead_id=null where id=invite;
  perform pg_temp.expect_error(format('select public.rotate_founder_invite_token(%L,%L,%L,%L)',prospector,invite,token_value,expiry),'FOUNDER_INVITE_NOT_OWNED');
  perform pg_temp.expect_error(format('select public.revoke_founder_invite(%L,%L)',prospector,invite),'FOUNDER_INVITE_NOT_OWNED');
  update public.founder_invites set sales_lead_id=lead where id=invite;
  perform public.revoke_founder_invite(prospector,invite,'synthetic-test');
  insert into r10_results values ('prospector_create_rotate_revoke_and_resource_scope','PASS');
  set local role service_role;
  select (public.create_founder_test_invite(owner_actor,email_value,'basico',token_value,expiry)).id into test_invite;
  reset role;
  if test_invite is null then raise exception 'R10_OWNER_TEST_INVITE_FAILED'; end if;
  perform public.rotate_founder_invite_token(owner_actor,test_invite,repeat('c',64),expiry);
  perform public.revoke_founder_invite(owner_actor,test_invite,'synthetic-test');
  select (public.create_founder_invite_for_sales_lead(owner_actor,other_lead,'basico',repeat('d',64),expiry)).id into invite;
  if invite is null then raise exception 'R10_OWNER_MIXED_CREATE_FAILED'; end if;
  perform public.rotate_founder_invite_token(owner_actor,invite,repeat('e',64),expiry);
  perform public.revoke_founder_invite(owner_actor,invite,'synthetic-test');
  insert into r10_results values ('exact_active_owner_only_and_mixed_paths','PASS');
  insert into r10_results values ('actual_service_role_execute','PASS');
  -- SQL signature, ACL, owner and search_path are also compared against the entire frozen catalog.
  -- Actor parameters here are synthetic. Trusted server caller identity remains a separate review requirement.
end $$;
select json_build_object('status','PASS','scope','DISPOSABLE_LOCAL_NOT_P7','fixtures','SYNTHETIC_ROLLED_BACK',
  'null_role_proof','CONSTRAINT_REJECTION_PLUS_P3_STATIC_GATE_PROOF',
  'checks',(select json_agg(json_build_object('test',test,'result',result) order by test) from r10_results));
rollback;
