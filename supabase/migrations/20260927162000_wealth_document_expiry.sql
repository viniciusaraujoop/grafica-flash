-- Explicit document expiry metadata for factual Vault alerts. No inferred validity.
begin;

alter table public.wealth_documents
 add column expires_on date check(expires_on between date '1900-01-01' and date '2200-12-31');
create index wealth_documents_owner_expiry
 on public.wealth_documents(user_id,expires_on,id)
 where status='active' and expires_on is not null;

create or replace function ecosystem_private.manage_wealth_document(p_operation text,p_input jsonb) returns uuid
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
  keys:=keys||array['title','category','document_date','expires_on','notes','links'];
  perform ecosystem_private.validate_wealth_planning_links(p_input->'links',false);
  if p_input->>'document_date' is not null and (p_input->>'document_date')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid date' using errcode='22023';end if;
  if p_input->>'expires_on' is not null and (p_input->>'expires_on')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid expiry date' using errcode='22023';end if;
 end if;
 if p_operation='reserve' then keys:=keys||array['mime_type','size_bytes','sha256'];end if;
 if p_input-keys<>'{}'::jsonb then raise exception 'unknown fields' using errcode='22023';end if;
 if p_operation='reserve' then
  if p_input ? 'version' or coalesce(p_input->>'size_bytes','')!~'^[1-9]\d{0,6}$' then raise exception 'invalid reservation' using errcode='22023';end if;
  if (select count(*) from public.wealth_documents where user_id=actor and status<>'deleted')>=500 then raise exception 'vault document limit' using errcode='54000';end if;
  insert into public.wealth_documents(id,user_id,title,category,document_date,expires_on,notes,links,mime_type,size_bytes,sha256)
  values(record_id,actor,btrim(p_input->>'title'),p_input->>'category',(p_input->>'document_date')::date,(p_input->>'expires_on')::date,p_input->>'notes',p_input->'links',p_input->>'mime_type',(p_input->>'size_bytes')::integer,p_input->>'sha256');
 else
  select * into d from public.wealth_documents where id=record_id and user_id=actor for update;
  if not found then raise exception 'document unavailable' using errcode='42501';end if;
  if coalesce(p_input->>'version','')!~'^[1-9]\d{0,15}$' or (p_input->>'version')::bigint<>d.version then raise exception 'document changed' using errcode='PT409';end if;
  if p_operation='finalize' then
   if d.status<>'pending' or not exists(select 1 from storage.objects where bucket_id='wealth-documents' and name=d.object_path and (metadata->>'size')::bigint=d.size_bytes and metadata->>'mimetype'=d.mime_type) then raise exception 'upload incomplete' using errcode='22023';end if;
   update public.wealth_documents set status='active',version=version+1,updated_at=clock_timestamp() where id=record_id;
  elsif p_operation='edit' then
   if d.status<>'active' then raise exception 'document not active' using errcode='22023';end if;
   update public.wealth_documents set title=btrim(p_input->>'title'),category=p_input->>'category',document_date=(p_input->>'document_date')::date,expires_on=(p_input->>'expires_on')::date,notes=p_input->>'notes',links=p_input->'links',version=version+1,updated_at=clock_timestamp() where id=record_id;
  elsif p_operation='delete_begin' then
   if d.status='deleted' then raise exception 'document removed' using errcode='22023';end if;
   if d.status<>'deleting' then update public.wealth_documents set status='deleting',version=version+1,updated_at=clock_timestamp() where id=record_id;end if;
  else
   if d.status<>'deleting' or exists(select 1 from storage.objects where bucket_id='wealth-documents' and name=d.object_path) then raise exception 'storage cleanup required' using errcode='22023';end if;
   update public.wealth_documents set status='deleted',title='Documento removido',category='other',document_date=null,expires_on=null,notes='',links='[]',version=version+1,updated_at=clock_timestamp() where id=record_id;
   delete from ecosystem_private.wealth_document_commands where user_id=actor and result=record_id;
  end if;
 end if;
 insert into ecosystem_private.wealth_document_commands values(actor,command_token,p_operation,p_input,record_id);
 return record_id;
end;$$;

comment on column public.wealth_documents.expires_on is 'Optional owner-declared document validity end date. Never inferred from document_date or file contents.';
commit;
