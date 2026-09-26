-- Private document metadata and authenticated Storage access; bucket provisioned via Storage API.
begin;
create table public.wealth_documents (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),
 category text not null check(category in ('statement','contract','receipt','tax','insurance','other')),
 document_date date check(document_date between date '1900-01-01' and date '2200-12-31'),
 notes text not null default '' check(length(notes)<=2000),
 links jsonb not null default '[]' check(jsonb_typeof(links)='array' and jsonb_array_length(links)<=5),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 size_bytes integer not null check(size_bytes between 1 and 3145728),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text generated always as (user_id::text||'/'||id::text||'/document') stored unique,
 status text not null default 'pending' check(status in ('pending','active','deleting','deleted')),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index wealth_documents_owner_date on public.wealth_documents(user_id,created_at desc,id);
alter table public.wealth_documents enable row level security;
revoke all on public.wealth_documents from public,anon,authenticated;
grant select on public.wealth_documents to authenticated;
grant all on public.wealth_documents to service_role;
create policy documents_read on public.wealth_documents for select to authenticated using(user_id=(select auth.uid()) and (select ecosystem_private.has_personal_access('wealth','wealth.read')));
create trigger documents_audit after insert or update or delete on public.wealth_documents for each row execute function ecosystem_private.record_change();
create table ecosystem_private.wealth_document_commands (
 user_id uuid not null references auth.users(id) on delete cascade, token uuid not null,
 operation text not null, input jsonb not null, result uuid not null, primary key(user_id,token)
);
alter table ecosystem_private.wealth_document_commands enable row level security;
revoke all on ecosystem_private.wealth_document_commands from public,anon,authenticated;
grant all on ecosystem_private.wealth_document_commands to service_role;

create function ecosystem_private.manage_wealth_document(p_operation text,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); command_token uuid; record_id uuid; d public.wealth_documents; previous ecosystem_private.wealth_document_commands;
 keys text[]:=array['id','version','idempotency_key','confirmed'];
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'document access denied' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('reserve','finalize','edit','delete_begin','delete_finish') or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>12000 or p_input->>'confirmed' is distinct from 'yes' then raise exception 'invalid document command' using errcode='22023';end if;
 command_token:=(p_input->>'idempotency_key')::uuid;record_id:=(p_input->>'id')::uuid;
 if command_token is null or record_id is null then raise exception 'missing identifiers' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('wealth-document:'||actor::text,0));
 select * into previous from ecosystem_private.wealth_document_commands where user_id=actor and wealth_document_commands.token=command_token;
 if found then
  if previous.operation<>p_operation or previous.input<>p_input then raise exception 'command reused' using errcode='23505';end if;
  return previous.result;
 end if;
 if p_operation in ('reserve','edit') then
  keys:=keys||array['title','category','document_date','notes','links'];
  perform ecosystem_private.validate_wealth_planning_links(p_input->'links',false);
  if p_input->>'document_date' is not null and (p_input->>'document_date')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date' using errcode='22023';end if;
 end if;
 if p_operation='reserve' then keys:=keys||array['mime_type','size_bytes','sha256'];end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 if p_operation='reserve' then
  if p_input ? 'version' or coalesce(p_input->>'size_bytes','')!~'^[1-9]\d{0,6}$' then raise exception 'invalid reservation' using errcode='22023';end if;
  if (select count(*) from public.wealth_documents where user_id=actor and status<>'deleted')>=500 then raise exception 'vault document limit' using errcode='54000';end if;
  insert into public.wealth_documents(id,user_id,title,category,document_date,notes,links,mime_type,size_bytes,sha256)
  values(record_id,actor,btrim(p_input->>'title'),p_input->>'category',(p_input->>'document_date')::date,p_input->>'notes',p_input->'links',p_input->>'mime_type',(p_input->>'size_bytes')::integer,p_input->>'sha256');
 else
  select * into d from public.wealth_documents where id=record_id and user_id=actor for update;
  if not found then raise exception 'document unavailable' using errcode='42501';end if;
  if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>d.version then raise exception 'document changed' using errcode='PT409';end if;
  if p_operation='finalize' then
   if d.status<>'pending' or not exists(select 1 from storage.objects where bucket_id='wealth-documents' and name=d.object_path and (metadata->>'size')::bigint=d.size_bytes and metadata->>'mimetype'=d.mime_type) then raise exception 'upload incomplete' using errcode='22023';end if;
   update public.wealth_documents set status='active',version=version+1,updated_at=clock_timestamp() where id=record_id;
  elsif p_operation='edit' then
   if d.status<>'active' then raise exception 'document not active' using errcode='22023';end if;
   update public.wealth_documents set title=btrim(p_input->>'title'),category=p_input->>'category',document_date=(p_input->>'document_date')::date,notes=p_input->>'notes',links=p_input->'links',version=version+1,updated_at=clock_timestamp() where id=record_id;
  elsif p_operation='delete_begin' then
   if d.status='deleted' then raise exception 'document removed' using errcode='22023';end if;
   if d.status<>'deleting' then update public.wealth_documents set status='deleting',version=version+1,updated_at=clock_timestamp() where id=record_id;end if;
  else
   if d.status<>'deleting' or exists(select 1 from storage.objects where bucket_id='wealth-documents' and name=d.object_path) then raise exception 'storage cleanup required' using errcode='22023';end if;
   -- Keep an identifier tombstone, remove user-supplied metadata and command payloads.
   update public.wealth_documents set status='deleted',title='Documento removido',category='other',document_date=null,notes='',links='[]',version=version+1,updated_at=clock_timestamp() where id=record_id;
   delete from ecosystem_private.wealth_document_commands where user_id=actor and result=record_id;
  end if;
 end if;
 insert into ecosystem_private.wealth_document_commands values(actor,command_token,p_operation,p_input,record_id);
 return record_id;
