# Arquitetura

## Visão geral

```
Navegador ──► Next.js (Vercel)
                │  proxy.ts ........ valida sessão (Supabase Auth) e protege rotas
                │  Server Components  leitura com o cliente do usuário (RLS)
                │  Server Actions ... escrita/regra de negócio (valida com Zod, checa papel)
                │  Route Handlers ... endpoints públicos (formulários, DSAR) e exportações
                ▼
        Supabase PostgreSQL  ◄── RLS por organização · triggers · funções (rate limit)
                ▲
 Fontes externas: Google Places (adaptador), CSV, formulários — cada uma isolada em um adaptador
```

### Princípios

1. **Dados reais ou indisponível.** Provedores sem credencial devolvem `configured: false` com instruções; a UI exibe o estado.
2. **RLS como fronteira de segurança.** As Server Actions usam o cliente com a sessão do usuário. O `service_role` aparece só em
   rotas públicas (`/api/forms/*`, `/api/dsar`) e na RPC de rate limit.
3. **Regra de negócio pura e testável** em `src/lib/*` (scoring, dedupe, oportunidades, CSV, agregações) — sem I/O.
4. **Explicabilidade.** A pontuação devolve o *breakdown* (critério, peso, pontos, motivo); oportunidades trazem evidência, fonte,
   data, confiança e próxima ação.
5. **Ausência ≠ prova.** Sem site nos dados → “não identificado” (confiança baixa, não verificado) até verificação.

## Fluxos

### Pesquisa e salvamento
`encontrar-leads` → `searchLeadsAction` (rate limit por usuário; adaptador do provedor) → resultados marcados como salvos via
`dedupe_keys && keys` → `saveProviderLeadsAction` → `insertLead` (dedupe → insert → `analyzeLead` → `refreshScore` → histórico).

### Deduplicação
`computeDedupeKeys` gera chaves (`ref:`, `tel:`, `web:`, `mail:`, `name:|city`). Dois leads com qualquer chave em comum são o mesmo
(`leads.dedupe_keys text[]` com índice GIN e consulta `overlaps`).

### Pontuação (`src/lib/scoring`)
7 critérios configuráveis por organização (pesos normalizados para 100): compatibilidade com o serviço, necessidade identificada,
evidência, geografia, canal legítimo, interesse demonstrado, recência. Faixas: 80–100 alta · 50–79 média · 0–49 baixa. “Não
contatar” zera a pontuação. Cada recálculo grava histórico em `lead_scores`.

### Analisador de oportunidades (`src/lib/opportunities`)
Regras sobre dados públicos já coletados + verificação opcional do site (`check-website.ts`): 1 `GET` à página inicial, timeout de 8 s,
até 3 redirecionamentos, DNS resolvido e validado contra IPs privados a cada salto (anti-SSRF), User-Agent identificado.

### Formulários públicos
`/f/[slug]` e `/embed/[slug]` (renderização com service_role somente leitura) → `POST /api/forms/[slug]/submit`:
origem → tamanho → rate limit (IP+form e form) → Zod → honeypot/tempo mínimo → `processSubmission` (lead, consentimento,
preferências, tarefa de retorno, campanha, `form_submissions` com UTM e IP *hasheado*).

### WhatsApp
Link oficial `https://wa.me/<E.164>?text=...`. O sistema registra `whatsapp_started` com `delivery: "unconfirmed"`. “Contato
realizado” e “Resposta recebida” são registros manuais que também avançam a etapa (apenas para frente) e atualizam o score.

### Funil
10 etapas por organização (`pipeline_stages`). `moveLeadToStage` registra histórico; mover para “Não contatar” marca o lead e
insere telefone/e-mail na lista de supressão; sair dessa etapa exige administrador.

## Decisões e limites conhecidos

- **Agregações do dashboard em TypeScript** sobre até 10 mil leads (aviso na UI quando truncado). Para volumes maiores, migrar para
  views/RPCs SQL — as funções puras servem de especificação.
- **Funil “chegou à etapa”** usa a etapa atual (leads perdidos saem da contagem). Para conversão histórica exata, derive de
  `lead_activities` (`stage_change`).
- **Importação** em lotes de 100 linhas (revalidação no servidor); lotes concluídos permanecem gravados se houver falha, e reenviar o
  arquivo ignora duplicidades.
- **Google Places:** o conteúdo tem restrições de armazenamento nos termos da Google; por isso nada é gravado sem ação do usuário e há aviso na UI.
  Avalie com seu jurídico o que persistir em produção (ex.: apenas `place_id` + dados fornecidos/confirmados por você).
