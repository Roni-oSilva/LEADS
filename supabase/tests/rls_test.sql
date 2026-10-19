-- Testes de isolamento multi-organização, papéis e funções críticas.
\set ON_ERROR_STOP on

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- Usuários (o trigger handle_new_user cria perfil + organização + etapas + fontes)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@a.com', '{"full_name":"Ana","organization_name":"Org A"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@b.com', '{"full_name":"Bob","organization_name":"Org B"}');

select pg_temp.assert((select count(*) from public.organizations) = 2, 'trigger cria uma organização por usuário');
select pg_temp.assert((select count(*) from public.pipeline_stages) = 20, 'funil de 10 etapas por organização');
select pg_temp.assert((select count(*) from public.organization_members where role = 'owner') = 2, 'usuário é owner da própria organização');

-- Dados de cada organização (como service_role/superuser)
do $$
declare a uuid; b uuid; sa uuid; sb uuid;
begin
  select organization_id into a from public.organization_members where user_id = '11111111-1111-1111-1111-111111111111';
  select organization_id into b from public.organization_members where user_id = '22222222-2222-2222-2222-222222222222';
  select id into sa from public.pipeline_stages where organization_id = a and key = 'new';
  select id into sb from public.pipeline_stages where organization_id = b and key = 'new';
  insert into public.leads (organization_id, company_name, stage_id, dedupe_keys) values (a, 'Lead da A', sa, '{tel:19999998888}'), (b, 'Lead da B', sb, '{tel:11999998888}');
end $$;

-- ===== Ana (org A) =====
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select pg_temp.assert((select count(*) from public.leads) = 1, 'Ana vê somente o lead da própria organização');
select pg_temp.assert((select company_name from public.leads) = 'Lead da A', 'Ana vê o lead correto');
select pg_temp.assert((select count(*) from public.organizations) = 1, 'Ana vê só a própria organização');
select pg_temp.assert((select count(*) from public.pipeline_stages) = 10, 'Ana vê só as etapas da própria organização');

-- Ana não consegue inserir dados na org B
do $$
declare b uuid;
begin
  reset role; select id into b from public.organizations where name = 'Org B'; set role authenticated;
  begin
    insert into public.leads (organization_id, company_name) values (b, 'Invasor');
    raise exception 'FALHOU: Ana inseriu lead na org B';
  exception when insufficient_privilege then null; -- RLS bloqueou (42501)
  end;
end $$;

-- Ana não consegue alterar nem apagar o lead da B (0 linhas afetadas)
do $$
declare n int;
begin
  update public.leads set company_name = 'hack' where company_name = 'Lead da B';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Ana alterou lead da org B'; end if;
  delete from public.leads where company_name = 'Lead da B';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Ana apagou lead da org B'; end if;
end $$;

-- Ana (owner) pode inserir lead na própria org e a auditoria só aceita o próprio user_id
insert into public.leads (organization_id, company_name) select organization_id, 'Novo da A' from public.organization_members where user_id = auth.uid();
select pg_temp.assert((select count(*) from public.leads) = 2, 'Ana insere na própria organização');
do $$
begin
  begin
    insert into public.audit_logs (organization_id, user_id, action) select organization_id, '22222222-2222-2222-2222-222222222222', 'forjado' from public.organization_members where user_id = auth.uid();
    raise exception 'FALHOU: auditoria com user_id de outra pessoa';
  exception when insufficient_privilege then null;
  end;
end $$;

-- rate_limits e a função de rate limit não são acessíveis ao usuário final
do $$
begin
  begin perform public.rate_limit_hit('x', 60, 5); raise exception 'FALHOU: authenticated executou rate_limit_hit';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.rate_limits) <> 0 then raise exception 'FALHOU: usuário leu rate_limits'; end if;
end $$;

-- ===== Convite + papel viewer =====
reset role;
do $$
declare a uuid;
begin
  select organization_id into a from public.organization_members where user_id = '11111111-1111-1111-1111-111111111111';
  insert into public.organization_invites (organization_id, email, role) values (a, 'Carla@A.com', 'viewer');
end $$;
insert into auth.users (id, email, raw_user_meta_data) values ('33333333-3333-3333-3333-333333333333', 'carla@a.com', '{"organization_name":"Tentativa de criar org"}');
select pg_temp.assert((select count(*) from public.organizations) = 2, 'convidado entra na org do convite e não cria nova');
select pg_temp.assert((select role from public.organization_members where user_id = '33333333-3333-3333-3333-333333333333') = 'viewer', 'convidado recebe o papel do convite');

-- metadados forjados não escolhem organização
insert into auth.users (id, email, raw_user_meta_data) values ('44444444-4444-4444-4444-444444444444', 'eve@x.com', jsonb_build_object('invited_org_id', (select id from public.organizations where name = 'Org A')));
select pg_temp.assert((select count(*) from public.organization_members where user_id = '44444444-4444-4444-4444-444444444444' and organization_id = (select id from public.organizations where name = 'Org A')) = 0, 'raw_user_meta_data não concede acesso a organizações');

-- viewer lê mas não escreve
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pg_temp.assert((select count(*) from public.leads) = 2, 'viewer lê leads da organização');
do $$
begin
  begin
    insert into public.leads (organization_id, company_name) select organization_id, 'Viewer não pode' from public.organization_members where user_id = auth.uid();
    raise exception 'FALHOU: viewer inseriu lead';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.forms (organization_id, slug, title) select organization_id, 'meu-form', 'Form' from public.organization_members where user_id = auth.uid();
    raise exception 'FALHOU: viewer criou formulário';
  exception when insufficient_privilege then null; end;
end $$;

-- ===== Rate limit (service_role) =====
reset role;
set role service_role;
select pg_temp.assert(public.rate_limit_hit('k', 60, 2), 'rate limit: 1ª chamada permitida');
select pg_temp.assert(public.rate_limit_hit('k', 60, 2), 'rate limit: 2ª chamada permitida');
select pg_temp.assert(not public.rate_limit_hit('k', 60, 2), 'rate limit: 3ª chamada bloqueada');
reset role;

-- ===== Integridade =====
do $$
begin
  begin insert into public.leads (organization_id, company_name, score) select id, 'x', 101 from public.organizations limit 1; raise exception 'FALHOU: score fora de 0-100';
  exception when check_violation then null; end;
  begin insert into public.leads (organization_id, company_name, rating) select id, 'x', 5.5 from public.organizations limit 1; raise exception 'FALHOU: rating fora de 0-5';
  exception when numeric_value_out_of_range then null; when check_violation then null; end;
end $$;

-- Excluir lead remove dados dependentes em cascata (LGPD: eliminação)
do $$
declare l uuid; o uuid;
begin
  select id, organization_id into l, o from public.leads where company_name = 'Lead da A';
  insert into public.lead_notes (organization_id, lead_id, body) values (o, l, 'nota');
  insert into public.lead_activities (organization_id, lead_id, type, summary) values (o, l, 'note', 'x');
  delete from public.leads where id = l;
  if exists (select 1 from public.lead_notes where lead_id = l) or exists (select 1 from public.lead_activities where lead_id = l) then
    raise exception 'FALHOU: exclusão em cascata';
  end if;
end $$;

\echo 'rls_test.sql: todos os testes passaram'
