-- Row Level Security: cada usuário só acessa dados das organizações das quais é membro.

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.lead_evidence enable row level security;
alter table public.lead_scores enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_notes enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.forms enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_submissions enable row level security;
alter table public.contact_preferences enable row level security;
alter table public.consent_records enable row level security;
alter table public.suppression_list enable row level security;
alter table public.dsar_requests enable row level security;
alter table public.tasks enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_logs enable row level security;
alter table public.import_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;   -- sem políticas: somente service_role

-- organizations
create policy org_select on public.organizations for select using (public.is_org_member(id));
create policy org_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- profiles: o próprio usuário e colegas de organização
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.organization_members a
    join public.organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- organization_members
create policy members_select on public.organization_members for select using (public.is_org_member(organization_id));
create policy members_insert on public.organization_members for insert with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy members_update on public.organization_members for update
  using (public.is_org_admin(organization_id) and role <> 'owner')
  with check (public.is_org_admin(organization_id) and role <> 'owner');
create policy members_delete on public.organization_members for delete using (
  public.is_org_admin(organization_id) and role <> 'owner'
);

create policy invites_all on public.organization_invites for all
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id) and role <> 'owner');

-- Tabelas de dados da organização: leitura por membros, escrita por quem pode escrever.
do $$
declare t text;
begin
  foreach t in array array[
    'lead_sources','leads','lead_evidence','lead_scores','lead_activities','lead_notes',
    'campaign_leads','contact_preferences','consent_records','tasks','import_jobs'
  ] loop
    execute format('create policy %I_select on public.%I for select using (public.is_org_member(organization_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.can_write(organization_id))', t, t);
    execute format('create policy %I_update on public.%I for update using (public.can_write(organization_id)) with check (public.can_write(organization_id))', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.can_write(organization_id))', t, t);
  end loop;
end $$;

-- Tabelas de configuração: somente administradores escrevem.
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_stages','campaigns','forms','form_fields','integrations'
  ] loop
    execute format('create policy %I_select on public.%I for select using (public.is_org_member(organization_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_org_admin(organization_id))', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.is_org_admin(organization_id))', t, t);
  end loop;
end $$;

-- Campanhas também podem ser geridas por membros com permissão de escrita.
drop policy campaigns_insert on public.campaigns;
drop policy campaigns_update on public.campaigns;
create policy campaigns_insert on public.campaigns for insert with check (public.can_write(organization_id));
create policy campaigns_update on public.campaigns for update using (public.can_write(organization_id)) with check (public.can_write(organization_id));

-- Lista de supressão (opt-out): qualquer membro com escrita registra; remover exige administrador.
create policy suppression_list_select on public.suppression_list for select using (public.is_org_member(organization_id));
create policy suppression_list_insert on public.suppression_list for insert with check (public.can_write(organization_id));
create policy suppression_list_update on public.suppression_list for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy suppression_list_delete on public.suppression_list for delete using (public.is_org_admin(organization_id));

-- Submissões de formulários e DSAR: inseridas via service_role (rotas públicas); leitura por membros.
create policy form_submissions_select on public.form_submissions for select using (public.is_org_member(organization_id));
create policy form_submissions_delete on public.form_submissions for delete using (public.is_org_admin(organization_id));
create policy dsar_select on public.dsar_requests for select using (public.is_org_admin(organization_id));
create policy dsar_update on public.dsar_requests for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

-- Logs: leitura por administradores; escrita pelo servidor (membros podem registrar auditoria da própria ação).
create policy integration_logs_select on public.integration_logs for select using (public.is_org_admin(organization_id));
create policy integration_logs_insert on public.integration_logs for insert with check (public.is_org_admin(organization_id));
create policy audit_select on public.audit_logs for select using (public.is_org_admin(organization_id));
create policy audit_insert on public.audit_logs for insert with check (
  public.is_org_member(organization_id) and user_id = auth.uid()
);
-- audit_logs e lead_scores são append-only para usuários: sem políticas de update/delete em audit_logs.
