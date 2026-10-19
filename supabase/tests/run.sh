#!/usr/bin/env bash
# Aplica as migrações em um Postgres descartável e executa os testes de RLS.
# Uso: PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=leadfinder_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase_stub.sql
for f in ../migrations/*.sql; do echo "-> $f"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
# Papéis do Supabase recebem acesso às tabelas (no Supabase isso é padrão); o RLS é quem restringe.
psql -v ON_ERROR_STOP=1 -q -d $DB -c "grant select, insert, update, delete on all tables in schema public to authenticated; grant all on all tables in schema public to service_role; grant execute on function public.is_org_member(uuid), public.org_role(uuid), public.can_write(uuid), public.is_org_admin(uuid) to authenticated;"
psql -v ON_ERROR_STOP=1 -q -o /dev/null -d $DB -f rls_test.sql
echo "OK: migrações e testes de RLS passaram."
