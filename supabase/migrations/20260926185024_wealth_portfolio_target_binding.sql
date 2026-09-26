-- Forward correction discovered by the hosted configure Server Action.
-- Preserve the applied foundation and change only its ambiguous PL/pgSQL binding.
begin;
do $patch$
declare definition text; expected text:='targets=targets,lab_positions=labs';
begin
 definition:=pg_catalog.pg_get_functiondef('ecosystem_private.manage_wealth_portfolio(text,jsonb)'::regprocedure);
 if strpos(definition,expected)=0 or (length(definition)-length(replace(definition,expected,'')))/length(expected)<>1 then
  raise exception 'Expected Portfolio definition differs; stop for review';
 end if;
 execute replace(definition,expected,'targets=coalesce(p_input->''targets'',''{}''::jsonb),lab_positions=labs');
end $patch$;
commit;
