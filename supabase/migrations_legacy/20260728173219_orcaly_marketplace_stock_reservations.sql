-- ORCALY_MARKETPLACE_ATOMIC_STOCK_1C2
-- Reserva atomica, confirmacao idempotente e liberacao automatica de estoque.

create extension if not exists pg_cron;

alter table public.marketplace_payments
  add column if not exists stock_reservation_status text,
  add column if not exists stock_reserved_at timestamptz,
  add column if not exists stock_confirmed_at timestamptz,
  add column if not exists stock_released_at timestamptz;

do $$
begin
  alter table public.marketplace_payments
    add constraint marketplace_payments_stock_reservation_status_check
    check (
      stock_reservation_status is null
      or stock_reservation_status in (
        'reserved',
        'confirmed',
        'released',
        'expired',
        'review_required'
      )
    );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.marketplace_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  marketplace_payment_id uuid not null references public.marketplace_payments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'confirmed', 'released', 'expired', 'review_required')),
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (marketplace_payment_id, product_id)
);

create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  marketplace_payment_id uuid references public.marketplace_payments(id) on delete set null,
  reservation_id uuid references public.marketplace_stock_reservations(id) on delete set null,
  movement_type text not null
    check (movement_type in ('reserve', 'confirm', 'release', 'expire', 'review_required')),
  quantity_delta integer not null,
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_stock_reservations_active_product_idx
  on public.marketplace_stock_reservations (company_id, product_id, expires_at)
  where status = 'reserved';

create index if not exists marketplace_stock_reservations_payment_idx
  on public.marketplace_stock_reservations (company_id, marketplace_payment_id);

create index if not exists marketplace_stock_reservations_expiry_idx
  on public.marketplace_stock_reservations (expires_at)
  where status = 'reserved';

create index if not exists product_stock_movements_product_created_idx
  on public.product_stock_movements (company_id, product_id, created_at desc);

create index if not exists product_stock_movements_order_idx
  on public.product_stock_movements (company_id, order_id)
  where order_id is not null;

alter table public.marketplace_stock_reservations enable row level security;
alter table public.product_stock_movements enable row level security;

revoke all on table public.marketplace_stock_reservations from anon, authenticated;
revoke all on table public.product_stock_movements from anon, authenticated;
grant all on table public.marketplace_stock_reservations to service_role;
grant all on table public.product_stock_movements to service_role;

create or replace function public.reserve_marketplace_stock(
  p_company_id uuid,
  p_order_id uuid,
  p_marketplace_payment_id uuid,
  p_expires_at timestamptz,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_extras jsonb;
  v_raw_stock text;
  v_controlled boolean;
  v_stock integer;
  v_after integer;
  v_reservation_id uuid;
  v_reserved_count integer := 0;
  v_existing_count integer := 0;
begin
  if p_company_id is null
     or p_order_id is null
     or p_marketplace_payment_id is null then
    raise exception 'Empresa, pedido e pagamento sao obrigatorios.';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'A expiracao da reserva precisa estar no futuro.';
  end if;

  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'A reserva precisa conter produtos.';
  end if;

  perform 1
  from public.marketplace_payments mp
  where mp.id = p_marketplace_payment_id
    and mp.company_id = p_company_id
    and mp.order_id = p_order_id
  for update;

  if not found then
    raise exception 'Pagamento nao pertence ao pedido informado.';
  end if;

  select count(*)
    into v_existing_count
  from public.marketplace_stock_reservations r
  where r.company_id = p_company_id
    and r.marketplace_payment_id = p_marketplace_payment_id;

  if v_existing_count > 0 then
    if exists (
      select 1
      from public.marketplace_stock_reservations r
      where r.company_id = p_company_id
        and r.marketplace_payment_id = p_marketplace_payment_id
        and r.status not in ('reserved', 'confirmed')
    ) then
      raise exception 'A reserva deste pagamento ja foi encerrada.';
    end if;

    return jsonb_build_object(
      'status', 'already_reserved',
      'reservations', v_existing_count
    );
  end if;

  for v_item in
    select parsed.product_id, sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_items)
      as parsed(product_id uuid, quantity integer)
    group by parsed.product_id
    order by parsed.product_id
  loop
    if v_item.product_id is null or coalesce(v_item.quantity, 0) <= 0 then
      raise exception 'Produto e quantidade da reserva sao invalidos.';
    end if;

    select *
      into v_product
    from public.products p
    where p.id = v_item.product_id
      and p.company_id = p_company_id
      and coalesce(p.ativo, true) = true
      and coalesce(p.arquivado, false) = false
      and coalesce(p.archived, false) = false
    for update;

    if not found then
      raise exception 'Um produto nao esta mais disponivel.';
    end if;

    v_extras := coalesce(v_product.extras, '{}'::jsonb);
    v_controlled :=
      lower(coalesce(v_extras ->> 'controle_estoque', 'false')) in ('true', '1', 'yes', 'sim')
      or lower(coalesce(v_extras ->> 'stock_control', 'false')) in ('true', '1', 'yes', 'sim')
      or v_product.estoque is not null;

    if not v_controlled then
      continue;
    end if;

    v_raw_stock := coalesce(
      v_extras ->> 'estoque',
      v_extras ->> 'stock',
      ''
    );

    if v_raw_stock ~ '^[0-9]+$' then
      v_stock := greatest(0, v_raw_stock::integer);
    elsif v_product.estoque is not null then
      v_stock := greatest(0, v_product.estoque);
    else
      v_stock := 0;
    end if;

    if v_stock < v_item.quantity then
      raise exception 'Estoque insuficiente para %. Disponivel: %.',
        coalesce(v_product.nome, 'produto'),
        v_stock;
    end if;

    v_after := v_stock - v_item.quantity;
    v_extras := jsonb_set(v_extras, '{estoque}', to_jsonb(v_after), true);
    v_extras := jsonb_set(v_extras, '{stock}', to_jsonb(v_after), true);

    update public.products
    set estoque = v_after,
        extras = v_extras,
        available = case
          when v_after <= 0 then false
          else coalesce(available, true)
        end,
        updated_at = now()
    where id = v_product.id
      and company_id = p_company_id;

    insert into public.marketplace_stock_reservations (
      company_id,
      order_id,
      marketplace_payment_id,
      product_id,
      quantity,
      status,
      stock_before,
      stock_after,
      expires_at
    )
    values (
      p_company_id,
      p_order_id,
      p_marketplace_payment_id,
      v_product.id,
      v_item.quantity,
      'reserved',
      v_stock,
      v_after,
      p_expires_at
    )
    returning id into v_reservation_id;

    insert into public.product_stock_movements (
      company_id,
      product_id,
      order_id,
      marketplace_payment_id,
      reservation_id,
      movement_type,
      quantity_delta,
      stock_before,
      stock_after,
      reason,
      metadata,
      idempotency_key
    )
    values (
      p_company_id,
      v_product.id,
      p_order_id,
      p_marketplace_payment_id,
      v_reservation_id,
      'reserve',
      -v_item.quantity,
      v_stock,
      v_after,
      'Reserva temporaria para pagamento',
      jsonb_build_object('expires_at', p_expires_at),
      'reserve:' || v_reservation_id::text
    )
    on conflict (idempotency_key) do nothing;

    v_reserved_count := v_reserved_count + 1;
  end loop;

  update public.marketplace_payments
  set stock_reservation_status = case
        when v_reserved_count > 0 then 'reserved'
        else null
      end,
      stock_reserved_at = case
        when v_reserved_count > 0 then now()
        else stock_reserved_at
      end,
      updated_at = now()
  where id = p_marketplace_payment_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'status', case when v_reserved_count > 0 then 'reserved' else 'not_controlled' end,
    'reservations', v_reserved_count
  );
