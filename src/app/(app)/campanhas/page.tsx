import Link from "next/link";
import { Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CampaignFormButton } from "@/components/campaigns/campaign-ui";
import { canWrite, getContext } from "@/lib/auth";
import { segmentLabel } from "@/lib/constants";
import { computeDashboard } from "@/lib/dashboard/aggregate";
import { loadDashboardData } from "@/lib/dashboard/load";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export const metadata = { title: "Campanhas" };
const STATUS = { draft: ["Rascunho", "default"], active: ["Ativa", "success"], paused: ["Pausada", "warning"], finished: ["Encerrada", "info"] } as const;

export default async function CampaignsPage() {
  const ctx = await getContext();
  const [{ data: campaigns, error }, dash] = await Promise.all([ctx.supabase.from("campaigns").select("*").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }), loadDashboardData(ctx)]);
  if (error) throw error;
  const perf = computeDashboard(dash.leads, dash.activities, dash.campaigns, dash.campaignLeads, {}).campaignPerformance;
  return (
    <>
      <PageHeader title="Campanhas" description="Organize ações comerciais, associe leads e acompanhe respostas, reuniões e conversões. Nenhuma mensagem é enviada automaticamente." actions={canWrite(ctx.role) ? <CampaignFormButton /> : undefined} />
      <Card className="overflow-hidden">
        {(campaigns ?? []).length === 0 ? <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" description="Crie uma campanha para agrupar leads de um segmento e organizar a sequência de acompanhamento." /> : (
          <Table>
            <THead><TR><TH>Campanha</TH><TH>Status</TH><TH>Segmento</TH><TH>Período</TH><TH>Leads</TH><TH>Taxa de resposta</TH><TH>Reuniões</TH><TH>Conversões</TH><TH>Retorno registrado</TH></TR></THead>
            <TBody>{(campaigns ?? []).map((c) => {
              const p = perf.find((x) => x.id === c.id);
              const [label, variant] = STATUS[c.status as keyof typeof STATUS] ?? STATUS.draft;
              return (
                <TR key={c.id}>
                  <TD><Link href={`/campanhas/${c.id}`} className="font-medium hover:text-primary">{c.name}</Link></TD>
                  <TD><Badge variant={variant}>{label}</Badge></TD>
                  <TD className="text-xs">{c.target_segment ? segmentLabel(c.target_segment) : "Todos"}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.starts_at)} → {formatDate(c.ends_at)}</TD>
                  <TD>{p?.leads ?? 0}</TD><TD>{formatPercent(p?.responseRate ?? 0)}</TD><TD>{p?.meetings ?? 0}</TD><TD>{p?.conversions ?? 0}</TD><TD>{formatCurrency(p?.value ?? 0)}</TD>
                </TR>
              );
            })}</TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
