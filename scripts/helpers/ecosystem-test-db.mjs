import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// Synthetic users and companies. No network, credentials or production data.
export const ids = {
  a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222',
  member: '33333333-3333-4333-8333-333333333333', companyA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', companyB: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
}

export async function createTestDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.companies(id uuid primary key, owner_id uuid references auth.users(id));
    create table public.company_members(company_id uuid references public.companies(id),user_id uuid references auth.users(id),status text);
    alter table public.companies enable row level security;
    alter table public.company_members enable row level security;
    grant select on public.companies,public.company_members to authenticated;
    create policy company_owner_read on public.companies for select to authenticated using (owner_id=auth.uid());
    create policy member_read on public.company_members for select to authenticated using (user_id=auth.uid());
  `)
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260926014103_ecosystem_identity_wealth.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260926103114_wealth_lifecycle_aggregates.sql', import.meta.url), 'utf8'))
  for (const user of [ids.a, ids.b, ids.member]) await db.query('insert into auth.users values ($1)', [user])
  await db.query('insert into public.companies values ($1,$2),($3,$4)', [ids.companyA, ids.a, ids.companyB, ids.b])
  await db.query('insert into public.company_members values ($1,$2,$3)', [ids.companyA,ids.member,'ativo'])
  for (const user of [ids.a, ids.b]) await db.query(`insert into public.ecosystem_product_entitlements(product_id,user_id,permissions,source) values ('wealth',$1,array['wealth.read','wealth.write','wealth.export'],'manual')`, [user])
  for (const company of [ids.companyA, ids.companyB]) await db.query(`insert into public.ecosystem_product_entitlements(product_id,company_id,permissions,source) values ('business',$1,array['business.read'],'subscription')`, [company])
  return db
}

export async function asUser(db, user) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ''])
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
}

export async function asAdmin(db) { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)") }
