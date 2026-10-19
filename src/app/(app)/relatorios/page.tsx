import { Download } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DashboardFilters } from "@/components/layout/dashboard-filters";
import { Donut, FunnelBars, HBar, TimeSeries } from "@/components/charts/charts";
import { getContext } from "@/lib/auth";
import { segmentLabel } from "@/lib/constants";
import { computeDashboard, filterLeads } from "@/lib/dashboard/aggregate";
import { loadDashboardData } from "@/lib/dashboard/load";
import { parseFilters } from "@/lib/dashboard/params";
import { formatCurrency, formatPercent } from "@/lib/utils";

export const metadata = { title: "Relatórios" };
const SOURCE_NAMES: Record<string, string> = { google_places: "Google Places", csv_import: "Importação CSV", form: "Formulários", manual: "Cadastro manual" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getContext();
  const { filters, granularity, values } = parseFilters(await searchParams);
  const data = await loadDashboardData(ctx);
  const d = computeDashboard(data.leads, data.activities, data.campaigns, data.campaignLeads, filters, granularity);
  const states = [...new Set(data.leads.map((l) => l.state).filter(Boolean) as string[])].sort();
  const cities = [...new Set(data.leads.map((l) => l.city).filter(Boolean) as string[])].sort();
  const sources = [...new Set(data.leads.map((l) => l.source_key).filter(Boolean) as string[])].map((key) => ({ key, name: SOURCE_NAMES[key] ?? key }));

  // Desempenho por responsável (leads do período).
  const scoped = filterLeads(data.leads, filters);
  const byOwner = data.members.map((m) => {
    const mine = scoped.filter((l) => l.owner_id === m.id);
    const won = mine.filter((l) => l.stage_key === "won");
    return { name: m.name, leads: mine.length, won: won.length, value: won.reduce((s, l) => s + (l.estimated_value ?? 0), 0), rate: mine.length ? (won.length / mine.length) * 100 : 0 };
  }).filter((o) => o.leads > 0);
  const priority = [["Alta (80–100)", scoped.filter((l) => l.score_priority === "high").length], ["Média (50–79)", scoped.filter((l) => l.score_priority === "medium").length], ["Baixa (0–49)", scoped.filter((l) => l.score_priority === "low").length]].map(([name, value]) => ({ name: name as string, value: value as number }));

  const qs = new URLSearchParams(Object.entries(values).filter(([, v]) => v).map(([k, v]) => [k, String(v)])).toString();
  return (
    <>
      <PageHeader title="Relatórios" description="Análise do funil, das fontes e das campanhas no período selecionado." actions={<Link href={`/api/leads/export?${qs}`} className={buttonVariants({ variant: "secondary" })}><Download className="h-4 w-4" aria-hidden /> Exportar leads (CSV)</Link>} />
      <DashboardFilters action="/relatorios" values={values} states={states} cities={cities} owners={data.members} sources={sources} />
      {data.leads.length === 0 ? <Card><EmptyState title="Sem dados para relatar" description="Os relatórios aparecem assim que houver leads cadastrados." /></Card> : (
        <div className="space-y-6">
          <Alert variant="info">Funil: “chegou à etapa” considera a etapa atual do lead; leads perdidos ou marcados como “não contatar” ficam fora dessa contagem.</Alert>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Conversão por etapa do funil</CardTitle></CardHeader><CardContent><FunnelBars data={d.funnel} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Distribuição por prioridade</CardTitle><CardDescription>Pontuação explicável de 0 a 100</CardDescription></CardHeader><CardContent><Donut data={priority} label="Distribuição por prioridade" /></CardContent></Card>
            <Card><CardHeader><CardTitle>Leads capturados</CardTitle></CardHeader><CardContent>{d.captured.length ? <TimeSeries data={d.captured} dataKey="leads" label="Leads capturados" /> : <EmptyState title="Sem leads no período" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Contatos realizados</CardTitle></CardHeader><CardContent>{d.contactsEvolution.length ? <TimeSeries data={d.contactsEvolution} dataKey="contacts" label="Contatos" kind="line" /> : <EmptyState title="Sem contatos no período" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Segmentos</CardTitle></CardHeader><CardContent>{d.bySegment.length ? <HBar data={d.bySegment.slice(0, 8).map((s) => ({ ...s, name: segmentLabel(s.name) }))} label="Segmentos" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Origem dos leads</CardTitle></CardHeader><CardContent>{d.bySource.length ? <Donut data={d.bySource.map((s) => ({ ...s, name: SOURCE_NAMES[s.name] ?? s.name }))} label="Origem" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
          </div>
          <Card className="overflow-hidden"><CardHeader><CardTitle>Campanhas</CardTitle></CardHeader><CardContent className="px-0 pb-0 pt-3">
            {d.campaignPerformance.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma campanha.</p> : <Table><THead><TR><TH>Campanha</TH><TH>Leads</TH><TH>Contatados</TH><TH>Respostas</TH><TH>Taxa</TH><TH>Reuniões</TH><TH>Conversões</TH><TH>Retorno</TH></TR></THead><TBody>{d.campaignPerformance.map((c) => <TR key={c.id}><TD className="font-medium">{c.name}</TD><TD>{c.leads}</TD><TD>{c.contacted}</TD><TD>{c.responses}</TD><TD>{formatPercent(c.responseRate)}</TD><TD>{c.meetings}</TD><TD>{c.conversions}</TD><TD>{formatCurrency(c.value)}</TD></TR>)}</TBody></Table>}
          </CardContent></Card>
          <Card className="overflow-hidden"><CardHeader><CardTitle>Desempenho por responsável</CardTitle></CardHeader><CardContent className="px-0 pb-0 pt-3">
            {byOwner.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">Sem leads atribuídos no período.</p> : <Table><THead><TR><TH>Responsável</TH><TH>Leads</TH><TH>Ganhos</TH><TH>Conversão</TH><TH>Valor ganho</TH></TR></THead><TBody>{byOwner.map((o) => <TR key={o.name}><TD className="font-medium">{o.name}</TD><TD>{o.leads}</TD><TD>{o.won}</TD><TD>{formatPercent(o.rate)}</TD><TD>{formatCurrency(o.value)}</TD></TR>)}</TBody></Table>}
          </CardContent></Card>
        </div>
      )}
    </>
  );
}