end;
$$;

create or replace function public.settle_marketplace_stock(
  p_company_id uuid,
  p_marketplace_payment_id uuid,
  p_payment_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text := lower(trim(coalesce(p_payment_status, '')));
  v_res public.marketplace_stock_reservations%rowtype;
  v_product public.products%rowtype;
  v_extras jsonb;
  v_raw_stock text;
  v_stock integer;
  v_after integer;
  v_confirmed integer := 0;
  v_released integer := 0;
  v_review integer := 0;
  v_target_status text;
  v_movement_type text;
begin
  if v_status not in (
    'paid',
    'failed',
    'canceled',
    'expired',
    'refunded',
    'charged_back'
  ) then
    return jsonb_build_object(
      'status', 'pending',
      'confirmed', 0,
      'released', 0,
      'review_required', 0
    );
  end if;

  perform 1
  from public.marketplace_payments mp
  where mp.id = p_marketplace_payment_id
    and mp.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Pagamento nao encontrado para liquidar estoque.';
  end if;

  for v_res in
    select *
    from public.marketplace_stock_reservations r
    where r.company_id = p_company_id
      and r.marketplace_payment_id = p_marketplace_payment_id
    order by r.product_id
    for update
  loop
    if v_status = 'paid' then
      if v_res.status = 'reserved' then
        update public.marketplace_stock_reservations
        set status = 'confirmed',
            confirmed_at = now(),
            updated_at = now()
        where id = v_res.id;

        insert into public.product_stock_movements (
          company_id,
          product_id,
          order_id,
          marketplace_payment_id,
          reservation_id,
          movement_type,
          quantity_delta,
          stock_before,
          stock_after,
          reason,
          idempotency_key
        )
        values (
          v_res.company_id,
          v_res.product_id,
          v_res.order_id,
          v_res.marketplace_payment_id,
          v_res.id,
          'confirm',
          0,
          v_res.stock_after,
          v_res.stock_after,
          coalesce(p_reason, 'Pagamento aprovado'),
          'confirm:' || v_res.id::text
        )
        on conflict (idempotency_key) do nothing;

        v_confirmed := v_confirmed + 1;
      end if;

      continue;
    end if;

    if v_status in ('refunded', 'charged_back')
       and v_res.status = 'confirmed' then
      update public.marketplace_stock_reservations
      set status = 'review_required',
          release_reason = coalesce(p_reason, v_status),
          updated_at = now()
      where id = v_res.id;

      insert into public.product_stock_movements (
        company_id,
        product_id,
        order_id,
        marketplace_payment_id,
        reservation_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        reason,
        idempotency_key
      )
      values (
        v_res.company_id,
        v_res.product_id,
        v_res.order_id,
        v_res.marketplace_payment_id,
        v_res.id,
        'review_required',
        0,
        v_res.stock_after,
        v_res.stock_after,
        coalesce(p_reason, v_status),
        'review:' || v_res.id::text
      )
      on conflict (idempotency_key) do nothing;

      v_review := v_review + 1;
      continue;
    end if;

    if v_res.status <> 'reserved' then
      continue;
    end if;

    select *
      into v_product
    from public.products p
    where p.id = v_res.product_id
      and p.company_id = p_company_id
    for update;

    if not found then
      raise exception 'Produto da reserva nao foi encontrado.';
    end if;

    v_extras := coalesce(v_product.extras, '{}'::jsonb);
    v_raw_stock := coalesce(
      v_extras ->> 'estoque',
      v_extras ->> 'stock',
      ''
    );

    if v_raw_stock ~ '^[0-9]+$' then
      v_stock := greatest(0, v_raw_stock::integer);
    elsif v_product.estoque is not null then
      v_stock := greatest(0, v_product.estoque);
    else
      v_stock := 0;
    end if;

    v_after := v_stock + v_res.quantity;
    v_extras := jsonb_set(v_extras, '{estoque}', to_jsonb(v_after), true);
    v_extras := jsonb_set(v_extras, '{stock}', to_jsonb(v_after), true);

    update public.products
    set estoque = v_after,
        extras = v_extras,
        available = case
          when coalesce(ativo, true) = false
            or coalesce(arquivado, false) = true
            or coalesce(archived, false) = true
          then false
          else v_after > 0
        end,
        updated_at = now()
    where id = v_product.id
      and company_id = p_company_id;

    v_target_status := case
      when v_status = 'expired' then 'expired'
      else 'released'
    end;
    v_movement_type := case
      when v_status = 'expired' then 'expire'
      else 'release'
    end;

    update public.marketplace_stock_reservations
    set status = v_target_status,
        released_at = now(),
        release_reason = coalesce(p_reason, v_status),
        updated_at = now()
    where id = v_res.id;

    insert into public.product_stock_movements (
      company_id,
      product_id,
      order_id,
      marketplace_payment_id,
      reservation_id,
      movement_type,
      quantity_delta,
      stock_before,
      stock_after,
      reason,
      idempotency_key
    )
    values (
      v_res.company_id,
      v_res.product_id,
      v_res.order_id,
      v_res.marketplace_payment_id,
      v_res.id,
      v_movement_type,
      v_res.quantity,
      v_stock,
      v_after,
      coalesce(p_reason, v_status),
      v_movement_type || ':' || v_res.id::text
    )
    on conflict (idempotency_key) do nothing;

    v_released := v_released + 1;
  end loop;

  update public.marketplace_payments
  set stock_reservation_status = case
        when v_status = 'paid' then 'confirmed'
        when v_status = 'expired' then 'expired'
        when v_review > 0 then 'review_required'
        else 'released'
      end,
      stock_confirmed_at = case
        when v_status = 'paid' then coalesce(stock_confirmed_at, now())
        else stock_confirmed_at
      end,
      stock_released_at = case
        when v_status <> 'paid' and v_review = 0
        then coalesce(stock_released_at, now())
        else stock_released_at
      end,
      updated_at = now()
  where id = p_marketplace_payment_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'status', case
      when v_status = 'paid' then 'confirmed'
      when v_status = 'expired' then 'expired'
      when v_review > 0 then 'review_required'
      else 'released'
    end,
    'confirmed', v_confirmed,
    'released', v_released,
    'review_required', v_review
  );
