-- Keep privileged implementations outside PostgREST's exposed public schema.
-- Authorization remains inside every private implementation; wrappers accept no owner override.
begin;
alter function public.create_wealth_recurrence(jsonb) set schema ecosystem_private;
alter function public.change_wealth_recurrence(uuid,bigint,text) set schema ecosystem_private;
alter function public.run_my_wealth_recurrences() set schema ecosystem_private;
create function public.create_wealth_recurrence(p_input jsonb) returns uuid
 language sql volatile security invoker set search_path='' as $$
 select ecosystem_private.create_wealth_recurrence(p_input);
$$;
create function public.change_wealth_recurrence(p_id uuid,p_version bigint,p_operation text) returns boolean
 language sql volatile security invoker set search_path='' as $$
 select ecosystem_private.change_wealth_recurrence(p_id,p_version,p_operation);
$$;
create function public.run_my_wealth_recurrences() returns jsonb
 language sql volatile security invoker set search_path='' as $$
 select ecosystem_private.run_my_wealth_recurrences();
$$;
revoke all on function public.create_wealth_recurrence(jsonb),public.change_wealth_recurrence(uuid,bigint,text),public.run_my_wealth_recurrences() from public,anon,authenticated;
grant execute on function public.create_wealth_recurrence(jsonb),public.change_wealth_recurrence(uuid,bigint,text),public.run_my_wealth_recurrences() to authenticated;
-- The moved implementations retain explicit authenticated EXECUTE from the previous migration.
-- Their fixed empty search_path, auth.uid(), permission checks, ownership and lease fencing are unchanged.
commit;
