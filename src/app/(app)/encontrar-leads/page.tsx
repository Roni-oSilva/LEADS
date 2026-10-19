import Link from "next/link";
import { FindLeads, type ProviderInfo } from "@/components/leads/find-leads";
import { BulkAddButton } from "@/components/crm/bulk-add";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { canWrite, getContext } from "@/lib/auth";
import { scoringConfigFrom } from "@/lib/leads/service";
import { PROVIDERS } from "@/lib/providers/registry";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/whatsapp/link";

export const metadata = { title: "Encontrar Leads" };

export default async function FindLeadsPage() {
  const ctx = await getContext();
  const providers: ProviderInfo[] = PROVIDERS.map((p) => {
    const s = p.status();
    return { key: p.key, name: p.name, description: p.description, configured: s.configured, missing: s.configured ? [] : s.missing, instructions: s.configured ? "" : s.instructions };
  });
  return (
    <>
      <PageHeader title="Encontrar Leads" description="Pesquise empresas em fontes de dados autorizadas. Resultados só são gravados quando você os salva — e nada é simulado." />
      <FindLeads providers={providers} config={scoringConfigFrom(ctx.orgSettings)} canWrite={canWrite(ctx.role)} template={(ctx.orgSettings.whatsapp_template as string) || DEFAULT_WHATSAPP_TEMPLATE} />
      <Card className="mt-8">
        <CardHeader><div><CardTitle>Outras formas gratuitas de trazer leads</CardTitle><CardDescription>Combine com a pesquisa acima para ter telefone e e-mail com mais confiabilidade.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Colar uma lista", "Cole nomes, telefones e cidades (uma empresa por linha) e o sistema reconhece cada dado.", canWrite(ctx.role) ? <BulkAddButton key="b" variant="default" /> : null],
            ["Importar planilha CSV", "Mapeamento de colunas, prévia, deduplicação e relatório de erros.", <Link key="i" href="/importar-exportar" className={buttonVariants({ variant: "secondary" })}>Importar CSV</Link>],
            ["Formulários no seu site", "Receba leads que pedem contato, com UTM e consentimento.", <Link key="f" href="/formularios" className={buttonVariants({ variant: "secondary" })}>Criar formulário</Link>],
            ["Completar pelo CNPJ", "No detalhe de cada lead, informe o CNPJ e preencha telefone, e-mail e endereço públicos.", <Link key="c" href="/crm" className={buttonVariants({ variant: "secondary" })}>Abrir Meu CRM</Link>],
          ].map(([t, d, a]) => (
            <div key={String(t)} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card-2/40 p-4">
              <div><p className="text-sm font-medium">{t as string}</p><p className="mt-1 text-xs text-muted-foreground">{d as string}</p></div>
              <div>{a as React.ReactNode}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
