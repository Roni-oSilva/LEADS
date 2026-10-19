# Publicação na Vercel

## 1. Supabase

1. Crie um projeto em <https://supabase.com> (região próxima dos usuários, ex.: São Paulo).
2. Rode as migrações de `supabase/migrations` **em ordem** (SQL Editor ou `supabase db push`).
3. **Authentication → Providers → Email:** mantenha “Confirm email” ativo.
4. **Authentication → URL Configuration:** *Site URL* = URL de produção; *Redirect URLs* = `https://SEU-DOMINIO/auth/callback`.
5. **Settings → API:** copie *Project URL*, *anon key* e *service_role key*.
6. (Recomendado) habilite PITR/backups e agende a limpeza de `rate_limits` (ver `docs/DATABASE.md`).

## 2. Vercel

1. Importe o repositório em <https://vercel.com/new> (framework: Next.js — detectado automaticamente).
2. Em **Settings → Environment Variables** cadastre (Production e Preview):

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**Sensitive**) |
   | `NEXT_PUBLIC_APP_URL` | `https://SEU-DOMINIO` |
   | `IP_HASH_SALT` | string aleatória longa (`openssl rand -hex 32`) |
   | `GOOGLE_PLACES_API_KEY` | opcional |
   | `WHATSAPP_*` | opcionais |

3. Faça o deploy. Build: `npm run build`; não há passos extras.
4. Acesse `/signup`, crie a primeira conta (será o proprietário) e abra **Integrações** → *Testar conexão* para validar Supabase e chave de serviço.

## 3. Google Places (opcional)

1. Google Cloud Console → crie/selecione um projeto → ative **Places API (New)** (exige faturamento ativo).
2. **APIs e serviços → Credenciais → Criar chave de API**; restrinja a chave à *Places API (New)* e defina cotas diárias para limitar custos.
3. Defina `GOOGLE_PLACES_API_KEY` na Vercel e faça redeploy. Em **Integrações**, use *Testar conexão*.

> Cada pesquisa consome cota/crédito. O app limita 60 pesquisas por usuário por hora.

## 4. Domínio, e-mail e formulários

- Aponte seu domínio em **Vercel → Domains** e atualize `NEXT_PUBLIC_APP_URL` e as URLs do Supabase Auth.
- Configure um SMTP próprio em **Supabase → Authentication → SMTP** (o e-mail padrão tem limites baixos).
- Para incorporar um formulário no seu site: *Formulários → (formulário) → Código de incorporação*.

## 5. Checklist de produção

- [ ] Migrações 0001–0003 aplicadas; `supabase/tests/run.sh` passando em um banco de teste
- [ ] “Confirm email” ativo e SMTP configurado
- [ ] Variáveis na Vercel (service_role marcada como *Sensitive*)
- [ ] `/privacidade` revisada pelo jurídico (razão social, CNPJ, DPO)
- [ ] Backups/PITR habilitados; limpeza de `rate_limits` agendada
- [ ] Cota e orçamento definidos na chave do Google Places
- [ ] Primeiro usuário criado e *Testar conexão* verde em Integrações

## 6. Verificação executada neste repositório

Foi realizada uma verificação ponta a ponta local com PostgreSQL 16 real + PostgREST 12 e um gateway mínimo simulando o GoTrue
(cadastro/login), exercitando via navegador (Chromium/Playwright): cadastro, criação de lead, análise de oportunidades, registro de
contato/nota, diálogo de WhatsApp, importação CSV, filtros do CRM, Kanban, pesquisa na base, criação e envio de formulário público
com UTM, campanhas, tarefas, relatórios, integrações, configurações e exportação. Os detalhes e o resultado estão na seção
“Testes executados” do relatório final da entrega. Esse harness não é versionado (dependência de binários externos).
