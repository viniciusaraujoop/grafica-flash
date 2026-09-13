-- Transactional email delivery ledger. Secrets remain in the existing Vault-backed integration credential bundle.
create table if not exists public.integration_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  outbox_id uuid references public.transactional_outbox(id) on delete set null,
  template_key text not null check (template_key in ('proposal','order_received','order_ready','payment_confirmed','user_invite','notification','report','test')),
  to_email text not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','bounced','failed','complained','unsubscribed')),
  idempotency_key text not null,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, idempotency_key)
);
create index if not exists idx_integration_email_provider_message on public.integration_email_deliveries(connection_id, provider_message_id) where provider_message_id is not null;
create index if not exists idx_integration_email_company_status on public.integration_email_deliveries(company_id, status, created_at desc);
create unique index if not exists idx_background_jobs_one_active_email_delivery on public.background_jobs(company_id, ((payload ->> 'delivery_id'))) where job_type = 'email.send' and status in ('queued','running','retrying') and payload ? 'delivery_id';
alter table public.integration_email_deliveries enable row level security;
revoke all on table public.integration_email_deliveries from public, anon, authenticated;
grant select,insert,update,delete on table public.integration_email_deliveries to service_role;

create or replace function public.enqueue_integration_email(
  p_company_id uuid,
  p_connection_id uuid,
  p_template_key text,
  p_to_email text,
  p_subject text,
  p_template_data jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_delivery_id uuid := gen_random_uuid();
  v_outbox_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_existing uuid;
begin
  if not exists(select 1 from public.integration_connections where id=p_connection_id and company_id=p_company_id and provider='resend') then raise exception 'resend connection not found'; end if;
  if p_template_key not in ('proposal','order_received','order_ready','payment_confirmed','user_invite','notification','report','test') then raise exception 'invalid email template'; end if;
  if p_to_email is null or length(p_to_email) > 320 or position('@' in p_to_email) < 2 then raise exception 'invalid email recipient'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 1 or length(p_idempotency_key) > 240 then raise exception 'invalid idempotency key'; end if;

  insert into public.integration_email_deliveries(id,company_id,connection_id,template_key,to_email,status,idempotency_key)
  values(v_delivery_id,p_company_id,p_connection_id,p_template_key,p_to_email,'queued',p_idempotency_key)
  on conflict(company_id,idempotency_key) do nothing;
  if not found then
    select id into v_existing from public.integration_email_deliveries where company_id=p_company_id and idempotency_key=p_idempotency_key;
    return jsonb_build_object('queued',false,'delivery_id',v_existing,'job_id',null);
  end if;

  insert into public.transactional_outbox(id,company_id,event_type,aggregate_type,aggregate_id,payload,status)
  values(v_outbox_id,p_company_id,'email.requested','email_delivery',v_delivery_id,jsonb_build_object('template',p_template_key,'to',p_to_email,'subject',p_subject,'template_data',coalesce(p_template_data,'{}'::jsonb)),'queued');
  update public.integration_email_deliveries set outbox_id=v_outbox_id where id=v_delivery_id and company_id=p_company_id;
  insert into public.background_jobs(id,company_id,job_type,payload,status,max_attempts,metadata)
  values(v_job_id,p_company_id,'email.send',jsonb_build_object('delivery_id',v_delivery_id,'connection_id',p_connection_id),'queued',5,jsonb_build_object('source','transactional_outbox','outbox_id',v_outbox_id));
  return jsonb_build_object('queued',true,'delivery_id',v_delivery_id,'job_id',v_job_id);
end;
$$;
revoke all on function public.enqueue_integration_email(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_integration_email(uuid,uuid,text,text,text,jsonb,text) to service_role;
