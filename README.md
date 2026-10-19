# LeadFinder Pro

Plataforma web para **encontrar, qualificar e gerenciar leads** com dados reais, CRM integrado, funil Kanban,
campanhas, formulários de captura e prospecção responsável (LGPD).

> **Princípio do projeto:** nada é simulado. Sem a integração configurada, o recurso fica indisponível e informa
> exatamente o que falta. Não há leads, métricas ou resultados de pesquisa fictícios.

- **Front/Back:** Next.js 16 (App Router, Server Actions, Route Handlers) + TypeScript
- **UI:** Tailwind CSS v4, componentes no estilo shadcn/ui, Lucide, Recharts
- **Dados e Auth:** Supabase (PostgreSQL + Row Level Security + Supabase Auth)
- **Formulários/validação:** React Hook Form + Zod (cliente **e** servidor)
- **Deploy:** Vercel

Documentação complementar: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md)

---

## Instalação (desenvolvimento)

Pré-requisitos: Node.js 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local     # preencha as variáveis (veja abaixo)
```

### 1. Banco de dados (Supabase)

Aplique as migrações **em ordem** — pelo SQL Editor do Supabase ou pela CLI:

```bash
# SQL Editor: cole e execute, nesta ordem
supabase/migrations/0001_schema.sql      # tabelas, tipos, índices, restrições
supabase/migrations/0002_functions.sql   # triggers, funções, provisionamento de usuário, rate limit
supabase/migrations/0003_rls.sql         # políticas Row Level Security

# ou, com a CLI do Supabase
supabase link --project-ref SEU_REF && supabase db push
```

Em **Authentication → Providers → Email**, mantenha **“Confirm email” ativado** (necessário para a segurança dos convites)
e adicione `NEXT_PUBLIC_APP_URL/auth/callback` em **Authentication → URL Configuration → Redirect URLs**.

### 2. Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | sim* | **somente servidor** — formulários públicos, rate limit, solicitações de titulares |
| `NEXT_PUBLIC_APP_URL` | sim | URL pública (links de e-mail e código de embed) |
| `IP_HASH_SALT` | recomendada | sal para hash de IP nos envios de formulário |
| `GOOGLE_PLACES_API_KEY` | não | habilita a pesquisa de empresas (Places API New) |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | não | WhatsApp Business Platform (envio automatizado oficial) |

\* Sem a chave de serviço o app funciona, mas formulários públicos, DSAR público e rate limiting ficam indisponíveis.

As chaves secretas **nunca** chegam ao navegador: só variáveis `NEXT_PUBLIC_*` são expostas, e a tela *Integrações*
mostra apenas “configurada / não configurada”.

### 3. Rodar

```bash
npm run dev      # http://localhost:3000
```

Crie sua conta em `/signup`: o trigger do banco cria a sua organização, o funil de 10 etapas e as fontes padrão.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build / produção |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | testes unitários (Vitest) das regras de negócio |
| `supabase/tests/run.sh` | aplica as migrações em um Postgres descartável e executa os **testes de RLS** (ver abaixo) |

### Testes

- **`npm test`** — 30 testes: pontuação explicável, deduplicação, links `wa.me`, CSV (mapeamento, validação, injeção de fórmulas),
  agregações do dashboard, SSRF, analisador de oportunidades, validação de formulários e mapeamento do Google Places.
- **`supabase/tests/run.sh`** — exige um Postgres 14+ acessível (`PGHOST`, `PGPORT`, `PGUSER`). Cria um banco temporário, simula o
  schema `auth` do Supabase, aplica as migrações e valida: isolamento entre organizações, papéis (owner/viewer), convites,
  metadados forjados, rate limit atômico, constraints e exclusão em cascata (LGPD).

---

## Fluxo principal

1. **Encontrar Leads** → escolha fonte, segmento e localização → pesquisa em fonte *configurada* (ou na sua própria base).
2. Veja a pontuação estimada e as oportunidades → **Salvar** (duplicidades são evitadas por telefone, domínio, e-mail e nome+cidade).
3. **Meu CRM** / **Funil** → acompanhe a qualificação, mova entre etapas (Kanban ou tabela), registre observações.
4. **WhatsApp** → mensagem personalizável via link oficial `wa.me`; o sistema registra que *você iniciou* a conversa.
   Nunca afirma envio/entrega sem confirmação técnica.
5. **Tarefas e Retornos**, **Campanhas** (sequências geram tarefas — não mensagens em massa) e **Formulários** (captura com UTM e consentimento).
6. **Dashboard** e **Relatórios** calculados a partir dos registros reais.

## Módulos e arquivos principais

```
src/
  app/
    (auth)/            login, cadastro, recuperação e redefinição de senha
    (app)/             área autenticada: dashboard, encontrar-leads, oportunidades, crm, funil, campanhas,
                       formularios, tarefas, importar-exportar, relatorios, integracoes, configuracoes
    f/[slug], embed/   formulário público e versão incorporável (iframe) + embed.js
    api/               forms/[slug]/submit, dsar, dsar/export, leads/export
    privacidade/       política de privacidade e formulário de direitos do titular
  lib/
    providers/         adaptadores de fontes de dados (google-places + registry) — plugáveis
    scoring/           lead scoring 0–100 explicável e configurável
    opportunities/     analisador de oportunidades + verificação de site (anti-SSRF)
    leads/ campaigns/ forms/ import/ tasks/ settings/ integrations/ whatsapp/   regras e Server Actions
    dashboard/         agregações (puras e testadas)
    security/          rate limit persistente, proteção SSRF
    supabase/          clientes (browser, server com RLS, admin/service_role)
  proxy.ts             proteção de rotas e refresh de sessão (Next 16)
