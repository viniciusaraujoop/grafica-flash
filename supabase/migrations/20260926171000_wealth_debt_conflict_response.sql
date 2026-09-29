-- A business version conflict is final for this submitted form, not a serialization retry.
-- PostgREST can retry SQLSTATE 40001 indefinitely. PT409 returns a finite HTTP 409.
begin;
create or replace function ecosystem_private.save_wealth_debt(p_input jsonb,p_entry_id uuid default null,p_version bigint default null) returns uuid
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
  if e.archived_at is not null or p_version is null or e.version<>p_version then raise exception 'Debt version conflict' using errcode='PT409';end if;
  update public.wealth_entries set title=label,amount_cents=amount,financial_date=dated where id=e.id;
 end if;
 insert into public.wealth_debt_terms(id,principal_cents,monthly_rate_bps,minimum_cents,installment_count,remaining_installments,next_due_date,priority)
 values(e.id,principal,rate,minimum,installments,remaining,due,rank)
 on conflict(id) do update set principal_cents=excluded.principal_cents,monthly_rate_bps=excluded.monthly_rate_bps,minimum_cents=excluded.minimum_cents,
 installment_count=excluded.installment_count,remaining_installments=excluded.remaining_installments,next_due_date=excluded.next_due_date,priority=excluded.priority;
 return e.id;
end;$$;
commit;
