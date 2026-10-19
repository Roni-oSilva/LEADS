-- LeadFinder Pro — schema principal
-- Execute em ordem: 0001 (schema), 0002 (funções/triggers), 0003 (RLS).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------- Tipos ----------
create type public.member_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.activity_type as enum (
  'note', 'stage_change', 'call', 'whatsapp_started', 'whatsapp_response',
  'email', 'meeting', 'proposal', 'contact_done', 'opt_out', 'system'
);

-- ---------- Organizações e usuários ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

-- ---------- Funil ----------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  name text not null,
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_suppressed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, position) deferrable initially deferred
);

-- ---------- Fontes e leads ----------
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,            -- google_places | csv_import | form | manual | internal ...
  name text not null,
  kind text not null default 'provider' check (kind in ('provider', 'import', 'form', 'manual', 'integration')),
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 200),
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  website text,
  instagram text,
  socials jsonb not null default '{}'::jsonb,
  segment text,
  category text,
  country text default 'BR',
  state text,
  city text,
  neighborhood text,
  address text,
  rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  reviews_count int check (reviews_count is null or reviews_count >= 0),
  source_id uuid references public.lead_sources (id) on delete set null,
  source_ref text,              -- id externo (ex.: place_id)
  source_url text,
  discovered_at timestamptz not null default now(),
  data_updated_at timestamptz not null default now(),
  owner_id uuid references auth.users (id) on delete set null,
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  score int not null default 0 check (score between 0 and 100),
  score_priority text not null default 'low' check (score_priority in ('high', 'medium', 'low')),
  score_breakdown jsonb not null default '[]'::jsonb,
  score_updated_at timestamptz,
  next_action text,
  follow_up_at timestamptz,
  estimated_value numeric(12, 2) check (estimated_value is null or estimated_value >= 0),
  favorite boolean not null default false,
  lawful_basis text check (lawful_basis in ('legitimate_interest', 'consent', 'contract', 'other')),
  do_not_contact boolean not null default false,
  dedupe_keys text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_org_stage_idx on public.leads (organization_id, stage_id);
create index leads_org_created_idx on public.leads (organization_id, created_at desc);
create index leads_org_segment_idx on public.leads (organization_id, segment);
create index leads_org_city_idx on public.leads (organization_id, state, city);
create index leads_org_score_idx on public.leads (organization_id, score desc);
create index leads_org_owner_idx on public.leads (organization_id, owner_id);
create index leads_follow_up_idx on public.leads (organization_id, follow_up_at) where follow_up_at is not null;
create index leads_dedupe_idx on public.leads using gin (dedupe_keys);
create index leads_company_trgm_idx on public.leads using gin (company_name gin_trgm_ops);

create table public.lead_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  signal_key text not null,
  title text not null,
  evidence text not null,
  source text not null,
  service text,
  confidence public.confidence_level not null default 'low',
  recommended_action text,
  verified boolean not null default false,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (lead_id, signal_key)
);
create index lead_evidence_org_idx on public.lead_evidence (organization_id, checked_at desc);

create table public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  score int not null check (score between 0 and 100),
  priority text not null,
  breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_scores_lead_idx on public.lead_scores (lead_id, created_at desc);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  type public.activity_type not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_org_idx on public.lead_activities (organization_id, type, created_at desc);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);

-- ---------- Campanhas ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  objective text,
  target_segment text,
  source_key text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'finished')),
  starts_at date,
  ends_at date,
  sequence jsonb not null default '[]'::jsonb,   -- [{ day_offset, title }]
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.campaign_leads (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);
create index campaign_leads_lead_idx on public.campaign_leads (lead_id);

-- ---------- Formulários de captura ----------
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  kind text not null default 'quote' check (kind in ('quote', 'demo', 'material', 'newsletter', 'diagnostic', 'webinar', 'contact')),
  title text not null check (char_length(title) between 2 and 160),
  description text,
  service_interest text,
  thank_you_message text not null default 'Obrigado! Recebemos seus dados.',
  thank_you_url text,
  campaign_id uuid references public.campaigns (id) on delete set null,
  campaign_origin text,
  privacy_notice text not null default 'Usaremos seus dados apenas para responder a esta solicitação.',
  collect_comm_preferences boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null,
  type text not null default 'text' check (type in ('text', 'email', 'phone', 'textarea', 'select', 'checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  unique (form_id, name)
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  form_id uuid not null references public.forms (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  utm jsonb not null default '{}'::jsonb,
  referrer text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index form_submissions_form_idx on public.form_submissions (form_id, created_at desc);

-- ---------- Privacidade / LGPD ----------
create table public.contact_preferences (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  allow_whatsapp boolean not null default true,
  allow_email boolean not null default true,
  allow_phone boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'phone', 'all')),
  basis text not null check (basis in ('legitimate_interest', 'consent', 'contract', 'other')),
  granted boolean not null,
  evidence text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index consent_records_lead_idx on public.consent_records (lead_id, created_at desc);

create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('email', 'phone', 'domain')),
  value text not null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, kind, value)
);

create table public.dsar_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  kind text not null check (kind in ('access', 'correction', 'deletion', 'opposition', 'portability', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- Tarefas, integrações, importações, auditoria ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  assignee_id uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  type text not null default 'follow_up' check (type in ('follow_up', 'call', 'whatsapp', 'email', 'meeting', 'proposal', 'other')),
  due_at timestamptz,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_org_due_idx on public.tasks (organization_id, done_at, due_at);
create index tasks_lead_idx on public.tasks (lead_id);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,       -- apenas configuração não secreta
  last_tested_at timestamptz,
  last_status text check (last_status in ('ok', 'error', 'not_configured')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null,
  action text not null,
  status text not null check (status in ('ok', 'error', 'not_configured')),
  message text,
  created_at timestamptz not null default now()
);
create index integration_logs_org_idx on public.integration_logs (organization_id, created_at desc);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  filename text,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  total_rows int not null default 0,
  imported_rows int not null default 0,
  duplicate_rows int not null default 0,
  error_rows int not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  error_report jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

-- Rate limiting persistente (compatível com ambiente serverless)
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