supabase/
  migrations/          SQL versionado (schema, funções/triggers, RLS)
  tests/               stub do Supabase + testes de RLS
```

## Fontes de dados e integrações

| Integração | Credencial | Observações |
|---|---|---|
| **Google Places API (New)** | `GOOGLE_PLACES_API_KEY` | Text Search. Respeite os Termos da Google Maps Platform (restrições de armazenamento/uso do conteúdo); o app exibe esse aviso na pesquisa. Os resultados só são gravados quando o usuário salva. |
| **Importação CSV** | — | Mapeamento, validação, prévia, deduplicação, relatório de erros e confirmação de base legítima. |
| **Formulários próprios** | `SUPABASE_SERVICE_ROLE_KEY` | Link público e `<script src=".../embed.js" data-leadfinder-form="slug">`. |
| **WhatsApp** | nenhuma (links `wa.me`) | A WhatsApp Business Platform é opcional (teste de conexão disponível); envio automatizado exige modelos aprovados e consentimento. |
| **Outras APIs empresariais / CRMs** | a definir | Implemente `LeadProvider` (`src/lib/providers/types.ts`) e registre em `registry.ts`. |

### Adicionando uma nova fonte

```ts
// src/lib/providers/minha-fonte.ts
export const minhaFonte: LeadProvider = {
  key: "minha_fonte", name: "Minha Fonte", description: "…",
  status: () => (process.env.MINHA_API_KEY ? { configured: true } : { configured: false, missing: ["MINHA_API_KEY"], instructions: "…" }),
  async search(params) { /* chame a API autorizada e retorne ProviderLead[] */ },
  async test() { /* verificação leve */ },
};
// src/lib/providers/registry.ts → PROVIDERS = [googlePlaces, minhaFonte]
```

A tela de pesquisa, o teste de conexão e os avisos de configuração passam a incluir a fonte automaticamente.

## Segurança e LGPD (resumo)

- **RLS em todas as tabelas**; cada consulta do usuário passa pelas políticas. `service_role` é usado só em rotas públicas
  controladas (formulários/DSAR), sempre filtrando por organização.
- **Papéis:** owner · admin · member · viewer (somente leitura). Configuração (formulários, integrações, equipe) é de admin.
- **Convites** vinculados ao e-mail (tabela `organization_invites`); `raw_user_meta_data` **não** concede acesso a organizações.
- **Formulários públicos:** validação Zod no servidor, honeypot, janela mínima de preenchimento, verificação de origem, limite de
  tamanho, rate limit persistente por IP+formulário, confirmação obrigatória do aviso de privacidade e registro de consentimento.
- **Verificação de site:** 1 requisição pública à página inicial, com proteção SSRF (DNS validado a cada redirecionamento).
- **Não contatar:** etapa do funil, flag no lead, lista de supressão (por telefone/e-mail) e preferências por canal bloqueiam
  WhatsApp/ligação/e-mail e a geração de tarefas de campanha.
- **Direitos do titular:** formulário público de solicitação, painel de pedidos, exportação (JSON) e eliminação definitiva com
  inclusão na lista de supressão. Todas as operações administrativas vão para `audit_logs`.
- Exportações escapam fórmulas de planilha (`=`, `+`, `-`, `@`).
- Cabeçalhos de segurança (HSTS, `X-Frame-Options`, etc.); apenas o formulário de embed pode ser incorporado.

> O texto de `/privacidade` é um **modelo**: a organização controladora deve revisá-lo com seu jurídico (razão social, CNPJ, DPO).

## Funcionalidades

**Concluídas**: autenticação (login, cadastro, recuperação, logout, proteção de rotas), perfil, equipe e permissões, dashboard com
filtros e 7 tipos de gráfico, CRUD de leads, CRM com histórico/observações/retornos/consentimento, funil Kanban + tabela,
pesquisa por provedor (Google Places) e na própria base, deduplicação, analisador de oportunidades (com verificação de site),
pontuação explicável configurável, WhatsApp (`wa.me` + registro), importação/exportação CSV, formulários com embed/UTM/consentimento,
campanhas com sequência→tarefas, tarefas e retornos, relatórios, integrações com teste de conexão e logs, LGPD (DSAR, supressão,
auditoria), RLS, rate limiting, testes e documentação.

**Pendentes / fora do escopo desta versão**
- Envio automatizado pela WhatsApp Business Platform (a conexão pode ser testada; modelos, webhook de status e opt-in dependem da sua conta Meta).
- Notificações por e-mail (as preferências são salvas; falta um provedor transacional).
- Cobrança/assinaturas (a coluna `plan` e as telas de plano existem; falta integrar o gateway de pagamento).
- Outros provedores de dados empresariais e conectores de CRM (a arquitetura de adaptadores está pronta).
- Teste automatizado de interface (E2E) versionado no repositório — a verificação ponta a ponta local foi feita (ver `docs/DEPLOY.md`).
