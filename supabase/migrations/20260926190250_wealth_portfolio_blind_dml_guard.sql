-- A write-only entitlement must not hide a holding from its mutation guard.
-- Do not rely on SELECT RLS when authorizing a blind UPDATE/DELETE.
begin;
create function ecosystem_private.is_owned_wealth_holding(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.wealth_holdings where id=p_id and user_id=auth.uid());
$$;
revoke all on function ecosystem_private.is_owned_wealth_holding(uuid) from public,anon,authenticated;
grant execute on function ecosystem_private.is_owned_wealth_holding(uuid) to authenticated;
comment on function ecosystem_private.is_owned_wealth_holding(uuid) is 'Guard predicate intentionally independent of read entitlement. Reveals only whether an ID is a holding owned by auth.uid(); private schema, no foreign ownership information.';

create or replace function ecosystem_private.guard_wealth_holding_entry() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if current_user not in ('postgres','service_role') and ecosystem_private.is_owned_wealth_holding(old.id) then raise exception 'Archive Portfolio positions instead' using errcode='42501';end if;
  return old;
 end if;
 if current_user not in ('postgres','service_role') then
  if (tg_op='INSERT' and new.valuation_status<>'MANUAL_VALUE') or
   (tg_op='UPDATE' and (new.valuation_status is distinct from old.valuation_status or ecosystem_private.is_owned_wealth_holding(old.id))) then
   raise exception 'Use Portfolio to change this position' using errcode='42501';
  end if;
 end if;
 if tg_op='UPDATE' and new.kind<>'asset' and exists(select 1 from public.wealth_holdings where id=old.id) then raise exception 'Holding must remain an asset' using errcode='23514';end if;
 return new;
end $$;
commit;
