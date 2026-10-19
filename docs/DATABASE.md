# Banco de dados (Supabase PostgreSQL)

## Migrações

| Arquivo | Conteúdo |
|---|---|
| `0001_schema.sql` | tipos, 25 tabelas, chaves, restrições (`check`), índices (incl. GIN em `dedupe_keys` e trigram em `company_name`) |
| `0002_functions.sql` | `updated_at`, `seed_pipeline_stages`, helpers de RLS, `handle_new_user`, `rate_limit_hit` |
| `0003_rls.sql` | RLS habilitado em **todas** as tabelas + políticas por papel |
| `0004_cnpj.sql` | coluna `leads.cnpj` |

Aplicação: SQL Editor (em ordem) ou `supabase db push`. Para novas mudanças crie `0004_*.sql`, `0005_*.sql`… (nunca edite migrações já aplicadas em produção).

## Modelo

```
organizations ─┬─ organization_members (role) ── profiles ── auth.users
               ├─ organization_invites
               ├─ pipeline_stages (10 padrão)
               ├─ lead_sources
               ├─ leads ─┬─ lead_evidence      (oportunidades: evidência, fonte, data, confiança)
               │         ├─ lead_scores        (histórico de pontuação)
               │         ├─ lead_activities    (histórico/timeline)
               │         ├─ lead_notes
               │         ├─ contact_preferences, consent_records
               │         ├─ tasks
               │         └─ campaign_leads ── campaigns
               ├─ forms ─ form_fields ─ form_submissions (UTM, referrer, ip_hash)
               ├─ suppression_list, dsar_requests
               ├─ integrations, integration_logs
               ├─ import_jobs, audit_logs
               └─ rate_limits (sem políticas: só service_role)
```

Todas as tabelas de negócio têm `organization_id`; chaves estrangeiras com `on delete cascade` garantem a **eliminação completa**
dos dados de um lead (LGPD).

## Controle de acesso (RLS)

| Papel | Leitura | Escrita |
|---|---|---|
| owner / admin | tudo da organização | tudo, inclusive formulários, integrações, equipe, logs |
| member | tudo da organização (exceto logs/DSAR) | leads, notas, tarefas, campanhas, importações, supressão (somente inclusão) |
| viewer | leitura | nada |

Funções `security definer` (`is_org_member`, `org_role`, `can_write`, `is_org_admin`) evitam recursão nas políticas.
`organization_members` não permite criar/alterar `owner` por usuários. `audit_logs` é *append-only* para usuários.

## Provisionamento e convites

O trigger `on_auth_user_created` cria perfil e: (a) vincula o usuário às organizações com convite pendente para o **e-mail** dele; ou
(b) cria uma organização nova (funil + fontes). Não lê `raw_user_meta_data` para escolher organização (poderia ser forjado).
Mantenha “Confirm email” ativado no Supabase Auth.

## Testes do banco

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
```
Valida isolamento entre organizações, bloqueio de escrita cruzada, papel `viewer`, convites, metadados forjados, rate limit e cascatas.

## Estratégia de backup e recuperação

- **Backups diários automáticos** (planos Pro+ do Supabase) com retenção de 7 dias; habilite **PITR** (Point-in-Time Recovery) para
  recuperar a qualquer instante dos últimos dias.
- **Backup lógico adicional** (recomendado semanal e antes de migrações): `pg_dump "$SUPABASE_DB_URL" -Fc -f leadfinder-$(date +%F).dump`
  guardado fora do Supabase (S3/Backblaze, criptografado).
- **Restauração:** crie um projeto novo (ou use PITR), `pg_restore --no-owner -d "$NOVO_DB_URL" arquivo.dump`, reaplique as policies se necessário e
  atualize as variáveis `NEXT_PUBLIC_SUPABASE_*` na Vercel. Teste a restauração periodicamente (ao menos trimestral).
- **Retenção/limpeza:** agende `select public.purge_rate_limits();` diariamente (pg_cron: `select cron.schedule('purge-rate-limits','0 3 * * *','select public.purge_rate_limits()');`).
- **LGPD e backups:** dados eliminados persistem nos backups até o fim da retenção; documente esse prazo na política de privacidade.
