-- ORÇALY - SQL de compatibilidade pós-limpeza
-- Rode no Supabase se aparecer erro em admin_audit_logs ou permissões admin.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid()
);

alter table public.admin_audit_logs add column if not exists admin_email text;
alter table public.admin_audit_logs add column if not exists action text;
alter table public.admin_audit_logs add column if not exists target_type text;
alter table public.admin_audit_logs add column if not exists target_id text;
alter table public.admin_audit_logs add column if not exists target_label text;
alter table public.admin_audit_logs add column if not exists payload jsonb default '{}'::jsonb;
alter table public.admin_audit_logs add column if not exists created_at timestamp with time zone default now();

update public.admin_audit_logs set admin_email = 'system' where admin_email is null or trim(admin_email) = '';
update public.admin_audit_logs set action = 'legacy_log' where action is null or trim(action) = '';
update public.admin_audit_logs set payload = '{}'::jsonb where payload is null;
update public.admin_audit_logs set created_at = now() where created_at is null;

alter table public.admin_audit_logs alter column admin_email set not null;
alter table public.admin_audit_logs alter column action set not null;
alter table public.admin_audit_logs alter column payload set default '{}'::jsonb;
alter table public.admin_audit_logs alter column payload set not null;
alter table public.admin_audit_logs alter column created_at set default now();

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_admin_email on public.admin_audit_logs(lower(admin_email), created_at desc);

insert into public.admin_users (email, nome, role, ativo, permissions, area)
values (
  'araujovinicius249@gmail.com',
  'Vinicius Araújo',
  'super_admin',
  true,
  '{"all":true,"dashboard":true,"companies":true,"users":true,"leads":true,"finance":true,"bugs":true,"scanner":true,"team":true,"settings":true,"security":true}'::jsonb,
  'Dono'
)
on conflict (email)
do update set
  nome = excluded.nome,
  role = 'super_admin',
  ativo = true,
  permissions = excluded.permissions,
  area = excluded.area;