end;
$$;

create or replace function public.expire_marketplace_stock_reservations(
  p_limit integer default 500
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment record;
  v_processed integer := 0;
begin
  for v_payment in
    select r.company_id, r.marketplace_payment_id
    from public.marketplace_stock_reservations r
    where r.status = 'reserved'
      and r.expires_at <= now()
    group by r.company_id, r.marketplace_payment_id
    order by min(r.expires_at)
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  loop
    perform public.settle_marketplace_stock(
      v_payment.company_id,
      v_payment.marketplace_payment_id,
      'expired',
      'Reserva expirada automaticamente'
    );

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke execute on function public.reserve_marketplace_stock(uuid, uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
revoke execute on function public.settle_marketplace_stock(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.expire_marketplace_stock_reservations(integer)
  from public, anon, authenticated;

grant execute on function public.reserve_marketplace_stock(uuid, uuid, uuid, timestamptz, jsonb)
  to service_role;
grant execute on function public.settle_marketplace_stock(uuid, uuid, text, text)
  to service_role;
grant execute on function public.expire_marketplace_stock_reservations(integer)
  to service_role;

select cron.schedule(
  'orcaly-release-expired-stock',
  '*/5 * * * *',
  $cron$select public.expire_marketplace_stock_reservations(500);$cron$
);
