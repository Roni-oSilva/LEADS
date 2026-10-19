-- CNPJ do lead (preenchido manualmente ou ao completar dados pela consulta pública).
alter table public.leads add column if not exists cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$');
create index if not exists leads_org_cnpj_idx on public.leads (organization_id, cnpj) where cnpj is not null;
