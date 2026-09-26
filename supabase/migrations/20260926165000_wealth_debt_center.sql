begin;
-- A settled liability remains as history with zero balance. Other entry kinds stay positive.
alter table public.wealth_entries drop constraint wealth_entries_amount_cents_check;
alter table public.wealth_entries add constraint wealth_entries_amount_cents_check
 check(amount_cents between 0 and 100000000000000 and (amount_cents>0 or kind='liability'));
-- Terms extend a single existing liability entry: no second balance or duplicated net worth.
create table public.wealth_debt_terms (
 id uuid primary key references public.wealth_entries(id) on delete cascade,
 principal_cents bigint not null check(principal_cents between 0 and 100000000000000),
 monthly_rate_bps integer not null check(monthly_rate_bps between 0 and 10000),
 minimum_cents bigint not null check(minimum_cents between 0 and 100000000000000),
 installment_count integer check(installment_count between 1 and 1200),
 remaining_installments integer,
 next_due_date date check(next_due_date between date '1900-01-01' and date '2200-12-31'),
 priority integer not null default 1 check(priority between 1 and 1000),
 constraint wealth_debt_installments check((installment_count is null and remaining_installments is null) or (installment_count is not null and remaining_installments is not null and remaining_installments between 0 and installment_count))
);
alter table public.wealth_debt_terms enable row level security;
revoke all on public.wealth_debt_terms from public,anon,authenticated;
grant select on public.wealth_debt_terms to authenticated;
grant all on public.wealth_debt_terms to service_role;
create policy wealth_debt_owner_read on public.wealth_debt_terms for select to authenticated
 using ((select ecosystem_private.has_personal_access('wealth','wealth.read')) and exists(select 1 from public.wealth_entries e where e.id=wealth_debt_terms.id and e.user_id=(select auth.uid())));
create trigger wealth_debt_audit after insert or update or delete on public.wealth_debt_terms for each row execute function ecosystem_private.record_change();

create function ecosystem_private.guard_wealth_debt_kind() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'liability' and exists(select 1 from public.wealth_debt_terms where id=old.id) then raise exception 'Debt entry must remain a liability' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function ecosystem_private.guard_wealth_debt_kind() from public,anon,authenticated;
create trigger wealth_debt_kind_guard before update of kind on public.wealth_entries for each row execute function ecosystem_private.guard_wealth_debt_kind();

