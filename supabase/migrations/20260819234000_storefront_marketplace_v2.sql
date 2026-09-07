-- ORCALY STOREFRONT / MARKETPLACE EXPERIENCE 2.0
-- Additive-only. Do not apply to production before staging QA and explicit approval.

create table if not exists public.storefront_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null check (event_type in ('page_view','product_view','search','favorite_add','add_to_cart','checkout_start','order_created')),
  product_id uuid references public.products(id) on delete set null,
  search_query text check (search_query is null or char_length(search_query) <= 80),
  result_count integer check (result_count is null or result_count >= 0),
  session_hash text check (session_hash is null or session_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.storefront_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  customer_magic_link_id uuid references public.customer_magic_links(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1200),
  photo_url text,
  status text not null default 'published' check (status in ('published','hidden','removed')),
  company_reply text check (company_reply is null or char_length(company_reply) <= 1200),
  replied_at timestamptz,
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id, customer_magic_link_id)
);

alter table public.storefront_events enable row level security;
alter table public.storefront_reviews enable row level security;

-- No authenticated/browser policies are intentionally created.
-- Public writes and company reads go through server-side APIs after tenant validation.

create index if not exists idx_storefront_events_company_created
  on public.storefront_events (company_id, created_at desc);
create index if not exists idx_storefront_events_company_type_created
  on public.storefront_events (company_id, event_type, created_at desc);
create index if not exists idx_storefront_events_company_product_created
  on public.storefront_events (company_id, product_id, created_at desc)
  where product_id is not null;
create index if not exists idx_storefront_reviews_company_product_created
  on public.storefront_reviews (company_id, product_id, created_at desc)
  where status = 'published';
create index if not exists idx_storefront_reviews_order
  on public.storefront_reviews (order_id, created_at desc);
