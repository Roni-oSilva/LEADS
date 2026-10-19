import { FindLeads, type ProviderInfo } from "@/components/leads/find-leads";
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
    </>
  );
}
