-- Orçaly 3.1 data-quality rule hardening.
-- Wrap the already-certified v1 scan so historical behavior stays reproducible while
-- correcting rules that could not fire against the real schema.

do $$
begin
  if to_regprocedure('public.refresh_company_data_quality_v1(uuid)') is null then
    alter function public.refresh_company_data_quality(uuid)
      rename to refresh_company_data_quality_v1;
  end if;
end $$;

revoke all on function public.refresh_company_data_quality_v1(uuid) from public, anon, authenticated;
grant execute on function public.refresh_company_data_quality_v1(uuid) to service_role;

create or replace function public.refresh_company_data_quality(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_open integer;
  v_score integer;
begin
  perform public.refresh_company_data_quality_v1(p_company_id);

  -- `valor` is NOT NULL DEFAULT 0 in the legacy schema, so null-only detection can
  -- never identify a transaction with no effective monetary value.
  insert into public.data_quality_issues(
    company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,
    recommended_action,auto_fixable,status,last_seen_at,resolved_at
  )
  select p_company_id,md5('finance_missing_amount:'||f.id::text),'finance_missing_amount','HIGH',
    'financial_transaction',f.id::text,'Lançamento financeiro sem valor',
    'Transação financeira não possui valor efetivo em nenhum dos campos canônicos/legados.',
    'Revise o lançamento manualmente; não preencha valores automaticamente.',false,'open',now(),null
  from public.financial_transactions f
  where f.company_id=p_company_id
    and coalesce(f.amount,0)=0
    and coalesce(f.valor,0)=0
  on conflict(company_id,fingerprint) do update
    set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  -- The real default active status is "Aguardando aprovação da arte"; include it
  -- alongside historical aliases so an active request without an object reference is visible.
  insert into public.data_quality_issues(
    company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,
    recommended_action,auto_fixable,status,last_seen_at,resolved_at
  )
  select p_company_id,md5('art_missing_object_reference:'||a.id::text),'art_missing_object_reference','HIGH',
    'art_approval',a.id::text,'Arte sem referência de arquivo',
    'Solicitação ativa de aprovação não possui URL de arte.',
    'Reenvie a arte e confirme o objeto no Storage.',false,'open',now(),null
  from public.art_approval_requests a
  where a.company_id=p_company_id
    and lower(btrim(coalesce(a.status,''))) in (
      'pending','pendente','aguardando','sent','enviado',
      'aguardando aprovação da arte','aguardando aprovacao da arte'
    )
    and nullif(btrim(a.artwork_url),'') is null
  on conflict(company_id,fingerprint) do update
    set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  select count(*) into v_open
  from public.data_quality_issues
  where company_id=p_company_id and status='open';

  select greatest(0,100-coalesce(sum(
    case severity
      when 'CRITICAL' then 25
      when 'HIGH' then 10
      when 'MEDIUM' then 4
      when 'LOW' then 1
      else 0
    end
  ),0))::integer
  into v_score
  from public.data_quality_issues
  where company_id=p_company_id and status='open';

  return jsonb_build_object(
    'score',v_score,
    'open',v_open,
    'critical',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='CRITICAL'),
    'high',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='HIGH'),
    'medium',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='MEDIUM'),
    'low',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='LOW'),
    'info',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='INFO')
  );
end;
$$;

revoke all on function public.refresh_company_data_quality(uuid) from public, anon, authenticated;
grant execute on function public.refresh_company_data_quality(uuid) to service_role;