end;$$;
revoke all on function ecosystem_private.manage_wealth_document(text,jsonb) from public,anon,authenticated;
grant execute on function ecosystem_private.manage_wealth_document(text,jsonb) to authenticated;
create function public.manage_wealth_document(p_operation text,p_input jsonb) returns uuid
language sql security invoker set search_path='' as $$select ecosystem_private.manage_wealth_document(p_operation,p_input);$$;
revoke all on function public.manage_wealth_document(text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_wealth_document(text,jsonb) to authenticated;

-- Purpose-bound reads deny signing, copy, transforms, listing and downloads after delete_begin.
-- Serialize the final Storage INSERT with lifecycle changes. A policy snapshot alone can be stale.
create function ecosystem_private.allow_wealth_document_upload(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
declare d public.wealth_documents;
begin
 if auth.uid() is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then return false;end if;
 select * into d from public.wealth_documents where object_path=p_path and user_id=auth.uid() for update;
 return found and d.status='pending';
end;$$;
revoke all on function ecosystem_private.allow_wealth_document_upload(text) from public,anon,authenticated;
grant execute on function ecosystem_private.allow_wealth_document_upload(text) to authenticated;
create policy wealth_documents_download on storage.objects for select to authenticated using(
 bucket_id='wealth-documents' and storage.allow_any_operation(array['object.get_authenticated','object.delete','object.delete_many'])
 and exists(select 1 from public.wealth_documents d where d.object_path=name and d.user_id=(select auth.uid()) and (
  (d.status='active' and storage.allow_only_operation('object.get_authenticated')) or
  (d.status='deleting' and storage.allow_any_operation(array['object.delete','object.delete_many']) and (select ecosystem_private.has_personal_access('wealth','wealth.write')))
 ))
);
create policy wealth_documents_upload on storage.objects for insert to authenticated with check(
 bucket_id='wealth-documents' and storage.allow_only_operation('object.upload') and (select ecosystem_private.has_personal_access('wealth','wealth.write'))
 and ecosystem_private.allow_wealth_document_upload(name)
);
create policy wealth_documents_remove on storage.objects for delete to authenticated using(
 bucket_id='wealth-documents' and storage.allow_any_operation(array['object.delete','object.delete_many']) and (select ecosystem_private.has_personal_access('wealth','wealth.write'))
 and exists(select 1 from public.wealth_documents d where d.object_path=name and d.user_id=(select auth.uid()) and d.status='deleting')
);
commit;
