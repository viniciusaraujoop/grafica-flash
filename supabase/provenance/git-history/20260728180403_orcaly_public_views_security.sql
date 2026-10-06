-- ORCALY_PUBLIC_VIEWS_SECURITY_1D2
-- Mantem as views publicas compativeis sem expor as tabelas internas.

create schema if not exists orcaly_private;

revoke all on schema orcaly_private from public;
grant usage on schema orcaly_private to anon, authenticated, service_role;

create or replace function orcaly_private.public_companies_data()
returns table (
  id uuid,
  nome text,
  slug text,
  logo_url text,
  whatsapp text,
  cor_principal text,
  ativo boolean,
  segmento text,
  cidade text,
  estado text,
  aceita_pix boolean,
  cobrar_sinal boolean,
  percentual_sinal numeric,
  modelo_negocio text,
  modelo_nome text,
  modelo_perguntas jsonb,
  subdomain_slug text,
  site_template text,
  site_status text,
  site_primary_color text,
  site_accent_color text,
  site_config jsonb,
  atendimento_horario text,
  atendimento_observacao text,
  instagram text,
  marketplace_ativo boolean,
  marketplace_titulo text,
  marketplace_subtitulo text,
  marketplace_texto_botao text,
  marketplace_endereco text,
  marketplace_mapa_url text,
  site_publico_ativo boolean,
  site_background_color text,
  site_headline text,
  site_subheadline text,
  site_cta_text text,
  site_banner_url text,
  site_about_title text,
  site_about_text text,
  site_services_title text,
  site_contact_title text,
  site_show_store boolean,
  site_show_about boolean,
  site_show_contact boolean,
  site_show_featured boolean,
  site_features jsonb,
  site_faq jsonb,
  site_testimonials jsonb,
  site_custom_sections jsonb,
  site_layout text,
  site_art_style text,
  site_font_style text,
  site_button_style text,
  site_hero_alignment text,
  site_text_color text,
  site_card_color text,
  site_badge_text text,
  site_secondary_cta_text text,
  site_whatsapp_message text,
  site_show_faq boolean,
  site_show_testimonials boolean,
  site_show_gallery boolean,
  site_show_benefits boolean,
  site_gallery jsonb,
  site_benefits jsonb,
  site_seo_title text,
  site_seo_description text,
  site_keywords text[],
  site_promo_title text,
  site_promo_text text,
  site_promo_active boolean,
  site_promo_button_text text,
  site_business_hours jsonb,
  site_payment_methods text[],
  site_delivery_options text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.nome,
    c.slug,
    c.logo_url,
    c.whatsapp,
    c.cor_principal,
    c.ativo,
    c.segmento,
    c.cidade,
    c.estado,
    c.aceita_pix,
    c.cobrar_sinal,
    c.percentual_sinal,
    c.modelo_negocio,
    c.modelo_nome,
    c.modelo_perguntas,
    c.subdomain_slug,
    c.site_template,
    c.site_status,
    c.site_primary_color,
    c.site_accent_color,
    c.site_config,
    c.atendimento_horario,
    c.atendimento_observacao,
    c.instagram,
    c.marketplace_ativo,
    c.marketplace_titulo,
    c.marketplace_subtitulo,
    c.marketplace_texto_botao,
    c.marketplace_endereco,
    c.marketplace_mapa_url,
    c.site_publico_ativo,
    c.site_background_color,
    c.site_headline,
    c.site_subheadline,
    c.site_cta_text,
    c.site_banner_url,
    c.site_about_title,
    c.site_about_text,
    c.site_services_title,
    c.site_contact_title,
    c.site_show_store,
    c.site_show_about,
    c.site_show_contact,
    c.site_show_featured,
    c.site_features,
    c.site_faq,
    c.site_testimonials,
    c.site_custom_sections,
    c.site_layout,
    c.site_art_style,
    c.site_font_style,
    c.site_button_style,
    c.site_hero_alignment,
    c.site_text_color,
    c.site_card_color,
    c.site_badge_text,
    c.site_secondary_cta_text,
    c.site_whatsapp_message,
    c.site_show_faq,
    c.site_show_testimonials,
    c.site_show_gallery,
    c.site_show_benefits,
    c.site_gallery,
    c.site_benefits,
    c.site_seo_title,
    c.site_seo_description,
    c.site_keywords,
    c.site_promo_title,
    c.site_promo_text,
    c.site_promo_active,
    c.site_promo_button_text,
    c.site_business_hours,
    c.site_payment_methods,
    c.site_delivery_options
  from public.companies c
  where coalesce(c.ativo, true) = true;
$$;

create or replace function orcaly_private.public_products_data()
returns table (
  id uuid,
  company_id uuid,
  nome text,
  preco numeric,
  ativo boolean,
  descricao text,
  categoria text,
  tipo text,
  unidade text,
  imagem_url text,
  image_urls text[],
  destaque boolean,
  precificacao text,
  unidade_label text,
  permite_largura boolean,
  permite_altura boolean,
  permite_comprimento boolean,
  permite_quantidade boolean,
  valor_minimo numeric,
  configuracoes jsonb,
  prazo_medio text,
  created_at timestamptz,
  variacoes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.company_id,
    p.nome,
    p.preco,
    p.ativo,
    p.descricao,
    p.categoria,
    p.tipo,
    p.unidade,
    p.imagem_url,
    p.image_urls,
    p.destaque,
    p.precificacao,
    p.unidade_label,
    p.permite_largura,
    p.permite_altura,
    p.permite_comprimento,
    p.permite_quantidade,
    p.valor_minimo,
    p.configuracoes,
    p.prazo_medio,
    p.created_at,
    p.variacoes
  from public.products p
  where coalesce(p.ativo, true) = true;
$$;

create or replace function orcaly_private.public_site_sections_data()
returns table (
  id uuid,
  company_id uuid,
  type text,
  title text,
  subtitle text,
  content text,
  image_url text,
  button_label text,
  button_url text,
  sort_order integer,
  active boolean,
  config jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.company_id,
    s.type,
    s.title,
    s.subtitle,
    s.content,
    s.image_url,
    s.button_label,
    s.button_url,
    s.sort_order,
    s.active,
    s.config,
    s.updated_at
  from public.site_sections s
  where s.active = true;
$$;

revoke all on function orcaly_private.public_companies_data()
  from public;
revoke all on function orcaly_private.public_products_data()
  from public;
revoke all on function orcaly_private.public_site_sections_data()
  from public;

grant execute on function orcaly_private.public_companies_data()
  to anon, authenticated, service_role;
grant execute on function orcaly_private.public_products_data()
  to anon, authenticated, service_role;
grant execute on function orcaly_private.public_site_sections_data()
  to anon, authenticated, service_role;

create or replace view public.public_company_profiles
with (security_invoker = true)
as
select
  c.id,
  c.nome,
  c.slug,
  c.logo_url,
  c.whatsapp,
  c.cor_principal,
  c.cidade,
  c.estado,
  c.segmento,
  c.modelo_negocio,
  c.modelo_nome,
  c.modelo_perguntas,
  c.ativo,
  c.subdomain_slug,
  c.site_template,
  c.site_status,
  c.site_primary_color,
  c.site_accent_color,
  c.site_config
from orcaly_private.public_companies_data() c
where c.ativo = true;

create or replace view public.public_marketplace_companies
with (security_invoker = true)
as
select
  c.id,
  c.nome,
  c.slug,
  c.subdomain_slug,
  c.logo_url,
  c.whatsapp,
  c.cor_principal,
  c.modelo_negocio,
  c.modelo_nome,
  c.modelo_perguntas,
  c.atendimento_horario,
  c.atendimento_observacao,
  c.instagram,
  c.aceita_pix,
  c.cobrar_sinal,
  c.percentual_sinal,
  c.site_primary_color,
  c.site_accent_color,
  c.ativo
from orcaly_private.public_companies_data() c
where coalesce(c.ativo, true) = true;

create or replace view public.public_site_companies
with (security_invoker = true)
as
select
  c.id,
  c.nome,
  c.slug,
  c.subdomain_slug,
  c.logo_url,
  c.whatsapp,
  c.instagram,
  c.cidade,
  c.estado,
  c.segmento,
  c.modelo_negocio,
  c.modelo_nome,
  c.atendimento_horario,
  c.atendimento_observacao,
  c.marketplace_endereco,
  c.marketplace_mapa_url,
  c.marketplace_ativo,
  c.marketplace_titulo,
  c.marketplace_subtitulo,
  c.marketplace_texto_botao,
  c.site_publico_ativo,
  c.site_template,
  c.site_layout,
  c.site_art_style,
  c.site_font_style,
  c.site_button_style,
  c.site_hero_alignment,
  c.site_primary_color,
  c.site_accent_color,
  c.site_background_color,
  c.site_text_color,
  c.site_card_color,
  c.site_badge_text,
  c.site_headline,
  c.site_subheadline,
  c.site_cta_text,
  c.site_secondary_cta_text,
  c.site_banner_url,
  c.site_whatsapp_message,
  c.site_about_title,
  c.site_about_text,
  c.site_services_title,
  c.site_contact_title,
  c.site_show_store,
  c.site_show_about,
  c.site_show_contact,
  c.site_show_featured,
  c.site_show_faq,
  c.site_show_testimonials,
  c.site_show_gallery,
  c.site_show_benefits,
  c.site_features,
  c.site_faq,
  c.site_testimonials,
  c.site_gallery,
  c.site_benefits,
  c.site_custom_sections,
  c.site_seo_title,
  c.site_seo_description,
  c.site_keywords,
  c.site_promo_title,
  c.site_promo_text,
  c.site_promo_active,
  c.site_promo_button_text,
  c.site_business_hours,
  c.site_payment_methods,
  c.site_delivery_options
from orcaly_private.public_companies_data() c
where coalesce(c.site_publico_ativo, true) = true
  and coalesce(c.ativo, true) = true;

create or replace view public.public_marketplace_products
with (security_invoker = true)
as
select
  p.id,
  p.company_id,
  p.nome,
  p.preco,
  p.ativo,
  p.descricao,
  p.categoria,
  p.tipo,
  p.unidade,
  p.imagem_url,
  p.image_urls,
  p.destaque,
  p.precificacao,
  p.unidade_label,
  p.permite_largura,
  p.permite_altura,
  p.permite_comprimento,
  p.permite_quantidade,
  p.valor_minimo,
  p.configuracoes,
  p.prazo_medio,
  p.created_at
from orcaly_private.public_products_data() p
where coalesce(p.ativo, true) = true;

create or replace view public.public_store_products
with (security_invoker = true)
as
select
  p.id,
  p.company_id,
  p.nome,
  p.preco,
  p.categoria,
  p.descricao,
  p.imagem_url,
  p.image_urls,
  p.variacoes,
  p.prazo_medio,
  p.destaque,
  p.ativo
from orcaly_private.public_products_data() p
join orcaly_private.public_companies_data() c
  on c.id = p.company_id
where p.ativo = true
  and c.ativo = true;

create or replace view public.public_site_sections
with (security_invoker = true)
as
select
  s.id,
  s.company_id,
  s.type,
  s.title,
  s.subtitle,
  s.content,
  s.image_url,
  s.button_label,
  s.button_url,
  s.sort_order,
  s.config,
  s.updated_at
from orcaly_private.public_site_sections_data() s
join orcaly_private.public_companies_data() c
  on c.id = s.company_id
where s.active = true
  and c.ativo = true
  and coalesce(c.site_status, 'publicado') = 'publicado';

revoke all privileges on public.public_company_profiles
  from public, anon, authenticated, service_role;
revoke all privileges on public.public_marketplace_companies
  from public, anon, authenticated, service_role;
revoke all privileges on public.public_site_companies
  from public, anon, authenticated, service_role;
revoke all privileges on public.public_marketplace_products
  from public, anon, authenticated, service_role;
revoke all privileges on public.public_store_products
  from public, anon, authenticated, service_role;
revoke all privileges on public.public_site_sections
  from public, anon, authenticated, service_role;

grant select on public.public_company_profiles
  to anon, authenticated, service_role;
grant select on public.public_marketplace_companies
  to anon, authenticated, service_role;
grant select on public.public_site_companies
  to anon, authenticated, service_role;
grant select on public.public_marketplace_products
  to anon, authenticated, service_role;
grant select on public.public_store_products
  to anon, authenticated, service_role;
grant select on public.public_site_sections
  to anon, authenticated, service_role;

revoke all privileges on public.companies from anon;
revoke all privileges on public.products from anon;
revoke all privileges on public.site_sections from anon;