create function ecosystem_private.save_wealth_debt(p_input jsonb,p_entry_id uuid default null,p_version bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); e public.wealth_entries; t public.wealth_debt_terms;
 principal bigint; rate integer; minimum bigint; installments integer; remaining integer; due date; rank integer;
 amount bigint; label text; dated date; token uuid; created boolean:=false;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 if p_input is null or p_input->>'confirmed' is distinct from 'yes' then raise exception 'Debt confirmation required' using errcode='22023';end if;
 principal:=(p_input->>'principal_cents')::bigint;rate:=(p_input->>'monthly_rate_bps')::integer;minimum:=(p_input->>'minimum_cents')::bigint;
 installments:=nullif(p_input->>'installment_count','')::integer;remaining:=nullif(p_input->>'remaining_installments','')::integer;
 due:=nullif(p_input->>'next_due_date','')::date;rank:=(p_input->>'priority')::integer;
 amount:=(p_input->>'balance_cents')::bigint;label:=btrim(p_input->>'title');dated:=(p_input->>'financial_date')::date;
 if principal is null or rate is null or minimum is null or rank is null or amount is null or label is null or dated is null
 or principal not between 0 and 100000000000000 or amount not between 0 and 100000000000000
 or rate not between 0 and 10000 or minimum not between 0 and 100000000000000 or rank not between 1 and 1000
 or length(label) not between 1 and 160 or dated not between date '1900-01-01' and date '2200-12-31'
 then raise exception 'Invalid debt values' using errcode='22023';end if;
 if p_entry_id is null then
  token:=(p_input->>'idempotency_key')::uuid;if token is null then raise exception 'Idempotency required' using errcode='22023';end if;
  insert into public.wealth_entries(user_id,kind,title,category,amount_cents,financial_date,recurrence,idempotency_key)
   values(actor,'liability',label,'loan',amount,dated,'none',token) on conflict(user_id,idempotency_key) do nothing returning * into e;
  created:=found;
  if not created then
   select * into e from public.wealth_entries where user_id=actor and idempotency_key=token for update;
   select * into t from public.wealth_debt_terms where id=e.id;
   if e.kind is distinct from 'liability' or e.archived_at is not null or e.title is distinct from label or e.amount_cents is distinct from amount or e.financial_date is distinct from dated
    or t.id is null or row(t.principal_cents,t.monthly_rate_bps,t.minimum_cents,t.installment_count,t.remaining_installments,t.next_due_date,t.priority)
      is distinct from row(principal,rate,minimum,installments,remaining,due,rank)
    then raise exception 'Debt idempotency conflict' using errcode='23505';end if;
   return e.id;
  end if;
 else
  select * into e from public.wealth_entries where id=p_entry_id and user_id=actor and kind='liability' for update;
  if not found then raise exception 'Debt unavailable' using errcode='42501';end if;
  if e.archived_at is not null or p_version is null or e.version<>p_version then raise exception 'Debt version conflict' using errcode='40001';end if;
  update public.wealth_entries set title=label,amount_cents=amount,financial_date=dated where id=e.id;
 end if;
 insert into public.wealth_debt_terms(id,principal_cents,monthly_rate_bps,minimum_cents,installment_count,remaining_installments,next_due_date,priority)
 values(e.id,principal,rate,minimum,installments,remaining,due,rank)
 on conflict(id) do update set principal_cents=excluded.principal_cents,monthly_rate_bps=excluded.monthly_rate_bps,minimum_cents=excluded.minimum_cents,
 installment_count=excluded.installment_count,remaining_installments=excluded.remaining_installments,next_due_date=excluded.next_due_date,priority=excluded.priority;
 return e.id;
end;$$;
revoke all on function ecosystem_private.save_wealth_debt(jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function ecosystem_private.save_wealth_debt(jsonb,uuid,bigint) to authenticated;
create function public.save_wealth_debt(p_input jsonb,p_entry_id uuid default null,p_version bigint default null) returns uuid
language sql security invoker set search_path='' as $$select ecosystem_private.save_wealth_debt(p_input,p_entry_id,p_version)$$;
revoke all on function public.save_wealth_debt(jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.save_wealth_debt(jsonb,uuid,bigint) to authenticated;

create function ecosystem_private.settle_wealth_debt(p_entry_id uuid,p_version bigint,p_confirmed boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); e public.wealth_entries;
begin
 if actor is null or not ecosystem_private.has_personal_access('wealth','wealth.read') or not ecosystem_private.has_personal_access('wealth','wealth.write') then raise exception 'wealth write denied' using errcode='42501';end if;
 if p_confirmed is distinct from true then raise exception 'Debt confirmation required' using errcode='22023';end if;
 select * into e from public.wealth_entries where id=p_entry_id and user_id=actor and kind='liability' for update;
 if not found or e.archived_at is not null or p_version is null or e.version<>p_version or not exists(select 1 from public.wealth_debt_terms where id=e.id) then return false;end if;
 update public.wealth_entries set amount_cents=0 where id=e.id;
 update public.wealth_debt_terms set remaining_installments=case when installment_count is null then null else 0 end,next_due_date=null where id=e.id;
 return true;
end;$$;
revoke all on function ecosystem_private.settle_wealth_debt(uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function ecosystem_private.settle_wealth_debt(uuid,bigint,boolean) to authenticated;
create function public.settle_wealth_debt(p_entry_id uuid,p_version bigint,p_confirmed boolean) returns boolean
language sql security invoker set search_path='' as $$select ecosystem_private.settle_wealth_debt(p_entry_id,p_version,p_confirmed)$$;
revoke all on function public.settle_wealth_debt(uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.settle_wealth_debt(uuid,bigint,boolean) to authenticated;
comment on table public.wealth_debt_terms is 'Owner-declared debt terms linked to one liability balance. Fixed monthly rate in basis points. No payment execution or creditor guarantee.';
commit;
