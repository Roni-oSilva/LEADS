import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TestConnectionButton } from "@/components/settings/test-button";
import { getContext, isAdmin } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers/registry";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Integrações" };

interface Card_ { key: string; name: string; description: string; configured: boolean; vars: string[]; instructions: string; docs?: string }

export default async function IntegrationsPage() {
  const ctx = await getContext();
  const admin = isAdmin(ctx.role);
  const [{ data: states }, { data: logs }] = await Promise.all([
    ctx.supabase.from("integrations").select("provider, last_tested_at, last_status, last_error").eq("organization_id", ctx.orgId),
    admin ? ctx.supabase.from("integration_logs").select("id, provider, action, status, message, created_at").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  const items: Card_[] = [
    { key: "supabase", name: "Supabase (banco e autenticação)", description: "PostgreSQL com RLS e Supabase Auth.", configured: isSupabaseConfigured(), vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], instructions: "Copie as chaves em Project Settings > API." },
    { key: "service_role", name: "Chave de serviço (servidor)", description: "Necessária para formulários públicos, rate limiting e solicitações de titulares.", configured: isServiceRoleConfigured(), vars: ["SUPABASE_SERVICE_ROLE_KEY"], instructions: "Defina apenas no servidor (Vercel > Environment Variables). Nunca use o prefixo NEXT_PUBLIC_." },
    ...PROVIDERS.map((p) => { const s = p.status(); return { key: p.key, name: p.name, description: p.description, configured: s.configured, vars: s.configured ? [] : s.missing, instructions: s.configured ? "" : s.instructions }; }),
    { key: "whatsapp_business", name: "WhatsApp Business Platform", description: "Envio automatizado oficial (modelos aprovados e consentimento). Opcional: sem ela, o sistema usa links wa.me abertos pelo usuário.", configured: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN), vars: ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"], instructions: "Crie um app em developers.facebook.com, ative o WhatsApp e gere um token permanente. O envio automatizado exige modelos aprovados e consentimento." },
  ];
  const last = new Map((states ?? []).map((s) => [s.provider, s]));
  return (
    <>
      <PageHeader title="Integrações" description="Status das fontes de dados e serviços. As chaves ficam apenas em variáveis de ambiente do servidor — nunca são exibidas aqui." />
      <Alert variant="info" className="mb-6" title="Sem simulações">Quando uma integração não está configurada, o recurso correspondente fica indisponível e informa o que falta. Nenhum resultado é inventado.</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((it) => {
          const st = last.get(it.key);
          return (
            <Card key={it.key}>
              <CardHeader><div><CardTitle>{it.name}</CardTitle><CardDescription>{it.description}</CardDescription></div><Badge variant={it.configured ? "success" : "warning"}>{it.configured ? "Configurada" : "Não configurada"}</Badge></CardHeader>
              <CardContent className="space-y-3">
                {!it.configured && <Alert variant="warning"><p>{it.instructions}</p><p className="mt-1">Variáveis: <code>{it.vars.join(", ")}</code></p></Alert>}
                {it.configured && it.vars.length > 0 && <p className="text-xs text-muted-foreground">Variáveis detectadas: <code>{it.vars.join(", ")}</code></p>}
                {st?.last_tested_at && <p className="text-xs text-muted-foreground">Último teste: {formatDate(st.last_tested_at, true)} · <Badge variant={st.last_status === "ok" ? "success" : st.last_status === "error" ? "danger" : "warning"}>{st.last_status}</Badge>{st.last_error && <span className="ml-1">{st.last_error}</span>}</p>}
                {admin ? <TestConnectionButton providerKey={it.key} /> : <p className="text-xs text-muted-foreground">Somente administradores podem testar conexões.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {admin && (
        <Card className="mt-6 overflow-hidden"><CardHeader><CardTitle>Logs de integração</CardTitle></CardHeader><CardContent className="px-0 pb-0 pt-3">
          {(logs ?? []).length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum teste executado ainda.</p> : <Table><THead><TR><TH>Data</TH><TH>Integração</TH><TH>Ação</TH><TH>Status</TH><TH>Mensagem</TH></TR></THead><TBody>{(logs ?? []).map((l) => <TR key={l.id}><TD className="whitespace-nowrap text-xs">{formatDate(l.created_at, true)}</TD><TD>{l.provider}</TD><TD className="text-xs">{l.action}</TD><TD><Badge variant={l.status === "ok" ? "success" : l.status === "error" ? "danger" : "warning"}>{l.status}</Badge></TD><TD className="max-w-md truncate text-xs text-muted-foreground">{l.message}</TD></TR>)}</TBody></Table>}
        </CardContent></Card>
      )}
    </>
  );
}
