-- Family is an explicit bilateral relationship, never a tenant or an implicit data grant.
begin;
create table ecosystem_private.wealth_family_connections (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid references auth.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 80),
 invite_hash text not null, invite_expires_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','active','revoked')),
 version bigint not null default 1, created_at timestamptz not null default now(),
 accepted_at timestamptz, revoked_at timestamptz,
 check(member_id is null or member_id<>owner_id),check(state<>'active' or member_id is not null)
);
create index wealth_family_connection_owner on ecosystem_private.wealth_family_connections(owner_id,created_at desc,id);
create index wealth_family_connection_member on ecosystem_private.wealth_family_connections(member_id,created_at desc,id);
create unique index wealth_family_active_pair on ecosystem_private.wealth_family_connections(least(owner_id,member_id),greatest(owner_id,member_id)) where state='active';
create table ecosystem_private.wealth_family_shares (
 id uuid primary key, connection_id uuid not null references ecosystem_private.wealth_family_connections(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid not null references auth.users(id) on delete cascade,
 resource_id uuid not null, scope text not null check(scope in ('goal.summary','entry.summary','document.download')),
 purpose text not null check(length(btrim(purpose)) between 1 and 160),
 expires_at timestamptz not null, state text not null default 'pending' check(state in ('pending','active','revoked')),
 version bigint not null default 1, created_at timestamptz not null default now(), accepted_at timestamptz, revoked_at timestamptz,
 check(owner_id<>recipient_id)
);
create index wealth_family_share_connection on ecosystem_private.wealth_family_shares(connection_id);
create index wealth_family_share_owner on ecosystem_private.wealth_family_shares(owner_id,created_at desc,id);
create index wealth_family_share_recipient on ecosystem_private.wealth_family_shares(recipient_id,created_at desc,id);
create index wealth_family_share_resource on ecosystem_private.wealth_family_shares(resource_id,recipient_id) where state='active';
create table ecosystem_private.wealth_family_commands (
 user_id uuid not null references auth.users(id) on delete cascade, token uuid not null,
 operation text not null, input_hash text not null, result uuid not null, primary key(user_id,token)
);
do $$declare t text;begin
 foreach t in array array['wealth_family_connections','wealth_family_shares','wealth_family_commands'] loop
  execute format('alter table ecosystem_private.%I enable row level security',t);
  execute format('revoke all on ecosystem_private.%I from public,anon,authenticated',t);
  execute format('grant all on ecosystem_private.%I to service_role',t);
 end loop;
end;$$;
create trigger family_connection_audit after insert or update or delete on ecosystem_private.wealth_family_connections for each row execute function ecosystem_private.record_change();
create trigger family_share_audit after insert or update or delete on ecosystem_private.wealth_family_shares for each row execute function ecosystem_private.record_change();

-- Callable only through guarded functions below; never a user-controlled arbitrary identity probe.
create function ecosystem_private.family_user_can_read(p_user uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.ecosystem_product_entitlements where user_id=p_user and company_id is null and product_id='wealth' and status='active' and starts_at<=now() and (expires_at is null or expires_at>now()) and 'wealth.read'=any(permissions));
$$;
revoke all on function ecosystem_private.family_user_can_read(uuid) from public,anon,authenticated;

create function ecosystem_private.wealth_family_resource(p_owner uuid,p_scope text,p_resource uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_scope='goal.summary' then
  select jsonb_build_object('title',title,'target_cents',target_cents::text,'saved_cents',saved_cents::text,'date',target_date,'status',status,'currency',currency) into result from public.wealth_goals where id=p_resource and user_id=p_owner and archived_at is null;
 elsif p_scope='entry.summary' then
  select jsonb_build_object('title',title,'amount_cents',amount_cents::text,'kind',kind,'date',financial_date,'currency',currency) into result from public.wealth_entries where id=p_resource and user_id=p_owner and archived_at is null;
 elsif p_scope='document.download' then
  select jsonb_build_object('title',title,'category',category,'date',document_date,'mime_type',mime_type,'size_bytes',size_bytes,'sha256',sha256,'object_path',object_path) into result from public.wealth_documents where id=p_resource and user_id=p_owner and status='active';
 end if;
 return result;
end;$$;
revoke all on function ecosystem_private.wealth_family_resource(uuid,text,uuid) from public,anon,authenticated;

create function ecosystem_private.manage_wealth_family(p_operation text,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); record_id uuid; command_token uuid; fingerprint text; previous ecosystem_private.wealth_family_commands;
 c ecosystem_private.wealth_family_connections; s ecosystem_private.wealth_family_shares; connection uuid; recipient uuid; verified_email text;
 keys text[]:=array['id','version','idempotency_key','confirmed']; expiry timestamptz;
begin
 if actor is null or not exists(select 1 from auth.users where id=actor) then raise exception 'authentication required' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('invite','join','disconnect','share','accept','revoke') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid family command' using errcode='22023';end if;
 if p_operation not in ('disconnect','revoke') and not ecosystem_private.family_user_can_read(actor) then raise exception 'family read denied' using errcode='42501';end if;
 if p_operation in ('invite','share') and not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'family write denied' using errcode='42501';end if;
 record_id:=(p_input->>'id')::uuid;command_token:=(p_input->>'idempotency_key')::uuid;
 if record_id is null or command_token is null then raise exception 'missing identifiers' using errcode='22023';end if;
 if p_operation='invite' then keys:=keys||array['label','email','code'];elsif p_operation='join' then keys:=keys||array['code'];elsif p_operation='share' then keys:=keys||array['connection_id','scope','resource_id','purpose','days'];end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-family:'||actor::text,0));
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into previous from ecosystem_private.wealth_family_commands where user_id=actor and wealth_family_commands.token=command_token;
 if found then
  if previous.operation<>p_operation or previous.input_hash<>fingerprint then raise exception 'command reused' using errcode='23505';end if;
  return previous.result;
 end if;
 if p_operation='invite' then
  if p_input ? 'version' or coalesce(p_input->>'code','')!~'^[a-f0-9]{64}$' or length(coalesce(p_input->>'email',''))>254 or coalesce(p_input->>'email','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid invitation' using errcode='22023';end if;
  if exists(select 1 from auth.users where id=actor and lower(email)=lower(p_input->>'email')) then raise exception 'cannot invite self' using errcode='22023';end if;
  if (select count(*) from ecosystem_private.wealth_family_connections where owner_id=actor and state<>'revoked')>=30 then raise exception 'connection limit' using errcode='54000';end if;
  insert into ecosystem_private.wealth_family_connections(id,owner_id,label,invite_hash,invite_expires_at) values(record_id,actor,btrim(p_input->>'label'),encode(sha256(convert_to((p_input->>'code')||':'||lower(p_input->>'email'),'UTF8')),'hex'),now()+interval '7 days');
 elsif p_operation in ('join','disconnect') then
  select * into c from ecosystem_private.wealth_family_connections where id=record_id for update;
  if not found then raise exception 'connection unavailable' using errcode='42501';end if;
  if p_operation='join' then
   select lower(email) into verified_email from auth.users where id=actor and email_confirmed_at is not null;
   if p_input ? 'version' or c.owner_id=actor or c.state<>'pending' or c.invite_expires_at<=now() or verified_email is null or coalesce(p_input->>'code','')!~'^[a-f0-9]{64}$' or c.invite_hash<>encode(sha256(convert_to((p_input->>'code')||':'||verified_email,'UTF8')),'hex') or not ecosystem_private.family_user_can_read(c.owner_id) then raise exception 'invitation unavailable' using errcode='42501';end if;
   update ecosystem_private.wealth_family_connections set member_id=actor,state='active',accepted_at=now(),version=version+1,invite_hash='' where id=record_id;
  else
   if actor<>c.owner_id and actor is distinct from c.member_id then raise exception 'connection unavailable' using errcode='42501';end if;
   if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>c.version then raise exception 'connection changed' using errcode='PT409';end if;
   update ecosystem_private.wealth_family_connections set state='revoked',revoked_at=now(),invite_hash='',version=version+1 where id=record_id;
  end if;
 else
  if p_operation='share' then connection:=(p_input->>'connection_id')::uuid;
  else select connection_id into connection from ecosystem_private.wealth_family_shares where id=record_id;end if;
  -- All share changes lock the relationship first: disconnect and accept cannot race into a live grant.
  select * into c from ecosystem_private.wealth_family_connections where id=connection for update;
  if not found or (actor<>c.owner_id and actor is distinct from c.member_id) then raise exception 'connection unavailable' using errcode='42501';end if;
  if p_operation='share' then
   recipient:=case when actor=c.owner_id then c.member_id else c.owner_id end;
   if c.state<>'active' or not ecosystem_private.family_user_can_read(recipient) then raise exception 'connection unavailable' using errcode='42501';end if;
   if p_input ? 'version' or coalesce(p_input->>'days','')!~'^[1-9]\d{0,2}$' or (p_input->>'days')::int>366 then raise exception 'invalid duration' using errcode='22023';end if;
   if ecosystem_private.wealth_family_resource(actor,p_input->>'scope',(p_input->>'resource_id')::uuid) is null then raise exception 'owned resource required' using errcode='42501';end if;
   if (select count(*) from ecosystem_private.wealth_family_shares where owner_id=actor and state<>'revoked' and expires_at>now())>=200 then raise exception 'share limit' using errcode='54000';end if;
   expiry:=now()+make_interval(days=>(p_input->>'days')::int);
   insert into ecosystem_private.wealth_family_shares(id,connection_id,owner_id,recipient_id,scope,resource_id,purpose,expires_at) values(record_id,connection,actor,recipient,p_input->>'scope',(p_input->>'resource_id')::uuid,btrim(p_input->>'purpose'),expiry);
  else
   select * into s from ecosystem_private.wealth_family_shares where id=record_id for update;
   if actor<>s.owner_id and actor<>s.recipient_id then raise exception 'share unavailable' using errcode='42501';end if;
   if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>s.version then raise exception 'share changed' using errcode='PT409';end if;
   if p_operation='accept' then
    if actor<>s.recipient_id or s.state<>'pending' or c.state<>'active' or s.expires_at<=now() or not ecosystem_private.family_user_can_read(s.owner_id) or ecosystem_private.wealth_family_resource(s.owner_id,s.scope,s.resource_id) is null then raise exception 'share unavailable' using errcode='42501';end if;
    update ecosystem_private.wealth_family_shares set state='active',accepted_at=now(),version=version+1 where id=record_id;
   else update ecosystem_private.wealth_family_shares set state='revoked',revoked_at=now(),version=version+1 where id=record_id;end if;
  end if;
 end if;
 insert into ecosystem_private.wealth_family_commands values(actor,command_token,p_operation,fingerprint,record_id);
 return record_id;
end;$$;
revoke all on function ecosystem_private.manage_wealth_family(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_family(text,jsonb) to authenticated;
create function public.manage_wealth_family(p_operation text,p_input jsonb) returns uuid language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_family(p_operation,p_input);$$;
revoke all on function public.manage_wealth_family(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_wealth_family(text,jsonb) to authenticated;

create function ecosystem_private.read_wealth_family_share(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s ecosystem_private.wealth_family_shares;
begin
 if auth.uid() is null or not ecosystem_private.family_user_can_read(auth.uid()) then return null;end if;
 select * into s from ecosystem_private.wealth_family_shares where id=p_id and recipient_id=auth.uid() and state='active' and expires_at>now();
 if not found or not ecosystem_private.family_user_can_read(s.owner_id) or not exists(select 1 from ecosystem_private.wealth_family_connections where id=s.connection_id and state='active' and ((owner_id=s.owner_id and member_id=s.recipient_id) or (owner_id=s.recipient_id and member_id=s.owner_id))) then return null;end if;
 return ecosystem_private.wealth_family_resource(s.owner_id,s.scope,s.resource_id);
end;$$;
revoke all on function ecosystem_private.read_wealth_family_share(uuid) from public,anon,authenticated;
grant execute on function ecosystem_private.read_wealth_family_share(uuid) to authenticated;
create function public.read_wealth_family_share(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select ecosystem_private.read_wealth_family_share(p_id);$$;
revoke all on function public.read_wealth_family_share(uuid) from public,anon,authenticated;
grant execute on function public.read_wealth_family_share(uuid) to authenticated;

-- Management metadata remains available after entitlement loss so either party can withdraw consent.
create function ecosystem_private.wealth_family_overview(p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();connections jsonb;shares jsonb;n bigint;cn bigint;
begin
 if actor is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 then raise exception 'invalid page' using errcode='22023';end if;
 select count(*) into cn from ecosystem_private.wealth_family_connections where owner_id=actor or member_id=actor;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into connections from (
  select id,label,case when state='pending' and invite_expires_at<=now() then 'expired' else state end state,version,owner_id=actor as owned,invite_expires_at,created_at from ecosystem_private.wealth_family_connections where owner_id=actor or member_id=actor order by created_at desc,id limit 25 offset (p_page-1)*25
 )c;
 select count(*) into n from ecosystem_private.wealth_family_shares where owner_id=actor or recipient_id=actor;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into shares from (
  select s.id,s.connection_id,s.scope,s.purpose,s.version,s.owner_id=actor as owned,s.expires_at,s.created_at,
   case when c.state<>'active' or s.state='revoked' then 'revoked' when s.expires_at<=now() then 'expired' else s.state end state,
   case when s.owner_id=actor and ecosystem_private.family_user_can_read(actor) then ecosystem_private.wealth_family_resource(actor,s.scope,s.resource_id)-array['sha256','object_path'] else ecosystem_private.read_wealth_family_share(s.id)-array['sha256','object_path'] end resource
  from ecosystem_private.wealth_family_shares s join ecosystem_private.wealth_family_connections c on c.id=s.connection_id where s.owner_id=actor or s.recipient_id=actor order by s.created_at desc,s.id limit 25 offset (p_page-1)*25
 )s;
 return jsonb_build_object('connections',connections,'shares',shares,'total',n::text,'connectionTotal',cn::text);
end;$$;
revoke all on function ecosystem_private.wealth_family_overview(integer) from public,anon,authenticated;
grant execute on function ecosystem_private.wealth_family_overview(integer) to authenticated;
create function public.wealth_family_overview(p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select ecosystem_private.wealth_family_overview(p_page);$$;
revoke all on function public.wealth_family_overview(integer) from public,anon,authenticated;
grant execute on function public.wealth_family_overview(integer) to authenticated;

create function ecosystem_private.allow_wealth_family_document(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from ecosystem_private.wealth_family_shares s join public.wealth_documents d on d.id=s.resource_id where s.recipient_id=auth.uid() and s.scope='document.download' and d.object_path=p_path and ecosystem_private.read_wealth_family_share(s.id) is not null);
$$;
revoke all on function ecosystem_private.allow_wealth_family_document(text) from public,anon,authenticated;
grant execute on function ecosystem_private.allow_wealth_family_document(text) to authenticated;
-- Extend the existing SELECT policy instead of introducing overlapping permissive policies.
alter policy wealth_documents_download on storage.objects using(
 bucket_id='wealth-documents' and (
  (storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info']) and (
   exists(select 1 from public.wealth_documents d where d.object_path=name and d.user_id=(select auth.uid()) and d.status='active') or ecosystem_private.allow_wealth_family_document(name)))
  or (storage.allow_any_operation(array['object.delete','object.delete_many']) and (select ecosystem_private.has_personal_access('wealth','wealth.write')) and exists(select 1 from public.wealth_documents d where d.object_path=name and d.user_id=(select auth.uid()) and d.status='deleting'))
 ));
commit;
