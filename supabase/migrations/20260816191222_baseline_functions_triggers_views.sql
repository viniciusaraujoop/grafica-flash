-- Recovery R3 routines and projections. Runtime validation is deferred until all objects exist.
set check_function_bodies = off;
set lock_timeout = '5s';
set statement_timeout = '120s';

CREATE OR REPLACE FUNCTION orcaly_private.can_manage_company(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (c.owner_id = auth.uid() or c.tester_id = auth.uid())
  )
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ativo'
  )
  or orcaly_private.is_orcaly_admin();
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.can_manage_storage_path(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    orcaly_private.can_manage_company(
      orcaly_private.storage_path_company_id(p_name)
    ),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.create_default_site_for_company(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c record;
  hero_title text;
  hero_subtitle text;
  services_title text;
  trust_title text;
begin
  select * into c from public.companies where id = p_company_id;

  if not found then
    return;
  end if;

  if exists (select 1 from public.site_sections where company_id = p_company_id) then
    return;
  end if;

  hero_title := 'Atendimento profissional para o seu pedido';
  hero_subtitle := 'Conheça produtos e serviços, envie sua solicitação e receba uma proposta organizada.';
  services_title := 'Produtos e serviços';
  trust_title := 'Por que escolher a nossa empresa?';

  if c.modelo_negocio = 'grafica' then
    hero_title := 'Impressos, personalizados e comunicação visual sob medida';
    hero_subtitle := 'Envie medidas, quantidades, acabamento e arte para receber uma proposta rápida.';
    services_title := 'Materiais gráficos e personalizados';
    trust_title := 'Qualidade visual, prazo e atendimento claro';

  elsif c.modelo_negocio = 'assistencia_tecnica' then
    hero_title := 'Assistência técnica com diagnóstico organizado';
    hero_subtitle := 'Informe aparelho, defeito e urgência para receber orientação com mais agilidade.';
    services_title := 'Serviços de assistência';
    trust_title := 'Diagnóstico, transparência e acompanhamento';

  elsif c.modelo_negocio = 'beleza_estetica' then
    hero_title := 'Serviços de beleza com atendimento profissional';
    hero_subtitle := 'Conheça os serviços, envie sua solicitação e receba atendimento pelo WhatsApp.';
    services_title := 'Serviços de beleza e estética';
    trust_title := 'Cuidado, pontualidade e resultado';

  elsif c.modelo_negocio = 'alimenticio' then
    hero_title := 'Encomendas e pedidos feitos do jeito certo';
    hero_subtitle := 'Escolha sabores, tamanhos, datas e detalhes para receber uma proposta sem bagunça.';
    services_title := 'Cardápio e encomendas';
    trust_title := 'Capricho, organização e sabor';

  elsif c.modelo_negocio = 'automotivo' then
    hero_title := 'Serviços automotivos com orçamento claro';
    hero_subtitle := 'Informe o veículo, serviço desejado e detalhes para receber uma proposta organizada.';
    services_title := 'Serviços automotivos';
    trust_title := 'Confiança, clareza e cuidado com seu veículo';

  elsif c.modelo_negocio = 'construcao_reformas' then
    hero_title := 'Orçamentos para obras, reformas e serviços técnicos';
    hero_subtitle := 'Envie medidas, fotos e detalhes do serviço para receber uma proposta mais precisa.';
    services_title := 'Obras, reformas e serviços';
    trust_title := 'Planejamento, transparência e execução';

  elsif c.modelo_negocio = 'eventos' then
    hero_title := 'Eventos organizados com proposta clara';
    hero_subtitle := 'Informe data, local, quantidade de pessoas e estilo do evento para receber uma proposta.';
    services_title := 'Pacotes, eventos e festas';
    trust_title := 'Organização, presença e atenção aos detalhes';

  elsif c.modelo_negocio = 'moda_varejo' then
    hero_title := 'Produtos, novidades e pedidos em um só lugar';
    hero_subtitle := 'Veja opções, escolha variações e envie seu pedido pelo WhatsApp.';
    services_title := 'Catálogo de produtos';
    trust_title := 'Atendimento rápido, vitrine clara e compra facilitada';

  elsif c.modelo_negocio = 'pet_shop' then
    hero_title := 'Cuidado para pets com atendimento organizado';
    hero_subtitle := 'Escolha serviços, informe dados do pet e solicite atendimento com praticidade.';
    services_title := 'Serviços e produtos pet';
    trust_title := 'Cuidado, carinho e organização';

  elsif c.modelo_negocio = 'educacao_cursos' then
    hero_title := 'Cursos e aulas com inscrição simplificada';
    hero_subtitle := 'Conheça turmas, modalidades e envie seu interesse para receber atendimento.';
    services_title := 'Cursos, aulas e treinamentos';
    trust_title := 'Aprendizado, clareza e acompanhamento';

  elsif c.modelo_negocio = 'consultoria' then
    hero_title := 'Consultoria com briefing claro desde o primeiro contato';
    hero_subtitle := 'Explique seu objetivo, prazo e necessidade para receber uma proposta consultiva.';
    services_title := 'Serviços profissionais';
    trust_title := 'Estratégia, clareza e solução sob medida';

  elsif c.modelo_negocio = 'fotografia_video' then
    hero_title := 'Fotografia e vídeo para registrar momentos e vender melhor';
    hero_subtitle := 'Informe data, local, estilo e pacote desejado para receber uma proposta.';
    services_title := 'Ensaios, eventos e produção visual';
    trust_title := 'Imagem profissional, sensibilidade e entrega';

  elsif c.modelo_negocio = 'saude_bem_estar' then
    hero_title := 'Atendimento de saúde e bem-estar com cuidado';
    hero_subtitle := 'Conheça serviços e envie sua solicitação de forma simples e organizada.';
    services_title := 'Serviços de cuidado e bem-estar';
    trust_title := 'Acolhimento, organização e confiança';

  elsif c.modelo_negocio = 'tecnologia' then
    hero_title := 'Soluções digitais com escopo mais claro';
    hero_subtitle := 'Explique seu projeto, objetivo e prazo para receber uma proposta organizada.';
    services_title := 'Tecnologia, digital e automações';
    trust_title := 'Clareza, processo e entrega profissional';

  elsif c.modelo_negocio = 'servicos_gerais' then
    hero_title := 'Serviços sob orçamento com atendimento direto';
    hero_subtitle := 'Informe o serviço, local, prazo e detalhes para receber uma proposta.';
    services_title := 'Serviços disponíveis';
    trust_title := 'Agilidade, clareza e atendimento local';
  end if;

  insert into public.site_sections
    (company_id, type, title, subtitle, content, button_label, button_url, sort_order, active, locked, config)
  values
    (p_company_id, 'hero', hero_title, hero_subtitle, 'Site profissional criado automaticamente pelo Orçaly para apresentar a empresa e receber solicitações.', 'Fazer solicitação', '#pedido', 1, true, false, '{"layout":"premium"}'::jsonb),
    (p_company_id, 'services', services_title, 'Veja opções disponíveis e envie uma solicitação personalizada.', 'Os itens do catálogo aparecem com destaque para facilitar pedidos.', 'Ver serviços', '#servicos', 2, true, false, '{"source":"products"}'::jsonb),
    (p_company_id, 'trust', trust_title, 'Atendimento pensado para reduzir dúvidas e organizar cada solicitação.', 'Pedido estruturado, proposta profissional e contato direto pelo WhatsApp.', null, null, 3, true, false, '{"items":["Atendimento pelo WhatsApp","Pedido organizado","Proposta profissional"]}'::jsonb),
    (p_company_id, 'about', 'Sobre nós', coalesce(c.nome, 'Nossa empresa'), 'Conte aqui a história, diferenciais e forma de atendimento da empresa. Esse texto pode ser editado no painel.', null, null, 4, true, false, '{}'::jsonb),
    (p_company_id, 'cta', 'Pronto para fazer seu pedido?', 'Envie sua solicitação agora e receba atendimento pelo WhatsApp.', 'Use o formulário inteligente para mandar as informações certas desde o primeiro contato.', 'Começar pedido', '#pedido', 5, true, false, '{}'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.is_company_member(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ativo'
  );
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.is_company_owner(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (
        c.owner_id = auth.uid()
        or c.tester_id = auth.uid()
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.is_orcaly_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_admins p
    where p.is_active = true
      and p.user_id = auth.uid()
      and lower(p.role) in ('owner','super_admin','admin','support','suporte')
  );
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.my_company_role(p_company_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.cargo
  from public.company_members m
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.status = 'ativo'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.orcaly_user_has_company_access(target_company uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  allowed boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.companies') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.companies
            where id = $1
              and (
                owner_id = $2
                or tester_id = $2
              )
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;

    if allowed then
      return true;
    end if;
  end if;

  if to_regclass('public.company_members') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.company_members
            where company_id = $1
              and user_id = $2
              and coalesce(status, ''ativo'') = ''ativo''
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;
  end if;

  return coalesce(allowed, false);
end;
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.public_companies_data()
 RETURNS TABLE(id uuid, nome text, slug text, logo_url text, whatsapp text, cor_principal text, ativo boolean, segmento text, cidade text, estado text, aceita_pix boolean, cobrar_sinal boolean, percentual_sinal numeric, modelo_negocio text, modelo_nome text, modelo_perguntas jsonb, subdomain_slug text, site_template text, site_status text, site_primary_color text, site_accent_color text, site_config jsonb, atendimento_horario text, atendimento_observacao text, instagram text, marketplace_ativo boolean, marketplace_titulo text, marketplace_subtitulo text, marketplace_texto_botao text, marketplace_endereco text, marketplace_mapa_url text, site_publico_ativo boolean, site_background_color text, site_headline text, site_subheadline text, site_cta_text text, site_banner_url text, site_about_title text, site_about_text text, site_services_title text, site_contact_title text, site_show_store boolean, site_show_about boolean, site_show_contact boolean, site_show_featured boolean, site_features jsonb, site_faq jsonb, site_testimonials jsonb, site_custom_sections jsonb, site_layout text, site_art_style text, site_font_style text, site_button_style text, site_hero_alignment text, site_text_color text, site_card_color text, site_badge_text text, site_secondary_cta_text text, site_whatsapp_message text, site_show_faq boolean, site_show_testimonials boolean, site_show_gallery boolean, site_show_benefits boolean, site_gallery jsonb, site_benefits jsonb, site_seo_title text, site_seo_description text, site_keywords text[], site_promo_title text, site_promo_text text, site_promo_active boolean, site_promo_button_text text, site_business_hours jsonb, site_payment_methods text[], site_delivery_options text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.public_products_data()
 RETURNS TABLE(id uuid, company_id uuid, nome text, preco numeric, ativo boolean, descricao text, categoria text, tipo text, unidade text, imagem_url text, image_urls text[], destaque boolean, precificacao text, unidade_label text, permite_largura boolean, permite_altura boolean, permite_comprimento boolean, permite_quantidade boolean, valor_minimo numeric, configuracoes jsonb, prazo_medio text, created_at timestamp with time zone, variacoes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.public_site_sections_data()
 RETURNS TABLE(id uuid, company_id uuid, type text, title text, subtitle text, content text, image_url text, button_label text, button_url text, sort_order integer, active boolean, config jsonb, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.storage_path_company_id(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_segment text;
begin
  v_segment := split_part(coalesce(p_name, ''), '/', 1);

  if v_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_segment::uuid;
  end if;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.sync_signup_lead_sales_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.converted_company_id is not null
     and (
       tg_op = 'INSERT'
       or old.converted_company_id is distinct from new.converted_company_id
       or new.sales_stage <> 'cliente'
     )
  then
    new.sales_stage := 'cliente';
    new.sales_lost_reason := null;
  end if;

  if tg_op = 'INSERT'
     or old.sales_stage is distinct from new.sales_stage
  then
    new.sales_stage_updated_at := now();
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION orcaly_private.touch_affiliate_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_affiliate_payout_admin(p_payout_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id
  for update;

  if not found or payout_row.status not in ('requested','approved') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'cancelled',
      failure_reason = left(coalesce(p_reason, 'Pagamento cancelado.'), 500),
      cancelled_at = now(),
      updated_at = now()
  where id = p_payout_id;

  update public.affiliate_commissions
  set status = 'available',
      payout_id = null,
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset,
        updated_at = now()
    where id = payout_row.affiliate_id;
  end if;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.change_signup_lead_sales_stage(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text DEFAULT NULL::text, p_lost_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text; v_actor_email text; v_assigned_to uuid; v_old_stage text; v_new_stage text := lower(btrim(coalesce(p_stage, '')));
begin
  if v_new_stage not in ('novo','contatado','interessado','demonstracao','convite_fundador','conta_ativada','cliente','perdido') then raise exception 'INVALID_SALES_STAGE'; end if;
  if v_new_stage='perdido' and nullif(btrim(coalesce(p_lost_reason,'')),'') is null then raise exception 'LOST_REASON_REQUIRED'; end if;
  select lower(role),lower(email) into v_actor_role,v_actor_email from public.platform_admins where id=p_actor_admin_id and is_active=true;
  if v_actor_role not in ('owner','prospector') then raise exception 'SALES_ACTOR_NOT_ALLOWED'; end if;
  if v_actor_role='prospector' and v_new_stage in ('conta_ativada','cliente') then raise exception 'SYSTEM_STAGE_ONLY'; end if;
  select assigned_to_admin_id,sales_stage into v_assigned_to,v_old_stage from public.signup_leads where id=p_lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  if v_actor_role='prospector' and v_assigned_to is distinct from p_actor_admin_id then raise exception 'LEAD_NOT_OWNED'; end if;
  update public.signup_leads set sales_stage=v_new_stage,sales_lost_reason=case when v_new_stage='perdido' then nullif(btrim(p_lost_reason),'') else null end,sales_stage_updated_at=now(),updated_at=now() where id=p_lead_id;
  if v_old_stage is distinct from v_new_stage then
    insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data)
    values(p_lead_id,'system','registrado',coalesce(nullif(btrim(p_note),''),'Etapa comercial alterada de '||coalesce(v_old_stage,'sem etapa')||' para '||v_new_stage),now(),now(),v_actor_email,p_actor_admin_id,'stage_change',jsonb_build_object('from_stage',v_old_stage,'to_stage',v_new_stage,'lost_reason',nullif(btrim(p_lost_reason),'')));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_company_subscription_trial(p_company_id uuid)
 RETURNS SETOF companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := now();
  v_trial_end timestamptz := now() + interval '7 days';
begin
  return query
  update public.companies
     set trial_started_at = v_now,
         trial_ends_at = v_trial_end,
         trial_used_at = v_now,
         assinatura_status = 'trialing',
         access_until = v_trial_end,
         cancel_at_period_end = false,
         updated_at = v_now
   where id = p_company_id
     and trial_used_at is null
  returning *;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_due_founder_price_conversions(p_limit integer DEFAULT 20)
 RETURNS TABLE(company_id uuid, claim_id uuid, provider_subscription_id text, plan_key text, founder_price_cents integer, normal_price_cents integer, founder_price_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_price_conversion_claim_id=null, founder_price_conversion_claimed_at=null,
      founder_price_conversion_last_error='STALE_PRICE_CONVERSION_CLAIM_RECOVERED',updated_at=now()
  where c.founder_price_conversion_claim_id is not null
    and c.founder_price_conversion_claimed_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select c.id from public.companies c
    where c.is_founder=true and c.founder_price_ends_at is not null
      and c.founder_price_ends_at <= now() and c.founder_price_converted_at is null
      and c.founder_price_conversion_claim_id is null
      and coalesce(c.provider_subscription_id,c.mercado_pago_subscription_id) is not null
    order by c.founder_price_ends_at,c.id
    limit greatest(1,least(coalesce(p_limit,20),50)) for update skip locked
  )
  update public.companies c
  set founder_price_conversion_claim_id=gen_random_uuid(),
      founder_price_conversion_claimed_at=now(),
      founder_price_conversion_attempts=c.founder_price_conversion_attempts+1,
      founder_price_conversion_last_error=null,updated_at=now()
  from candidates x where c.id=x.id
  returning c.id,c.founder_price_conversion_claim_id,
    coalesce(c.provider_subscription_id,c.mercado_pago_subscription_id),
    lower(coalesce(c.assinatura_plano,c.plano,'')),c.founder_price_cents,
    case lower(coalesce(c.assinatura_plano,c.plano,''))
      when 'basico' then 4990 when 'básico' then 4990 when 'essencial' then 4990
      when 'profissional' then 9990 when 'intermediario' then 9990 when 'intermediário' then 9990
      when 'premium' then 14990 else null end,
    c.founder_price_ends_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_founder_activation(p_token_hash text, p_email text, p_claim_id uuid)
 RETURNS TABLE(invite_id uuid, email text, founder_number integer, plan_key text, founder_price_cents integer, sales_lead_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_email text:=lower(btrim(coalesce(p_email,'')));
begin
  if p_claim_id is null then raise exception 'FOUNDER_ACTIVATION_CLAIM_REQUIRED'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN'; end if;
  if v_email='' or position('@' in v_email)<=1 then raise exception 'FOUNDER_ACTIVATION_INVALID_EMAIL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
  update public.founder_invites set status='pending',activation_claim_id=null,activation_claimed_at=null,activation_last_error='STALE_ACTIVATION_CLAIM_RECOVERED',updated_at=now() where token_hash=p_token_hash and status='activating' and activation_claimed_at<now()-interval '10 minutes';
  select * into v_invite from public.founder_invites where token_hash=p_token_hash for update;
  if not found then raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN'; end if;
  if v_invite.status='activating' then raise exception 'FOUNDER_ACTIVATION_IN_PROGRESS'; end if;
  if v_invite.status<>'pending' then raise exception 'FOUNDER_ACTIVATION_NOT_PENDING'; end if;
  if v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then raise exception 'FOUNDER_ACTIVATION_EXPIRED'; end if;
  if v_invite.email_normalized<>v_email then raise exception 'FOUNDER_ACTIVATION_EMAIL_MISMATCH'; end if;
  update public.founder_invites set status='activating',activation_claim_id=p_claim_id,activation_claimed_at=now(),activation_attempts=activation_attempts+1,activation_last_error=null,updated_at=now() where id=v_invite.id;
  return query select v_invite.id,v_invite.email,v_invite.founder_number,v_invite.plan_key,v_invite.founder_price_cents,v_invite.sales_lead_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.claim_founder_billing_setup(p_company_id uuid, p_claim_id uuid)
 RETURNS TABLE(company_id uuid, plan_payment_id uuid, plan_key text, payer_email text, effective_price_cents integer, founder_price_cents integer, normal_price_cents integer, billing_start_at timestamp with time zone, provider_subscription_id text, checkout_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_payment public.plan_payments%rowtype;
  v_normal integer;
  v_effective integer;
  v_payment_id uuid;
begin
  if p_company_id is null or p_claim_id is null then
    raise exception 'FOUNDER_BILLING_INVALID_CLAIM';
  end if;

  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = 'STALE_BILLING_CLAIM_RECOVERED',
      updated_at = now()
  where c.id = p_company_id
    and c.founder_billing_claim_id is not null
    and c.founder_billing_claimed_at < now() - interval '10 minutes';

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'FOUNDER_BILLING_COMPANY_NOT_FOUND';
  end if;

  if v_company.is_founder is not true then
    raise exception 'FOUNDER_BILLING_NOT_FOUNDER';
  end if;

  if v_company.founder_billing_claim_id is not null then
    raise exception 'FOUNDER_BILLING_IN_PROGRESS';
  end if;

  if v_company.founder_trial_ends_at is null
     or v_company.founder_price_ends_at is null
     or v_company.founder_price_cents is null
  then
    raise exception 'FOUNDER_BILLING_TIMELINE_MISSING';
  end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano, v_company.plano, ''))
    when 'basico' then 4990
    when 'básico' then 4990
    when 'essencial' then 4990
    when 'profissional' then 9990
    when 'intermediario' then 9990
    when 'intermediário' then 9990
    when 'premium' then 14990
    else null
  end;

  if v_normal is null then
    raise exception 'FOUNDER_BILLING_INVALID_PLAN';
  end if;

  v_effective := case
    when now() < v_company.founder_price_ends_at
      then v_company.founder_price_cents
    else v_normal
  end;

  select pp.* into v_payment
  from public.plan_payments pp
  where pp.company_id = p_company_id
    and pp.idempotency_key = 'founder-recurring-v1'
  order by pp.created_at desc
  limit 1
  for update;

  if not found then
    v_payment_id := gen_random_uuid();

    insert into public.plan_payments (
      id, company_id, plano, valor, status, tipo, email, nome_empresa,
      payment_method, provider, billing_type, external_reference,
      idempotency_key, created_at, updated_at
    ) values (
      v_payment_id, p_company_id,
      lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
      v_effective / 100.0, 'subscription_pending', 'subscription',
      lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, '')),
      v_company.nome, 'card_recurring', 'mercado_pago', 'founder_recurring',
      v_payment_id::text, 'founder-recurring-v1', now(), now()
    ) returning * into v_payment;
  else
    update public.plan_payments pp
    set plano = lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
        valor = case
          when coalesce(pp.provider_subscription_id, pp.mercado_pago_preapproval_id) is null
            then v_effective / 100.0
          else pp.valor
        end,
        email = lower(coalesce(v_company.email, pp.email, '')),
        provider = 'mercado_pago',
        billing_type = 'founder_recurring',
        external_reference = coalesce(nullif(pp.external_reference, ''), pp.id::text),
        updated_at = now()
    where pp.id = v_payment.id
    returning * into v_payment;
  end if;

  update public.companies c
  set founder_billing_claim_id = p_claim_id,
      founder_billing_claimed_at = now(),
      founder_billing_attempts = c.founder_billing_attempts + 1,
      founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  return query
  select v_company.id, v_payment.id,
    lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
    lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, v_payment.email, '')),
    v_effective, v_company.founder_price_cents, v_normal,
    v_company.founder_trial_ends_at,
    coalesce(v_company.provider_subscription_id, v_company.mercado_pago_subscription_id,
             v_payment.provider_subscription_id, v_payment.mercado_pago_preapproval_id),
    coalesce(v_payment.checkout_url, v_company.assinatura_checkout_url);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_platform_admin_invite(p_token_hash text, p_claim_id uuid)
 RETURNS SETOF platform_admin_invites
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if p_claim_id is null then return; end if;
  update public.platform_admin_invites
  set status = case when expires_at <= now() then 'expired' else 'pending' end, claimed_at = null, activation_claim_id = null
  where status = 'activating' and claimed_at < now() - interval '10 minutes';
  update public.platform_admin_invites set status = 'expired' where status = 'pending' and expires_at <= now();
  return query
  update public.platform_admin_invites
  set status = 'activating', claimed_at = now(), activation_claim_id = p_claim_id
  where token_hash = lower(p_token_hash) and status = 'pending' and expires_at > now()
  returning *;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_founder_activation(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_estado text DEFAULT NULL::text, p_onboarding_goal text DEFAULT NULL::text, p_default_setup jsonb DEFAULT '{}'::jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_invite public.founder_invites%rowtype; v_lead public.signup_leads%rowtype; v_company public.companies%rowtype; v_user_email text;
  v_company_name text:=btrim(coalesce(p_company_name,'')); v_slug text:=lower(btrim(coalesce(p_slug,''))); v_business_type text:=lower(btrim(coalesce(p_business_type,'services')));
  v_whatsapp text:=nullif(btrim(coalesce(p_whatsapp,'')),''); v_cidade text:=nullif(btrim(coalesce(p_cidade,'')),''); v_estado text:=upper(nullif(btrim(coalesce(p_estado,'')),'')); v_onboarding_goal text:=nullif(btrim(coalesce(p_onboarding_goal,'')),'');
  v_started timestamptz:=now(); v_trial_ends timestamptz; v_price_ends timestamptz; v_payment_methods text[]; v_delivery_options text[];
begin
  if p_claim_id is null or p_user_id is null then raise exception 'FOUNDER_ACTIVATION_INVALID_FINALIZE'; end if;
  select lower(email) into v_user_email from auth.users where id=p_user_id;
  if v_user_email is null then raise exception 'FOUNDER_ACTIVATION_AUTH_USER_NOT_FOUND'; end if;
  select * into v_invite from public.founder_invites where activation_claim_id=p_claim_id and status='activating' for update;
  if not found then raise exception 'FOUNDER_ACTIVATION_CLAIM_NOT_FOUND'; end if;
  if v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then raise exception 'FOUNDER_ACTIVATION_EXPIRED'; end if;
  if lower(v_invite.email)<>v_user_email then raise exception 'FOUNDER_ACTIVATION_AUTH_EMAIL_MISMATCH'; end if;
  if exists(select 1 from public.companies c where c.owner_id=p_user_id or lower(coalesce(c.email,''))=v_user_email) then raise exception 'FOUNDER_ACTIVATION_COMPANY_ALREADY_EXISTS'; end if;
  if length(v_company_name)<2 or length(v_company_name)>80 then raise exception 'FOUNDER_ACTIVATION_INVALID_COMPANY_NAME'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$' or v_slug like '%--%' then raise exception 'FOUNDER_ACTIVATION_INVALID_SLUG'; end if;
  if v_business_type not in ('services','graphic','food','beauty','barber','technical_assistance','auto','store','events','custom_products') then v_business_type:='services'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orcaly-founder-company:'||v_slug,0));
  if exists(select 1 from public.companies c where c.slug=v_slug or lower(c.subdomain_slug)=regexp_replace(v_slug,'[^a-z0-9]','','g')) then raise exception 'FOUNDER_ACTIVATION_SLUG_TAKEN'; end if;
  if v_invite.sales_lead_id is not null then select * into v_lead from public.signup_leads where id=v_invite.sales_lead_id for update; end if;
  v_trial_ends:=v_started+interval '30 days'; v_price_ends:=v_trial_ends+interval '6 months';
  if jsonb_typeof(p_default_setup->'site_payment_methods')='array' then select array_agg(value) into v_payment_methods from jsonb_array_elements_text(p_default_setup->'site_payment_methods') as t(value); end if;
  if jsonb_typeof(p_default_setup->'site_delivery_options')='array' then select array_agg(value) into v_delivery_options from jsonb_array_elements_text(p_default_setup->'site_delivery_options') as t(value); end if;
  insert into public.companies(nome,slug,subdomain_slug,owner_id,email,whatsapp,telefone,cidade,estado,segmento,modelo_negocio,business_type,onboarding_goal,plano,assinatura_plano,assinatura_status,assinatura_inicio,assinatura_expira_em,assinatura_auto_recorrente,trial_started_at,trial_ends_at,trial_used_at,access_until,cancel_at_period_end,is_founder,founder_number,founder_price_cents,founder_started_at,founder_trial_ends_at,founder_price_ends_at,site_template,site_layout,site_cta_text,site_marketplace_title,site_marketplace_subtitle,site_cart_button_text,site_checkout_button_text,site_empty_catalog_text,site_headline,site_subheadline,site_about_title,site_about_text,site_benefits,site_faq,site_features,site_payment_methods,site_delivery_options)
  values(v_company_name,v_slug,v_slug,p_user_id,v_user_email,v_whatsapp,v_whatsapp,v_cidade,v_estado,coalesce(nullif(btrim(v_lead.segmento),''),v_business_type),coalesce(nullif(btrim(v_lead.modelo_negocio),''),v_business_type),v_business_type,v_onboarding_goal,v_invite.plan_key,v_invite.plan_key,'trialing',v_started,v_trial_ends,false,v_started,v_trial_ends,v_started,v_trial_ends,false,true,v_invite.founder_number,v_invite.founder_price_cents,v_started,v_trial_ends,v_price_ends,coalesce(nullif(p_default_setup->>'site_template',''),v_business_type),coalesce(nullif(p_default_setup->>'site_layout',''),'premium'),nullif(p_default_setup->>'site_cta_text',''),nullif(p_default_setup->>'site_marketplace_title',''),nullif(p_default_setup->>'site_marketplace_subtitle',''),nullif(p_default_setup->>'site_cart_button_text',''),nullif(p_default_setup->>'site_checkout_button_text',''),nullif(p_default_setup->>'site_empty_catalog_text',''),nullif(p_default_setup->>'site_headline',''),nullif(p_default_setup->>'site_subheadline',''),nullif(p_default_setup->>'site_about_title',''),nullif(p_default_setup->>'site_about_text',''),coalesce(p_default_setup->'site_benefits','[]'::jsonb),coalesce(p_default_setup->'site_faq','[]'::jsonb),coalesce(p_default_setup->'site_features','[]'::jsonb),v_payment_methods,v_delivery_options) returning * into v_company;
  update public.founder_invites set status='activated',activated_at=v_started,user_id=p_user_id,company_id=v_company.id,activation_claim_id=null,activation_claimed_at=null,activation_last_error=null,updated_at=now() where id=v_invite.id;
  if v_invite.sales_lead_id is not null then
    update public.signup_leads set converted_user_id=p_user_id,converted_company_id=v_company.id,sales_stage='conta_ativada',sales_stage_updated_at=now(),sales_lost_reason=null,raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number,'founder_activated',true,'founder_company_id',v_company.id),updated_at=now() where id=v_invite.sales_lead_id;
    insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data) values(v_invite.sales_lead_id,'system','registrado','Conta Founder #'||lpad(v_invite.founder_number::text,2,'0')||' ativada.',now(),now(),v_invite.created_by_email,v_invite.created_by_admin_id,'system',jsonb_build_object('source','founder_program','event','account_activated','founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number,'company_id',v_company.id,'user_id',p_user_id,'trial_ends_at',v_trial_ends,'founder_price_ends_at',v_price_ends));
  end if;
  return v_company;
end; $function$
;

CREATE OR REPLACE FUNCTION public.complete_founder_billing_setup(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_status text := lower(btrim(coalesce(p_provider_status, 'pending')));
begin
  if nullif(btrim(coalesce(p_subscription_id, '')), '') is null then
    raise exception 'FOUNDER_BILLING_SUBSCRIPTION_REQUIRED';
  end if;

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id and c.founder_billing_claim_id = p_claim_id and c.is_founder = true
  for update;

  if not found then raise exception 'FOUNDER_BILLING_CLAIM_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.plan_payments pp
    where pp.id = p_plan_payment_id and pp.company_id = p_company_id
      and pp.idempotency_key = 'founder-recurring-v1'
  ) then
    raise exception 'FOUNDER_BILLING_PAYMENT_ROW_MISMATCH';
  end if;

  update public.plan_payments pp
  set provider = 'mercado_pago', provider_subscription_id = p_subscription_id,
      mercado_pago_preapproval_id = p_subscription_id, checkout_url = p_checkout_url,
      raw_subscription = coalesce(p_provider_payload, '{}'::jsonb),
      next_payment_date = p_next_payment_date, status = 'subscription_' || v_status,
      updated_at = now()
  where pp.id = p_plan_payment_id;

  update public.companies c
  set subscription_provider = 'mercado_pago', provider_subscription_id = p_subscription_id,
      mercado_pago_subscription_id = p_subscription_id,
      mercado_pago_subscription_status = v_status,
      mercado_pago_customer_email = coalesce(c.mercado_pago_customer_email, c.email),
      assinatura_checkout_url = p_checkout_url,
      assinatura_mp_payload = coalesce(p_provider_payload, '{}'::jsonb),
      assinatura_proxima_cobranca = p_next_payment_date,
      next_billing_at = p_next_payment_date,
      assinatura_auto_recorrente = (v_status = 'authorized'),
      assinatura_status = case
        when c.assinatura_status = 'ativa' then 'ativa'
        when c.founder_trial_ends_at > now() then 'trialing'
        else 'pendente'
      end,
      founder_billing_setup_at = coalesce(c.founder_billing_setup_at, now()),
      founder_billing_authorized_at = case
        when v_status = 'authorized' then coalesce(c.founder_billing_authorized_at, now())
        else c.founder_billing_authorized_at end,
      founder_billing_last_sync_at = now(), founder_billing_claim_id = null,
      founder_billing_claimed_at = null, founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_billing_setup',null,v_status,'mercado_pago',
    p_subscription_id,p_subscription_id,
    jsonb_build_object('plan_payment_id',p_plan_payment_id,'founder_number',v_company.founder_number,
      'founder_price_cents',v_company.founder_price_cents,'trial_ends_at',v_company.founder_trial_ends_at),
    'processed',now()
  ) on conflict do nothing;

  return v_company;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_founder_price_conversion(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_normal integer;
  v_amount numeric;
  v_action text := lower(btrim(coalesce(p_action,'updated')));
begin
  select c.* into v_company from public.companies c
  where c.id=p_company_id and c.is_founder=true
    and c.founder_price_conversion_claim_id=p_claim_id
    and c.founder_price_converted_at is null for update;
  if not found then raise exception 'FOUNDER_PRICE_CONVERSION_CLAIM_NOT_FOUND'; end if;
  if v_company.founder_price_ends_at > now() then raise exception 'FOUNDER_PRICE_CONVERSION_TOO_EARLY'; end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano,v_company.plano,''))
    when 'basico' then 4990 when 'básico' then 4990 when 'essencial' then 4990
    when 'profissional' then 9990 when 'intermediario' then 9990 when 'intermediário' then 9990
    when 'premium' then 14990 else null end;
  if v_normal is null then raise exception 'FOUNDER_PRICE_CONVERSION_INVALID_PLAN'; end if;

  if v_action not in ('inactive','cancelled') then
    begin
      v_amount := nullif(p_provider_payload #>> '{auto_recurring,transaction_amount}','')::numeric;
    exception when others then v_amount := null; end;
    if v_amount is null or round(v_amount*100)::integer <> v_normal then
      raise exception 'FOUNDER_STANDARD_PRICE_PROVIDER_MISMATCH';
    end if;
  end if;

  update public.companies c
  set founder_price_converted_at=now(),founder_price_conversion_claim_id=null,
      founder_price_conversion_claimed_at=null,founder_price_conversion_last_error=null,
      founder_billing_last_sync_at=now(),
      mercado_pago_subscription_status=coalesce(nullif(btrim(coalesce(p_provider_status,'')),''),c.mercado_pago_subscription_status),
      assinatura_mp_payload=coalesce(p_provider_payload,c.assinatura_mp_payload),updated_at=now()
  where c.id=p_company_id returning c.* into v_company;

  update public.plan_payments pp
  set valor=v_normal/100.0,raw_subscription=coalesce(p_provider_payload,pp.raw_subscription),
      status=case when v_action in ('inactive','cancelled') then pp.status
                  else 'subscription_'||lower(coalesce(p_provider_status,'authorized')) end,
      updated_at=now()
  where pp.company_id=p_company_id and pp.idempotency_key='founder-recurring-v1';

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_converted_to_standard_price',v_company.founder_price_cents::text,
    v_normal::text,'mercado_pago',coalesce(v_company.provider_subscription_id,v_company.mercado_pago_subscription_id),
    coalesce(v_company.provider_subscription_id,v_company.mercado_pago_subscription_id),
    jsonb_build_object('action',v_action,'plan_key',coalesce(v_company.assinatura_plano,v_company.plano),
      'founder_price_cents',v_company.founder_price_cents,'normal_price_cents',v_normal,
      'founder_price_ends_at',v_company.founder_price_ends_at,'provider_status',p_provider_status),
    'processed',now()
  ) on conflict do nothing;
  return v_company;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_platform_admin_invite(p_claim_id uuid, p_user_id uuid)
 RETURNS SETOF platform_admins
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_invite public.platform_admin_invites%rowtype;
  v_admin public.platform_admins%rowtype;
begin
  if p_claim_id is null or p_user_id is null then raise exception 'invalid_activation_input'; end if;
  select * into v_invite from public.platform_admin_invites
  where status = 'activating' and activation_claim_id = p_claim_id and expires_at > now() for update;
  if not found then raise exception 'invite_not_claimed'; end if;
  if lower(v_invite.role) <> 'prospector' then raise exception 'invalid_invite_role'; end if;
  if exists (select 1 from public.platform_admins p where lower(p.email) = v_invite.email_normalized) then raise exception 'platform_admin_email_exists'; end if;
  insert into public.platform_admins (user_id,email,nome,role,is_active,permissions,area,observacoes,created_by,must_change_password,updated_at)
  values (p_user_id,v_invite.email_normalized,btrim(v_invite.nome),'prospector',true,v_invite.permissions,coalesce(nullif(btrim(v_invite.area), ''), 'Comercial'),v_invite.observacoes,v_invite.created_by_email,false,now())
  returning * into v_admin;
  update public.platform_admin_invites
  set status = 'activated', activated_at = now(), claimed_at = null, activation_claim_id = null, user_id = p_user_id, platform_admin_id = v_admin.id
  where id = v_invite.id and status = 'activating' and activation_claim_id = p_claim_id;
  if not found then raise exception 'invite_activation_race'; end if;
  return next v_admin;
  return;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_marketplace_coupon(p_company_id uuid, p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_coupon_id uuid;
begin
  update public.orders
  set coupon_consumed_at = now(),
      updated_at = now()
  where id = p_order_id
    and company_id = p_company_id
    and coupon_id is not null
    and coupon_consumed_at is null
  returning coupon_id into v_coupon_id;

  if v_coupon_id is null then
    return false;
  end if;

  update public.marketplace_coupons
  set used_count = coalesce(used_count, 0) + 1,
      updated_at = now()
  where id = v_coupon_id
    and company_id = p_company_id;

  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_affiliate_payout_admin(p_affiliate_id uuid)
 RETURNS TABLE(payout_id uuid, payout_amount numeric, gross_amount numeric, debt_applied numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  profile_row public.affiliate_profiles%rowtype;
  account_row orcaly_private.affiliate_payout_accounts%rowtype;
  settings_row public.affiliate_program_settings%rowtype;
  gross numeric(14,2);
  debt numeric(14,2);
  offset_value numeric(14,2);
  net_value numeric(14,2);
  new_payout_id uuid;
begin
  perform public.release_affiliate_commissions_admin();

  select * into profile_row
  from public.affiliate_profiles
  where id = p_affiliate_id
  for update;

  if not found or profile_row.status <> 'active' then
    raise exception 'Indicador inativo ou não encontrado.';
  end if;

  select * into account_row
  from orcaly_private.affiliate_payout_accounts
  where affiliate_id = p_affiliate_id
  for update;

  if not found or not account_row.is_verified then
    raise exception 'Conta Pix ainda não verificada.';
  end if;

  select * into settings_row
  from public.affiliate_program_settings
  where id = 1;

  if not settings_row.payouts_enabled then
    raise exception 'Pagamentos de comissão estão temporariamente desativados.';
  end if;

  if exists (
    select 1 from public.affiliate_payouts
    where affiliate_id = p_affiliate_id
      and status in ('requested','approved','processing')
  ) then
    raise exception 'Já existe um pagamento em andamento.';
  end if;

  select coalesce(sum(locked.commission_amount), 0)
  into gross
  from (
    select c.id, c.commission_amount
    from public.affiliate_commissions c
    where c.affiliate_id = p_affiliate_id
      and c.status = 'available'
    order by c.created_at, c.id
    for update
  ) locked;

  debt := coalesce(profile_row.debt_balance, 0);
  offset_value := least(gross, debt);
  net_value := round(gross - offset_value, 2);

  if net_value < settings_row.minimum_payout_amount then
    raise exception 'Saldo disponível abaixo do mínimo de pagamento.';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id,
    gross_commissions,
    debt_offset,
    amount,
    status,
    provider,
    external_reference,
    pix_key_type,
    pix_key_masked,
    holder_name
  ) values (
    p_affiliate_id,
    gross,
    offset_value,
    net_value,
    'requested',
    'manual',
    'affiliate_payout:' || gen_random_uuid()::text,
    account_row.pix_key_type,
    account_row.pix_key_masked,
    account_row.holder_name
  ) returning id into new_payout_id;

  insert into public.affiliate_payout_items (payout_id, commission_id, amount)
  select new_payout_id, id, commission_amount
  from public.affiliate_commissions
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_commissions
  set status = 'processing',
      payout_id = new_payout_id,
      updated_at = now()
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_profiles
  set debt_balance = greatest(0, debt - offset_value),
      updated_at = now()
  where id = p_affiliate_id;

  return query select new_payout_id, net_value, gross, offset_value;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_founder_invite_for_sales_lead(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer DEFAULT NULL::integer)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_lead public.signup_leads%rowtype;
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_number integer;
  v_invite public.founder_invites%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role)
    into v_actor_role
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  select *
    into v_lead
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'FOUNDER_LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_lead.assigned_to_admin_id is distinct from p_actor_admin_id
  then
    raise exception 'FOUNDER_LEAD_NOT_OWNED';
  end if;

  if v_lead.converted_company_id is not null
     or v_lead.sales_stage in ('conta_ativada','cliente','perdido')
  then
    raise exception 'FOUNDER_LEAD_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.status in ('pending','activated')
      and (
        fi.sales_lead_id = p_lead_id
        or fi.email_normalized = lower(btrim(v_lead.email))
      )
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  if p_requested_founder_number is not null then
    if p_requested_founder_number < 1
       or p_requested_founder_number > 10
    then
      raise exception 'INVALID_FOUNDER_NUMBER';
    end if;

    if exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = p_requested_founder_number
        and fi.status in ('pending','activated')
    ) then
      raise exception 'FOUNDER_NUMBER_TAKEN';
    end if;

    v_number := p_requested_founder_number;
  else
    select slot
      into v_number
    from generate_series(1,10) as slot
    where not exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = slot
        and fi.status in ('pending','activated')
    )
    order by slot
    limit 1;

    if v_number is null then
      raise exception 'FOUNDER_SLOTS_EXHAUSTED';
    end if;
  end if;

  insert into public.founder_invites (
    email,
    founder_number,
    plan_key,
    founder_price_cents,
    status,
    token_hash,
    token_expires_at,
    invited_at,
    sales_lead_id,
    created_by_admin_id,
    created_by_email
  )
  values (
    lower(btrim(v_lead.email)),
    v_number,
    v_plan,
    v_price,
    'pending',
    p_token_hash,
    p_token_expires_at,
    now(),
    p_lead_id,
    p_actor_admin_id,
    v_actor_email
  )
  returning * into v_invite;

  update public.signup_leads
  set sales_stage = 'convite_fundador',
      sales_lost_reason = null,
      sales_stage_updated_at = now(),
      updated_at = now()
  where id = p_lead_id;

  insert into public.signup_lead_followups (
    lead_id,
    channel,
    status,
    message,
    scheduled_for,
    sent_at,
    admin_email,
    created_by_admin_id,
    sales_event_type,
    raw_data
  )
  values (
    p_lead_id,
    'system',
    'registrado',
    'Convite Founder #' || lpad(v_number::text,2,'0') || ' criado.',
    now(),
    now(),
    v_actor_email,
    p_actor_admin_id,
    'system',
    jsonb_build_object(
      'source','founder_program',
      'event','invite_created',
      'founder_invite_id',v_invite.id,
      'founder_number',v_number,
      'plan_key',v_plan,
      'founder_price_cents',v_price
    )
  );

  return v_invite;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_founder_test_invite(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_invite public.founder_invites%rowtype;
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'INVALID_FOUNDER_EMAIL';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role)
    into v_actor_role
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role <> 'owner' then
    raise exception 'FOUNDER_TEST_OWNER_ONLY';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  if exists (
    select 1
    from public.founder_invites fi
    where fi.founder_number = 0
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_TEST_SLOT_TAKEN';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.email_normalized = v_email
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  insert into public.founder_invites (
    email,
    founder_number,
    plan_key,
    founder_price_cents,
    status,
    token_hash,
    token_expires_at,
    invited_at,
    sales_lead_id,
    created_by_admin_id,
    created_by_email
  )
  values (
    v_email,
    0,
    v_plan,
    v_price,
    'pending',
    p_token_hash,
    p_token_expires_at,
    now(),
    null,
    p_actor_admin_id,
    v_actor_email
  )
  returning * into v_invite;

  return v_invite;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_or_claim_sales_prospect(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_segmento text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_estado text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_target_id uuid;
  v_target_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lead public.signup_leads%rowtype;
begin
  select lower(role) into v_actor_role from public.platform_admins where id = p_actor_admin_id and is_active = true;
  if v_actor_role not in ('owner','prospector') then raise exception 'SALES_ACTOR_NOT_ALLOWED'; end if;
  if v_email = '' or position('@' in v_email) <= 1 then raise exception 'INVALID_EMAIL'; end if;
  if nullif(btrim(coalesce(p_empresa_nome, '')), '') is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  v_target_id := coalesce(p_assigned_admin_id, p_actor_admin_id);
  select lower(role) into v_target_role from public.platform_admins where id = v_target_id and is_active = true;
  if v_target_role not in ('owner','prospector') then raise exception 'INVALID_ASSIGNEE'; end if;
  if v_actor_role = 'prospector' and v_target_id <> p_actor_admin_id then raise exception 'PROSPECTOR_CANNOT_REASSIGN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select * into v_lead from public.signup_leads where lower(btrim(email)) = v_email order by created_at desc nulls last, id limit 1 for update;
  if found then
    if v_actor_role = 'prospector' and (v_lead.converted_company_id is not null or v_lead.sales_stage = 'cliente') then raise exception 'PROSPECT_ALREADY_CUSTOMER'; end if;
    if v_lead.assigned_to_admin_id is not null and v_lead.assigned_to_admin_id <> v_target_id then raise exception 'PROSPECT_ALREADY_ASSIGNED'; end if;
    update public.signup_leads set assigned_to_admin_id = coalesce(assigned_to_admin_id, v_target_id), created_by_admin_id = coalesce(created_by_admin_id, p_actor_admin_id), nome_responsavel = coalesce(nullif(btrim(p_nome_responsavel), ''), nome_responsavel), empresa_nome = coalesce(nullif(btrim(p_empresa_nome), ''), empresa_nome), whatsapp = coalesce(nullif(btrim(p_whatsapp), ''), whatsapp), segmento = coalesce(nullif(btrim(p_segmento), ''), segmento), cidade = coalesce(nullif(btrim(p_cidade), ''), cidade), estado = coalesce(nullif(btrim(p_estado), ''), estado), sales_stage = case when converted_company_id is not null then 'cliente' else sales_stage end, updated_at = now() where id = v_lead.id;
    return v_lead.id;
  end if;
  insert into public.signup_leads(nome_responsavel,email,whatsapp,empresa_nome,segmento,cidade,estado,status,lead_source,marketing_opt_in,sales_stage,assigned_to_admin_id,created_by_admin_id,sales_stage_updated_at,raw_data)
  values(nullif(btrim(p_nome_responsavel),''),v_email,nullif(btrim(p_whatsapp),''),btrim(p_empresa_nome),nullif(btrim(p_segmento),''),nullif(btrim(p_cidade),''),nullif(btrim(p_estado),''),'lead','prospeccao',false,'novo',v_target_id,p_actor_admin_id,now(),jsonb_build_object('sales_created',true,'sales_created_by_admin_id',p_actor_admin_id)) returning id into v_lead.id;
  return v_lead.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_due_founder_trials()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_company public.companies%rowtype; v_count integer := 0;
begin
  for v_company in
    select c.* from public.companies c
    where c.is_founder = true and c.assinatura_status = 'trialing'
      and c.trial_ends_at is not null and c.trial_ends_at <= now()
    order by c.id for update skip locked
  loop
    update public.companies c
    set assinatura_status='pendente', access_until=c.trial_ends_at,
        assinatura_expira_em=c.trial_ends_at, updated_at=now()
    where c.id=v_company.id;

    insert into public.subscription_events (
      company_id,event_type,old_status,new_status,provider,provider_reference,
      metadata,processing_status,processed_at
    ) values (
      v_company.id,'founder_trial_ended','trialing','pendente','mercado_pago',
      'founder-trial-v1',jsonb_build_object('trial_ends_at',v_company.trial_ends_at),
      'processed',now()
    ) on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_marketplace_stock_reservations(p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.expire_pending_founder_invites()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_count integer:=0;
begin
  update public.founder_invites set status='pending',activation_claim_id=null,activation_claimed_at=null,activation_last_error='STALE_ACTIVATION_CLAIM_RECOVERED',updated_at=now() where status='activating' and activation_claimed_at < now()-interval '10 minutes';
  for v_invite in select * from public.founder_invites where status='pending' and token_expires_at is not null and token_expires_at<=now() order by id for update loop
    update public.founder_invites set status='expired',updated_at=now() where id=v_invite.id;
    if v_invite.sales_lead_id is not null then
      update public.signup_leads set sales_stage=case when sales_stage='convite_fundador' then 'demonstracao' else sales_stage end,sales_stage_updated_at=case when sales_stage='convite_fundador' then now() else sales_stage_updated_at end,updated_at=now() where id=v_invite.sales_lead_id;
      insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data) values(v_invite.sales_lead_id,'system','registrado','Convite Founder #'||lpad(v_invite.founder_number::text,2,'0')||' expirou.',now(),now(),v_invite.created_by_email,v_invite.created_by_admin_id,'system',jsonb_build_object('source','founder_program','event','invite_expired','founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number));
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $function$
;

CREATE OR REPLACE FUNCTION public.fail_affiliate_payout_admin(p_payout_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id
  for update;

  if not found or payout_row.status not in ('requested','approved','processing') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'failed',
      failure_reason = left(coalesce(p_reason, 'Falha no pagamento.'), 500),
      failed_at = now(),
      updated_at = now()
  where id = p_payout_id;

  update public.affiliate_commissions
  set status = 'available',
      payout_id = null,
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset,
        updated_at = now()
    where id = payout_row.affiliate_id;
  end if;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finance_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_affiliate_payout_account_admin(p_affiliate_id uuid)
 RETURNS TABLE(affiliate_id uuid, pix_key_type text, pix_key_encrypted text, pix_key_masked text, holder_name text, holder_document_hash text, holder_document_last4 text, bank_name text, provider_validation jsonb, is_verified boolean, verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_encrypted,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_hash,
    a.holder_document_last4,
    a.bank_name,
    a.provider_validation,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  where a.affiliate_id = p_affiliate_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_platform_admin_access()
 RETURNS TABLE(admin_id uuid, admin_email text, admin_role text, admin_is_active boolean, must_change_password boolean, permissions jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    p.id,
    lower(p.email),
    case
      when lower(p.role) in ('owner', 'super_admin') then 'owner'
      when lower(p.role) in ('support', 'suporte') then 'support'
      when lower(p.role) = 'finance' then 'finance'
      when lower(p.role) = 'prospector' then 'prospector'
      when lower(p.role) = 'admin' then 'admin'
      else null
    end,
    p.is_active,
    p.must_change_password,
    coalesce(p.permissions, '{}'::jsonb)
  from public.platform_admins p
  where p.user_id = auth.uid()
    and p.is_active = true
    and lower(p.role) in ('owner','super_admin','admin','finance','support','suporte','prospector')
  order by
    case
      when lower(p.role) in ('owner', 'super_admin') then 0
      when lower(p.role) = 'admin' then 1
      when lower(p.role) = 'finance' then 2
      when lower(p.role) in ('support','suporte') then 3
      when lower(p.role) = 'prospector' then 4
      else 9
    end,
    p.created_at
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.list_affiliate_payout_accounts_admin()
 RETURNS TABLE(affiliate_id uuid, pix_key_type text, pix_key_masked text, holder_name text, holder_document_last4 text, bank_name text, is_verified boolean, verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_last4,
    a.bank_name,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  order by a.updated_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_affiliate_payout_paid_admin(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  update public.affiliate_payouts
  set status = 'paid',
      provider = case when p_provider in ('manual','asaas') then p_provider else provider end,
      provider_transfer_id = nullif(trim(p_provider_transfer_id), ''),
      proof_url = nullif(trim(p_proof_url), ''),
      paid_at = now(),
      updated_at = now()
  where id = p_payout_id
    and status in ('requested','approved','processing');

  if not found then
    return false;
  end if;

  update public.affiliate_commissions
  set status = 'paid',
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.orcaly_consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 128 then
    raise exception 'invalid rate limit key';
  end if;

  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate limit window';
  end if;

  insert into orcaly_private.api_rate_limits (
    key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_key, v_now, 0, v_now)
  on conflict (key) do nothing;

  select window_started_at, request_count
    into v_window_started, v_count
  from orcaly_private.api_rate_limits
  where key = p_key
  for update;

  if v_window_started + make_interval(secs => p_window_seconds) <= v_now then
    v_window_started := v_now;
    v_count := 1;

    update orcaly_private.api_rate_limits
    set window_started_at = v_window_started,
        request_count = v_count,
        updated_at = v_now
    where key = p_key;

    return query
      select true, greatest(0, p_limit - v_count),
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  if v_count >= p_limit then
    return query
      select false, 0,
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  v_count := v_count + 1;

  update orcaly_private.api_rate_limits
  set request_count = v_count,
      updated_at = v_now
  where key = p_key;

  return query
    select true, greatest(0, p_limit - v_count),
      v_window_started + make_interval(secs => p_window_seconds);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_founder_activation(p_token_hash text)
 RETURNS TABLE(invite_id uuid, email text, founder_number integer, plan_key text, founder_price_cents integer, token_expires_at timestamp with time zone, sales_lead_id uuid, empresa_nome text, nome_responsavel text, whatsapp text, segmento text, modelo_negocio text, cidade text, estado text, slug_sugerido text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.expire_pending_founder_invites();
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query select fi.id,fi.email,fi.founder_number,fi.plan_key,fi.founder_price_cents,fi.token_expires_at,fi.sales_lead_id,sl.empresa_nome,sl.nome_responsavel,sl.whatsapp,sl.segmento,sl.modelo_negocio,sl.cidade,sl.estado,sl.slug_sugerido from public.founder_invites fi left join public.signup_leads sl on sl.id=fi.sales_lead_id where fi.token_hash=p_token_hash and fi.status='pending' and (fi.token_expires_at is null or fi.token_expires_at>now()) limit 1;
end; $function$
;

CREATE OR REPLACE FUNCTION public.protect_company_trial_used_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.trial_used_at is not null and new.trial_used_at is null then
    new.trial_used_at := old.trial_used_at;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_founder_payment_approved(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_access_until timestamptz;
  v_lead_id uuid;
begin
  select c.* into v_company from public.companies c
  where c.id=p_company_id and c.is_founder=true for update;
  if not found then raise exception 'FOUNDER_PAYMENT_COMPANY_NOT_FOUND'; end if;
  if nullif(btrim(coalesce(p_subscription_id,'')),'') is null then
    raise exception 'FOUNDER_PAYMENT_SUBSCRIPTION_REQUIRED';
  end if;

  v_access_until := case
    when p_next_payment_date is not null and p_next_payment_date > now() then p_next_payment_date
    else now() + interval '1 month' end;

  update public.companies c
  set ativo=true, assinatura_status='ativa', assinatura_auto_recorrente=true,
      assinatura_inicio=coalesce(c.assinatura_inicio,now()),
      assinatura_expira_em=v_access_until, access_until=v_access_until,
      assinatura_ultimo_pagamento=now(), assinatura_proxima_cobranca=p_next_payment_date,
      next_billing_at=p_next_payment_date, subscription_provider='mercado_pago',
      provider_subscription_id=p_subscription_id, mercado_pago_subscription_id=p_subscription_id,
      mercado_pago_subscription_status='authorized',
      assinatura_mp_payload=coalesce(p_provider_payload,'{}'::jsonb),
      founder_billing_authorized_at=coalesce(c.founder_billing_authorized_at,now()),
      founder_billing_last_sync_at=now(), updated_at=now()
  where c.id=p_company_id returning c.* into v_company;

  update public.plan_payments pp
  set provider='mercado_pago', provider_subscription_id=p_subscription_id,
      mercado_pago_preapproval_id=p_subscription_id,
      provider_payment_id=nullif(btrim(coalesce(p_payment_id,'')),''),
      mercado_pago_payment_id=nullif(btrim(coalesce(p_payment_id,'')),''),
      paid_at=coalesce(pp.paid_at,now()), next_payment_date=p_next_payment_date,
      raw_subscription=coalesce(p_provider_payload,pp.raw_subscription),
      status='approved', updated_at=now()
  where pp.company_id=p_company_id and pp.idempotency_key='founder-recurring-v1';

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_subscription_started',null,'ativa','mercado_pago',p_subscription_id,
    nullif(btrim(coalesce(p_payment_id,'')),''),
    jsonb_build_object('founder_number',v_company.founder_number,'payment_id',p_payment_id,
      'next_payment_date',p_next_payment_date),'processed',now()
  ) on conflict do nothing;

  update public.signup_leads sl
  set sales_stage='cliente',sales_stage_updated_at=now(),updated_at=now()
  where sl.converted_company_id=p_company_id and sl.sales_stage='conta_ativada'
  returning sl.id into v_lead_id;

  if v_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id,channel,status,message,scheduled_for,sent_at,admin_email,
      created_by_admin_id,sales_event_type,raw_data
    )
    select v_lead_id,'system','registrado',
      'Primeira cobrança do Cliente Founder confirmada; etapa alterada para cliente.',
      now(),now(),fi.created_by_email,fi.created_by_admin_id,'system',
      jsonb_build_object('source','founder_program','event','first_payment_approved','payment_id',p_payment_id)
    from public.founder_invites fi
    where fi.company_id=p_company_id and fi.status='activated'
    order by fi.activated_at desc limit 1;
  end if;

  return v_company;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_signup_lead_sales_followup(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_assigned_to uuid;
  v_channel text := lower(btrim(coalesce(p_channel, '')));
  v_followup_id uuid;
begin
  if v_channel not in ('whatsapp','telefone','email','reuniao','nota') then
    raise exception 'INVALID_CONTACT_CHANNEL';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'SALES_ACTOR_NOT_ALLOWED';
  end if;

  select assigned_to_admin_id
    into v_assigned_to
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_assigned_to is distinct from p_actor_admin_id
  then
    raise exception 'LEAD_NOT_OWNED';
  end if;

  insert into public.signup_lead_followups (
    lead_id, channel, status, message, scheduled_for, sent_at,
    admin_email, created_by_admin_id, sales_event_type, raw_data
  )
  values (
    p_lead_id,
    v_channel,
    'registrado',
    btrim(p_message),
    now(), now(), v_actor_email, p_actor_admin_id,
    case when v_channel = 'nota' then 'note' else 'contact' end,
    jsonb_build_object('source', 'sales_crm', 'next_action_at', p_next_action_at)
  )
  returning id into v_followup_id;

  update public.signup_leads
  set followup_count = followup_count + 1,
      last_followup_at = now(),
      sales_last_contact_at = now(),
      next_followup_at = p_next_action_at,
      sales_next_action_at = p_next_action_at,
      updated_at = now()
  where id = p_lead_id;

  return v_followup_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_affiliate_commissions_admin()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  changed integer;
begin
  update public.affiliate_commissions c
  set status = 'available',
      available_at = coalesce(c.available_at, now()),
      updated_at = now()
  from public.affiliate_profiles p,
       public.affiliate_referrals r
  where p.id = c.affiliate_id
    and r.id = c.referral_id
    and p.status = 'active'
    and r.review_status = 'approved'
    and c.status = 'hold'
    and c.hold_until is not null
    and c.hold_until <= now();

  get diagnostics changed = row_count;
  return changed;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_founder_activation_claim(p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_new_status text;
begin
  select * into v_invite from public.founder_invites where activation_claim_id=p_claim_id and status='activating' for update;
  if not found then return false; end if;
  v_new_status:=case when v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then 'expired' else 'pending' end;
  update public.founder_invites set status=v_new_status,activation_claim_id=null,activation_claimed_at=null,activation_last_error=left(nullif(btrim(coalesce(p_error,'')),''),1000),updated_at=now() where id=v_invite.id;
  if v_new_status='expired' and v_invite.sales_lead_id is not null then update public.signup_leads set sales_stage=case when sales_stage='convite_fundador' then 'demonstracao' else sales_stage end,sales_stage_updated_at=case when sales_stage='convite_fundador' then now() else sales_stage_updated_at end,updated_at=now() where id=v_invite.sales_lead_id; end if;
  return true;
end; $function$
;

CREATE OR REPLACE FUNCTION public.release_founder_billing_claim(p_company_id uuid, p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 1000),
      updated_at = now()
  where c.id = p_company_id and c.founder_billing_claim_id = p_claim_id;
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_founder_price_conversion_claim(p_company_id uuid, p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_price_conversion_claim_id=null,founder_price_conversion_claimed_at=null,
      founder_price_conversion_last_error=left(nullif(btrim(coalesce(p_error,'')),''),1000),updated_at=now()
  where c.id=p_company_id and c.founder_price_conversion_claim_id=p_claim_id;
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.release_platform_admin_invite_claim(p_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_updated integer := 0;
begin
  update public.platform_admin_invites
  set status = case when expires_at <= now() then 'expired' else 'pending' end, claimed_at = null, activation_claim_id = null
  where status = 'activating' and activation_claim_id = p_claim_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_marketplace_stock(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reverse_affiliate_commission_admin(p_provider_payment_id text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  commission_row public.affiliate_commissions%rowtype;
begin
  select * into commission_row
  from public.affiliate_commissions
  where provider_payment_id = p_provider_payment_id
  for update;

  if not found or commission_row.status in ('reversed','rejected') then
    return false;
  end if;

  if commission_row.status = 'paid' then
    update public.affiliate_profiles
    set debt_balance = debt_balance + commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  update public.affiliate_commissions
  set status = 'reversed',
      reversed_at = now(),
      reversal_reason = left(coalesce(p_reason, 'Pagamento estornado.'), 500),
      updated_at = now()
  where id = commission_row.id;

  update public.affiliate_referrals
  set status = 'reversed',
      updated_at = now()
  where id = commission_row.referral_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_affiliate_referral_admin(p_referral_id uuid, p_decision text, p_actor_email text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  referral_row public.affiliate_referrals%rowtype;
  commission_row public.affiliate_commissions%rowtype;
  next_status text;
begin
  if p_decision not in ('approved', 'rejected', 'flagged') then
    raise exception 'Decisão de indicação inválida.';
  end if;

  select *
  into referral_row
  from public.affiliate_referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'Indicação não encontrada.';
  end if;

  select *
  into commission_row
  from public.affiliate_commissions
  where referral_id = p_referral_id
  for update;

  if p_decision = 'approved' then
    next_status := referral_row.status;

    if referral_row.status = 'rejected' then
      if referral_row.first_payment_reference is not null then
        next_status := 'qualified';
      elsif referral_row.trial_ends_at is not null
        and referral_row.trial_ends_at > now() then
        next_status := 'trial';
      else
        next_status := 'payment_pending';
      end if;
    end if;

    update public.affiliate_referrals
    set review_status = 'approved',
        status = next_status,
        reviewed_at = now(),
        reviewed_by = lower(trim(p_actor_email)),
        review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        rejected_at = null,
        rejection_reason = null,
        updated_at = now()
    where id = p_referral_id;

    if commission_row.id is not null
      and commission_row.status = 'hold'
      and commission_row.hold_until is not null
      and commission_row.hold_until <= now() then
      update public.affiliate_commissions
      set status = 'available',
          available_at = coalesce(available_at, now()),
          updated_at = now()
      where id = commission_row.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'decision', 'approved',
      'referral_id', p_referral_id
    );
  end if;

  if p_decision = 'flagged' then
    update public.affiliate_referrals
    set review_status = 'flagged',
        reviewed_at = now(),
        reviewed_by = lower(trim(p_actor_email)),
        review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        updated_at = now()
    where id = p_referral_id;

    return jsonb_build_object(
      'ok', true,
      'decision', 'flagged',
      'referral_id', p_referral_id
    );
  end if;

  if commission_row.id is not null
    and commission_row.status = 'processing' then
    raise exception 'A indicação possui pagamento em processamento.';
  end if;

  if commission_row.id is not null
    and commission_row.status = 'paid' then
    update public.affiliate_profiles
    set debt_balance =
          debt_balance + commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  if commission_row.id is not null
    and commission_row.status not in ('reversed', 'rejected') then
    update public.affiliate_commissions
    set status = 'reversed',
        reversed_at = now(),
        reversal_reason =
          coalesce(
            nullif(left(trim(coalesce(p_note, '')), 500), ''),
            'Indicação recusada pela administração.'
          ),
        updated_at = now()
    where id = commission_row.id;
  end if;

  update public.affiliate_referrals
  set review_status = 'rejected',
      status = 'rejected',
      reviewed_at = now(),
      reviewed_by = lower(trim(p_actor_email)),
      review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      rejected_at = now(),
      rejection_reason =
        coalesce(
          nullif(left(trim(coalesce(p_note, '')), 500), ''),
          'Indicação recusada pela administração.'
        ),
      updated_at = now()
  where id = p_referral_id;

  return jsonb_build_object(
    'ok', true,
    'decision', 'rejected',
    'referral_id', p_referral_id,
    'commission_reversed', commission_row.id is not null
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_founder_invite(p_actor_admin_id uuid, p_invite_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select lower(role)
    into v_actor_role
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    if v_invite.sales_lead_id is null then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_admin_id = p_actor_admin_id,
      revocation_reason = left(v_reason,500),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    update public.signup_leads
    set sales_stage = case
          when sales_stage = 'convite_fundador' then 'demonstracao'
          else sales_stage
        end,
        sales_stage_updated_at = case
          when sales_stage = 'convite_fundador' then now()
          else sales_stage_updated_at
        end,
        updated_at = now()
    where id = v_invite.sales_lead_id;

    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id,
      'system',
      'registrado',
      'Convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' revogado.',
      now(),
      now(),
      v_actor_email,
      p_actor_admin_id,
      'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_revoked',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number,
        'reason',v_reason
      )
    );
  end if;

  return v_invite;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rotate_founder_invite_token(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  select lower(role)
    into v_actor_role
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    if v_invite.sales_lead_id is null then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set token_hash = p_token_hash,
      token_expires_at = p_token_expires_at,
      token_rotated_at = now(),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id,
      'system',
      'registrado',
      'Link do convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' foi renovado.',
      now(),
      now(),
      v_actor_email,
      p_actor_admin_id,
      'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_rotated',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number
      )
    );
  end if;

  return v_invite;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_affiliate_payout_account_admin(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  if p_pix_key_type not in ('CPF','CNPJ','EMAIL','PHONE','EVP') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  if not exists (
    select 1 from public.affiliate_profiles
    where id = p_affiliate_id
      and status in ('pending','active')
  ) then
    raise exception 'Indicador não encontrado ou bloqueado.';
  end if;

  insert into orcaly_private.affiliate_payout_accounts (
    affiliate_id,
    pix_key_type,
    pix_key_encrypted,
    pix_key_masked,
    holder_name,
    holder_document_hash,
    holder_document_last4,
    bank_name,
    provider_validation,
    is_verified,
    verified_at,
    verified_by
  ) values (
    p_affiliate_id,
    p_pix_key_type,
    p_pix_key_encrypted,
    p_pix_key_masked,
    p_holder_name,
    p_holder_document_hash,
    p_holder_document_last4,
    nullif(trim(p_bank_name), ''),
    coalesce(p_provider_validation, '{}'::jsonb),
    p_is_verified,
    case when p_is_verified then now() else null end,
    nullif(trim(p_verified_by), '')
  )
  on conflict (affiliate_id) do update
  set pix_key_type = excluded.pix_key_type,
      pix_key_encrypted = excluded.pix_key_encrypted,
      pix_key_masked = excluded.pix_key_masked,
      holder_name = excluded.holder_name,
      holder_document_hash = excluded.holder_document_hash,
      holder_document_last4 = excluded.holder_document_last4,
      bank_name = excluded.bank_name,
      provider_validation = excluded.provider_validation,
      is_verified = excluded.is_verified,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      updated_at = now();

  update public.affiliate_profiles
  set payout_status = case when p_is_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_affiliate_payout_account_verification_admin(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  update orcaly_private.affiliate_payout_accounts
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = nullif(trim(p_verified_by), ''),
      provider_validation = provider_validation || jsonb_build_object(
        'manual_note', nullif(trim(p_note), ''),
        'manual_verified', p_verified,
        'manual_verified_at', now()
      ),
      updated_at = now()
  where affiliate_id = p_affiliate_id;

  if not found then
    return false;
  end if;

  update public.affiliate_profiles
  set payout_status = case when p_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_company_subdomain_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.subdomain_slug is null or trim(new.subdomain_slug) = '' then
    new.subdomain_slug := regexp_replace(lower(coalesce(new.slug, new.nome)), '[^a-z0-9]', '', 'g');
  else
    new.subdomain_slug := regexp_replace(lower(new.subdomain_slug), '[^a-z0-9]', '', 'g');
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.settle_marketplace_stock(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.touch_signup_lead_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

create or replace function orcaly_private.enforce_company_member_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  active_count integer;
  locked_company uuid;
begin
  for locked_company in
    select distinct company_id
    from (
      values
        (new.company_id),
        (case when tg_op = 'UPDATE' then old.company_id else null::uuid end)
    ) as affected(company_id)
    where company_id is not null
    order by company_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'orcaly.company_members:' || locked_company::text,
        0
      )
    );
  end loop;

  new.email := pg_catalog.lower(pg_catalog.btrim(new.email));
  new.updated_at := pg_catalog.now();

  if new.status = 'ativo' then
    select pg_catalog.count(*)
      into active_count
      from public.company_members as member
     where member.company_id = new.company_id
       and member.status = 'ativo'
       and member.id is distinct from new.id;

    if active_count >= 2 then
      raise exception
        using
          errcode = '23514',
          message = 'Limite de 2 funcionários ativos atingido para esta empresa.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function orcaly_private.enforce_internal_task_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.responsavel_id is not null
     and not exists (
       select 1
         from public.companies as company
        where company.id = new.company_id
          and (
            company.owner_id = new.responsavel_id
            or company.tester_id = new.responsavel_id
            or exists (
              select 1
                from public.company_members as member
               where member.company_id = new.company_id
                 and member.user_id = new.responsavel_id
                 and member.status = 'ativo'
            )
          )
     )
  then
    raise exception using
      errcode = '23514',
      message = 'Responsável não pertence à empresa da tarefa.';
  end if;

  if new.crm_lead_id is not null
     and not exists (
       select 1 from public.crm_leads
        where id = new.crm_lead_id and company_id = new.company_id
     )
  then
    raise exception using
      errcode = '23514',
      message = 'Lead não pertence à empresa da tarefa.';
  end if;

  if new.order_id is not null
     and not exists (
       select 1 from public.orders
        where id = new.order_id and company_id = new.company_id
     )
  then
    raise exception using
      errcode = '23514',
      message = 'Pedido não pertence à empresa da tarefa.';
  end if;

  if new.proposal_id is not null
     and not exists (
       select 1 from public.proposals
        where id = new.proposal_id and company_id = new.company_id
     )
  then
    raise exception using
      errcode = '23514',
      message = 'Proposta não pertence à empresa da tarefa.';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

create trigger trg_company_members_before_write
before insert or update on public.company_members
for each row execute function orcaly_private.enforce_company_member_contract();

create trigger trg_internal_tasks_tenant_integrity
before insert or update on public.internal_tasks
for each row execute function orcaly_private.enforce_internal_task_tenant();

create view public.admin_signup_leads_overview with (security_invoker=true) as
 SELECT id,
    nome_responsavel,
    email,
    whatsapp,
    empresa_nome,
    slug_sugerido,
    segmento,
    modelo_negocio,
    cidade,
    estado,
    plano,
    status,
    marketing_opt_in,
    marketing_opt_in_text,
    lead_source,
    checkout_url,
    mercado_pago_preference_id,
    mercado_pago_payment_id,
    payment_status,
    paid_at,
    followup_count,
    last_followup_at,
    next_followup_at,
    converted_user_id,
    converted_company_id,
    raw_data,
    created_at,
    updated_at,
        CASE
            WHEN (status = ANY (ARRAY['checkout_criado'::text, 'lead'::text])) AND next_followup_at <= now() AND marketing_opt_in = true THEN true
            ELSE false
        END AS followup_due,
        CASE
            WHEN status = ANY (ARRAY['checkout_criado'::text, 'lead'::text]) THEN EXTRACT(day FROM now() - created_at)::integer
            ELSE 0
        END AS dias_sem_converter
   FROM signup_leads l
  ORDER BY created_at DESC;;

create view public.company_members_public with (security_invoker=true) as
 SELECT id,
    company_id,
    user_id,
    cargo,
    status,
    created_at,
    email::character varying AS email,
    nome
   FROM company_members cm;;

create view public.orcaly_company_health with (security_invoker=true) as
 SELECT id AS company_id,
    nome,
    slug,
    assinatura_status,
    site_publico_ativo,
    site_template,
    logo_url,
    whatsapp,
    whatsapp_enabled,
    ( SELECT count(*) AS count
           FROM products p
          WHERE p.company_id = c.id AND COALESCE(p.arquivado, false) = false) AS products_count,
    ( SELECT count(*) AS count
           FROM orders o
          WHERE o.company_id = c.id) AS orders_count,
    ( SELECT count(*) AS count
           FROM crm_leads l
          WHERE l.company_id = c.id AND l.status = 'ativo'::text) AS leads_count,
    ( SELECT count(*) AS count
           FROM internal_tasks t
          WHERE t.company_id = c.id AND t.status <> 'concluida'::text) AS open_tasks_count,
    ( SELECT count(*) AS count
           FROM app_notifications n
          WHERE n.company_id = c.id AND n.status = 'unread'::text) AS unread_notifications_count
   FROM companies c;;

create view public.production_dashboard with (security_invoker=true) as
 SELECT po.id,
    po.company_id,
    po.proposal_id,
    po.order_id,
    po.title,
    po.customer_name,
    po.customer_whatsapp,
    po.total_value,
    po.signal_value,
    po.status,
    po.priority,
    po.due_date,
    po.started_at,
    po.completed_at,
    po.created_at,
    count(ps.id) AS total_steps,
    count(ps.id) FILTER (WHERE ps.status = 'concluido'::text) AS completed_steps
   FROM production_orders po
     LEFT JOIN production_steps ps ON ps.production_order_id = po.id
  GROUP BY po.id;;

create view public.proposals_dashboard with (security_invoker=true) as
 SELECT p.id,
    p.company_id,
    p.order_id,
    p.token,
    p.proposta_numero,
    p.titulo,
    p.cliente_nome,
    p.cliente_whatsapp,
    p.valor_total,
    p.valor_sinal,
    p.status,
    p.sent_at,
    p.viewed_at,
    p.approved_at,
    p.rejected_at,
    p.change_requested_at,
    p.valid_until,
    p.created_at,
    o.produto AS pedido_produto,
    o.status AS pedido_status,
    p.production_order_id,
    p.signature_signed_at
   FROM proposals p
     LEFT JOIN orders o ON o.id = p.order_id;;

create view public.public_company_profiles with (security_invoker=true) as
 SELECT id,
    nome,
    slug,
    logo_url,
    whatsapp,
    cor_principal,
    cidade,
    estado,
    segmento,
    modelo_negocio,
    modelo_nome,
    modelo_perguntas,
    ativo,
    subdomain_slug,
    site_template,
    site_status,
    site_primary_color,
    site_accent_color,
    site_config
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE ativo = true;;

create view public.public_marketplace_companies with (security_invoker=true) as
 SELECT id,
    nome,
    slug,
    subdomain_slug,
    logo_url,
    whatsapp,
    cor_principal,
    modelo_negocio,
    modelo_nome,
    modelo_perguntas,
    atendimento_horario,
    atendimento_observacao,
    instagram,
    aceita_pix,
    cobrar_sinal,
    percentual_sinal,
    site_primary_color,
    site_accent_color,
    ativo
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE COALESCE(ativo, true) = true;;

create view public.public_marketplace_products with (security_invoker=true) as
 SELECT id,
    company_id,
    nome,
    preco,
    ativo,
    descricao,
    categoria,
    tipo,
    unidade,
    imagem_url,
    image_urls,
    destaque,
    precificacao,
    unidade_label,
    permite_largura,
    permite_altura,
    permite_comprimento,
    permite_quantidade,
    valor_minimo,
    configuracoes,
    prazo_medio,
    created_at
   FROM orcaly_private.public_products_data() p(id, company_id, nome, preco, ativo, descricao, categoria, tipo, unidade, imagem_url, image_urls, destaque, precificacao, unidade_label, permite_largura, permite_altura, permite_comprimento, permite_quantidade, valor_minimo, configuracoes, prazo_medio, created_at, variacoes)
  WHERE COALESCE(ativo, true) = true;;

create view public.public_site_companies with (security_invoker=true) as
 SELECT id,
    nome,
    slug,
    subdomain_slug,
    logo_url,
    whatsapp,
    instagram,
    cidade,
    estado,
    segmento,
    modelo_negocio,
    modelo_nome,
    atendimento_horario,
    atendimento_observacao,
    marketplace_endereco,
    marketplace_mapa_url,
    marketplace_ativo,
    marketplace_titulo,
    marketplace_subtitulo,
    marketplace_texto_botao,
    site_publico_ativo,
    site_template,
    site_layout,
    site_art_style,
    site_font_style,
    site_button_style,
    site_hero_alignment,
    site_primary_color,
    site_accent_color,
    site_background_color,
    site_text_color,
    site_card_color,
    site_badge_text,
    site_headline,
    site_subheadline,
    site_cta_text,
    site_secondary_cta_text,
    site_banner_url,
    site_whatsapp_message,
    site_about_title,
    site_about_text,
    site_services_title,
    site_contact_title,
    site_show_store,
    site_show_about,
    site_show_contact,
    site_show_featured,
    site_show_faq,
    site_show_testimonials,
    site_show_gallery,
    site_show_benefits,
    site_features,
    site_faq,
    site_testimonials,
    site_gallery,
    site_benefits,
    site_custom_sections,
    site_seo_title,
    site_seo_description,
    site_keywords,
    site_promo_title,
    site_promo_text,
    site_promo_active,
    site_promo_button_text,
    site_business_hours,
    site_payment_methods,
    site_delivery_options
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE COALESCE(site_publico_ativo, true) = true AND COALESCE(ativo, true) = true;;

create view public.public_site_sections with (security_invoker=true) as
 SELECT s.id,
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
   FROM orcaly_private.public_site_sections_data() s(id, company_id, type, title, subtitle, content, image_url, button_label, button_url, sort_order, active, config, updated_at)
     JOIN orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options) ON c.id = s.company_id
  WHERE s.active = true AND c.ativo = true AND COALESCE(c.site_status, 'publicado'::text) = 'publicado'::text;;

create view public.public_store_products with (security_invoker=true) as
 SELECT p.id,
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
   FROM orcaly_private.public_products_data() p(id, company_id, nome, preco, ativo, descricao, categoria, tipo, unidade, imagem_url, image_urls, destaque, precificacao, unidade_label, permite_largura, permite_altura, permite_comprimento, permite_quantidade, valor_minimo, configuracoes, prazo_medio, created_at, variacoes)
     JOIN orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options) ON c.id = p.company_id
  WHERE p.ativo = true AND c.ativo = true;;

CREATE TRIGGER affiliate_payout_accounts_updated_at BEFORE UPDATE ON orcaly_private.affiliate_payout_accounts FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_commissions_updated_at BEFORE UPDATE ON affiliate_commissions FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_payouts_updated_at BEFORE UPDATE ON affiliate_payouts FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_profiles_updated_at BEFORE UPDATE ON affiliate_profiles FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_program_settings_updated_at BEFORE UPDATE ON affiliate_program_settings FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_referrals_updated_at BEFORE UPDATE ON affiliate_referrals FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER founder_invites_set_updated_at BEFORE UPDATE ON founder_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER platform_admin_invites_set_updated_at BEFORE UPDATE ON platform_admin_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_business_hours_updated_at BEFORE UPDATE ON business_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_order_payments_updated_at BEFORE UPDATE ON order_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_finance_touch_updated_at BEFORE UPDATE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION finance_touch_updated_at();

CREATE TRIGGER trg_marketplace_commission_rules_updated_at BEFORE UPDATE ON marketplace_commission_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_commissions_updated_at BEFORE UPDATE ON marketplace_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payment_settings_updated_at BEFORE UPDATE ON marketplace_payment_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payments_updated_at BEFORE UPDATE ON marketplace_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_platform_admins_updated_at BEFORE UPDATE ON platform_admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_protect_company_trial_used_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION protect_company_trial_used_at();

CREATE TRIGGER trg_set_company_subdomain_slug BEFORE INSERT OR UPDATE OF nome, slug, subdomain_slug ON companies FOR EACH ROW EXECUTE FUNCTION set_company_subdomain_slug();

CREATE TRIGGER trg_sync_signup_lead_sales_stage BEFORE INSERT OR UPDATE ON signup_leads FOR EACH ROW EXECUTE FUNCTION orcaly_private.sync_signup_lead_sales_stage();

CREATE TRIGGER trg_touch_signup_lead_updated_at BEFORE UPDATE ON signup_leads FOR EACH ROW EXECUTE FUNCTION touch_signup_lead_updated_at();

set check_function_bodies = on;
