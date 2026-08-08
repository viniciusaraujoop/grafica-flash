create table if not exists public.affiliate_leads (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  company_name text,
  whatsapp text,
  email text,
  segment text not null default 'services',
  status text not null default 'new' check (status in ('new','contacted','demo','trial','converted','lost')),
  source text not null default 'manual',
  notes text,
  next_follow_up_at timestamptz,
  estimated_plan text,
  estimated_value numeric(12,2) not null default 0 check (estimated_value >= 0),
  lost_reason text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_leads_affiliate_status_idx on public.affiliate_leads(affiliate_id, status);
create index if not exists affiliate_leads_follow_up_idx on public.affiliate_leads(affiliate_id, next_follow_up_at) where next_follow_up_at is not null;

create table if not exists public.affiliate_tasks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  lead_id uuid references public.affiliate_leads(id) on delete set null,
  title text not null check (char_length(title) between 2 and 180),
  task_type text not null default 'follow_up' check (task_type in ('follow_up','demo','prospecting','content','study','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_tasks_due_idx on public.affiliate_tasks(affiliate_id, completed_at, due_at);

create table if not exists public.affiliate_goals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  period_start date not null,
  contacts_target integer not null default 30 check (contacts_target >= 0),
  demos_target integer not null default 10 check (demos_target >= 0),
  trials_target integer not null default 5 check (trials_target >= 0),
  customers_target integer not null default 3 check (customers_target >= 0),
  content_target integer not null default 4 check (content_target >= 0),
  study_target integer not null default 4 check (study_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_id, period_start)
);

create table if not exists public.affiliate_activity_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  lead_id uuid references public.affiliate_leads(id) on delete set null,
  kind text not null check (kind in ('contact','demo','trial','converted','content','lesson','quiz','practice','follow_up','task','manual')),
  xp integer not null default 0 check (xp between 0 and 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_activity_events_period_idx on public.affiliate_activity_events(affiliate_id, created_at desc);
create index if not exists affiliate_activity_events_kind_idx on public.affiliate_activity_events(affiliate_id, kind, created_at desc);

create table if not exists public.affiliate_course_progress (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  score numeric(5,2),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (affiliate_id, course_id, lesson_id)
);

create index if not exists affiliate_course_progress_affiliate_idx on public.affiliate_course_progress(affiliate_id, completed_at desc);

create table if not exists public.affiliate_certifications (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  certification_id text not null,
  title text not null,
  score numeric(5,2) not null check (score between 0 and 100),
  status text not null default 'issued' check (status in ('issued','expired','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (affiliate_id, certification_id)
);

create table if not exists public.affiliate_training_sessions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  mode text not null check (mode in ('sales','objection','demo','quiz')),
  scenario_id text not null,
  answer text,
  total_score numeric(5,2) not null default 0 check (total_score between 0 and 100),
  score_json jsonb not null default '{}'::jsonb,
  feedback text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_training_sessions_idx on public.affiliate_training_sessions(affiliate_id, completed_at desc);

create table if not exists public.affiliate_achievements (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id) on delete cascade,
  achievement_id text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  unique (affiliate_id, achievement_id)
);

create table if not exists public.affiliate_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  kind text not null default 'news' check (kind in ('news','training','product','community')),
  cta_label text,
  cta_href text,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.affiliate_leads enable row level security;
alter table public.affiliate_tasks enable row level security;
alter table public.affiliate_goals enable row level security;
alter table public.affiliate_activity_events enable row level security;
alter table public.affiliate_course_progress enable row level security;
alter table public.affiliate_certifications enable row level security;
alter table public.affiliate_training_sessions enable row level security;
alter table public.affiliate_achievements enable row level security;
alter table public.affiliate_announcements enable row level security;

grant select, insert, update, delete on public.affiliate_leads to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_tasks to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_goals to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_activity_events to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_course_progress to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_certifications to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_training_sessions to authenticated, service_role;
grant select, insert, update, delete on public.affiliate_achievements to authenticated, service_role;
grant select on public.affiliate_announcements to authenticated, service_role;
grant insert, update, delete on public.affiliate_announcements to service_role;

create policy affiliate_leads_select_own on public.affiliate_leads for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_leads.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_leads_insert_own on public.affiliate_leads for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_leads.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_leads_update_own on public.affiliate_leads for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_leads.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_leads.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_leads_delete_own on public.affiliate_leads for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_leads.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_tasks_select_own on public.affiliate_tasks for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_tasks.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_tasks_insert_own on public.affiliate_tasks for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_tasks.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_tasks_update_own on public.affiliate_tasks for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_tasks.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_tasks.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_tasks_delete_own on public.affiliate_tasks for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_tasks.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_goals_select_own on public.affiliate_goals for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_goals.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_goals_insert_own on public.affiliate_goals for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_goals.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_goals_update_own on public.affiliate_goals for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_goals.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_goals.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_goals_delete_own on public.affiliate_goals for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_goals.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_events_select_own on public.affiliate_activity_events for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_activity_events.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_events_insert_own on public.affiliate_activity_events for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_activity_events.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_events_update_own on public.affiliate_activity_events for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_activity_events.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_activity_events.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_events_delete_own on public.affiliate_activity_events for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_activity_events.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_course_select_own on public.affiliate_course_progress for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_course_progress.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_course_insert_own on public.affiliate_course_progress for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_course_progress.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_course_update_own on public.affiliate_course_progress for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_course_progress.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_course_progress.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_course_delete_own on public.affiliate_course_progress for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_course_progress.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_cert_select_own on public.affiliate_certifications for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_certifications.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_cert_insert_own on public.affiliate_certifications for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_certifications.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_cert_update_own on public.affiliate_certifications for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_certifications.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_certifications.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_cert_delete_own on public.affiliate_certifications for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_certifications.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_training_select_own on public.affiliate_training_sessions for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_training_sessions.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_training_insert_own on public.affiliate_training_sessions for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_training_sessions.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_training_update_own on public.affiliate_training_sessions for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_training_sessions.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_training_sessions.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_training_delete_own on public.affiliate_training_sessions for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_training_sessions.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_achievements_select_own on public.affiliate_achievements for select to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_achievements.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_achievements_insert_own on public.affiliate_achievements for insert to authenticated
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_achievements.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_achievements_update_own on public.affiliate_achievements for update to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_achievements.affiliate_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_achievements.affiliate_id and p.user_id = (select auth.uid())));
create policy affiliate_achievements_delete_own on public.affiliate_achievements for delete to authenticated
using (exists (select 1 from public.affiliate_profiles p where p.id = affiliate_achievements.affiliate_id and p.user_id = (select auth.uid())));

create policy affiliate_announcements_read on public.affiliate_announcements for select to authenticated
using (is_active = true and published_at <= now());

insert into public.affiliate_announcements (title, body, kind, cta_label, cta_href)
select 'Bem-vindo à nova Central do Parceiro', 'CRM, metas, treinamentos, certificações e ferramentas comerciais agora fazem parte da evolução do programa.', 'product', 'Abrir Central Comercial', '/parceiros/painel'
where not exists (select 1 from public.affiliate_announcements where title = 'Bem-vindo à nova Central do Parceiro');

insert into public.affiliate_announcements (title, body, kind, cta_label, cta_href)
select 'Use a demonstração antes de apresentar preço', 'Uma demonstração curta e contextual ajuda o cliente a entender o fluxo antes de avaliar investimento.', 'training', 'Abrir demonstração', '/parceiros/demo?training=1'
where not exists (select 1 from public.affiliate_announcements where title = 'Use a demonstração antes de apresentar preço');
