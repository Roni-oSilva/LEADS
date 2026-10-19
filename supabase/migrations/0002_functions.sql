-- Funções auxiliares, triggers e provisionamento de novos usuários.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger organizations_updated before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger leads_updated before update on public.leads for each row execute function public.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger forms_updated before update on public.forms for each row execute function public.set_updated_at();
create trigger integrations_updated before update on public.integrations for each row execute function public.set_updated_at();
create trigger contact_preferences_updated before update on public.contact_preferences for each row execute function public.set_updated_at();

-- Funil padrão de 10 etapas.
create or replace function public.seed_pipeline_stages(org uuid) returns void
language sql as $$
  insert into public.pipeline_stages (organization_id, key, name, position, is_won, is_lost, is_suppressed) values
    (org, 'new',          'Novo lead',          1, false, false, false),
    (org, 'analyzed',     'Analisado',          2, false, false, false),
    (org, 'qualified',    'Qualificado',        3, false, false, false),
    (org, 'first_contact','Primeiro contato',   4, false, false, false),
    (org, 'negotiating',  'Em negociação',      5, false, false, false),
    (org, 'meeting',      'Reunião agendada',   6, false, false, false),
    (org, 'proposal',     'Proposta enviada',   7, false, false, false),
    (org, 'won',          'Cliente conquistado',8, true,  false, false),
    (org, 'lost',         'Perdido',            9, false, true,  false),
    (org, 'do_not_contact','Não contatar',     10, false, false, true)
  on conflict do nothing;
$$;

-- Helpers de RLS (security definer evita recursão nas políticas).
create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(org uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select m.role from public.organization_members m
  where m.organization_id = org and m.user_id = auth.uid();
$$;

create or replace function public.can_write(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role(org) in ('owner', 'admin', 'member'), false);
$$;

create or replace function public.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role(org) in ('owner', 'admin'), false);
$$;

-- Novo usuário: cria perfil e (a) entra na organização do convite ou (b) cria organização própria.
-- IMPORTANTE: não confia em raw_user_meta_data para escolher organização (pode ser forjado no signUp).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
  inv record;
  base_slug text;
  org_name text;
  joined boolean := false;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  for inv in
    select * from public.organization_invites
    where lower(email) = lower(new.email) and accepted_at is null
  loop
    insert into public.organization_members (organization_id, user_id, role)
    values (inv.organization_id, new.id, inv.role)
    on conflict do nothing;
    update public.organization_invites set accepted_at = now() where id = inv.id;
    joined := true;
  end loop;

  if not joined then
    org_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), 'Minha organização');
    base_slug := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
    base_slug := left(coalesce(nullif(base_slug, ''), 'org'), 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    if char_length(base_slug) < 3 then base_slug := 'org-' || base_slug; end if;

    insert into public.organizations (name, slug) values (left(org_name, 120), base_slug) returning id into org_id;
    insert into public.organization_members (organization_id, user_id, role) values (org_id, new.id, 'owner');
    perform public.seed_pipeline_stages(org_id);
    insert into public.lead_sources (organization_id, key, name, kind) values
      (org_id, 'manual', 'Cadastro manual', 'manual'),
      (org_id, 'csv_import', 'Importação CSV', 'import'),
      (org_id, 'form', 'Formulários do site', 'form'),
      (org_id, 'google_places', 'Google Places', 'provider');
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rate limit atômico: retorna true se a chamada é permitida.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  current_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into current_hits;
  return current_hits <= p_max;
end $$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Limpeza periódica (agende via pg_cron ou Supabase Scheduled Functions, ver docs/DATABASE.md).
create or replace function public.purge_rate_limits() returns void
language sql security definer set search_path = public as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
revoke all on function public.purge_rate_limits() from public, anon, authenticated;
