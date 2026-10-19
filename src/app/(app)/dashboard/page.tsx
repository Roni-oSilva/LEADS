import { Briefcase, CalendarCheck, FileText, MessageCircle, Percent, Sparkles, Target, Trophy, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Donut, FunnelBars, HBar, TimeSeries } from "@/components/charts/charts";
import { StatCard } from "@/components/layout/stat-card";
import { DashboardFilters } from "@/components/layout/dashboard-filters";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getContext } from "@/lib/auth";
import { computeDashboard } from "@/lib/dashboard/aggregate";
import { loadDashboardData } from "@/lib/dashboard/load";
import { parseFilters } from "@/lib/dashboard/params";
import { segmentLabel } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const SOURCE_NAMES: Record<string, string> = { google_places: "Google Places", openstreetmap: "OpenStreetMap", csv_import: "Importação CSV", form: "Formulários", manual: "Cadastro manual" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getContext();
  const { filters, granularity, values } = parseFilters(await searchParams);
  const data = await loadDashboardData(ctx);
  const d = computeDashboard(data.leads, data.activities, data.campaigns, data.campaignLeads, filters, granularity);
  const k = d.kpis;
  const states = [...new Set(data.leads.map((l) => l.state).filter(Boolean) as string[])].sort();
  const cities = [...new Set(data.leads.map((l) => l.city).filter(Boolean) as string[])].sort();
  const sources = [...new Set(data.leads.map((l) => l.source_key).filter(Boolean) as string[])].map((key) => ({ key, name: SOURCE_NAMES[key] ?? key }));
  const bySegment = d.bySegment.map((s) => ({ ...s, name: segmentLabel(s.name) }));
  const bySource = d.bySource.map((s) => ({ ...s, name: SOURCE_NAMES[s.name] ?? s.name }));
  const empty = data.leads.length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Indicadores calculados a partir dos registros reais da sua organização."
        actions={<Link href="/encontrar-leads" className={buttonVariants()}>Encontrar leads</Link>}
      />
      {data.truncated && <Alert variant="warning" className="mb-4" title="Volume alto de dados">Os indicadores consideram os 10.000 leads mais recentes. Use os filtros para refinar.</Alert>}
      <DashboardFilters action="/dashboard" values={values} states={states} cities={cities} owners={data.members} sources={sources} />

      {empty ? (
        <Card>
          <EmptyState icon={Users} title="Você ainda não tem leads" description="Pesquise empresas em uma fonte conectada, importe um CSV ou cadastre manualmente. Os indicadores aparecerão aqui.">
            <div className="flex gap-2">
              <Link href="/encontrar-leads" className={buttonVariants()}>Encontrar leads</Link>
              <Link href="/importar-exportar" className={buttonVariants({ variant: "secondary" })}>Importar CSV</Link>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total de leads" value={String(k.total)} icon={Users} />
            <StatCard label="Novos no período" value={String(k.newInPeriod)} icon={UserPlus} accent="info" />
            <StatCard label="Qualificados" value={String(k.qualified)} icon={Target} accent="success" hint="Etapa Qualificado ou posterior" />
            <StatCard label="Contatados" value={String(k.contacted)} icon={MessageCircle} accent="info" />
            <StatCard label="Reuniões agendadas" value={String(k.meetings)} icon={CalendarCheck} accent="warning" />
            <StatCard label="Propostas enviadas" value={String(k.proposals)} icon={FileText} accent="warning" />
            <StatCard label="Negócios ganhos" value={String(k.won)} icon={Trophy} accent="success" />
            <StatCard label="Taxa de conversão" value={formatPercent(k.conversionRate)} icon={Percent} hint="Ganhos ÷ total de leads" />
            <StatCard label="Valor potencial do pipeline" value={formatCurrency(k.pipelineValue)} icon={Wallet} hint="Valores estimados em aberto" />
            <StatCard label="Leads de alta prioridade" value={String(data.leads.filter((l) => l.score_priority === "high").length)} icon={Sparkles} accent="success" />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Leads capturados</CardTitle><CardDescription>Por {granularity === "day" ? "dia" : granularity === "week" ? "semana" : "mês"} no período</CardDescription></div></CardHeader>
              <CardContent>{d.captured.length ? <TimeSeries data={d.captured} dataKey="leads" label="Leads capturados" /> : <EmptyState title="Sem leads no período" />}</CardContent></Card>
            <Card><CardHeader><div><CardTitle>Evolução dos contatos</CardTitle><CardDescription>Contatos registrados (WhatsApp, ligações, e-mails)</CardDescription></div></CardHeader>
              <CardContent>{d.contactsEvolution.length ? <TimeSeries data={d.contactsEvolution} dataKey="contacts" label="Contatos realizados" kind="line" /> : <EmptyState title="Nenhum contato registrado no período" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Funil de conversão</CardTitle></CardHeader><CardContent><FunnelBars data={d.funnel} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Origem dos leads</CardTitle></CardHeader><CardContent>{bySource.length ? <Donut data={bySource} label="Origem dos leads" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Leads por segmento</CardTitle></CardHeader><CardContent>{bySegment.length ? <HBar data={bySegment.slice(0, 8)} label="Leads por segmento" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Leads por cidade</CardTitle></CardHeader><CardContent>{d.byCity.length ? <HBar data={d.byCity} label="Leads por cidade" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Leads por estado</CardTitle></CardHeader><CardContent>{d.byState.length ? <HBar data={d.byState} label="Leads por estado" /> : <EmptyState title="Sem dados" />}</CardContent></Card>
            <Card>
              <CardHeader><CardTitle>Desempenho das campanhas</CardTitle></CardHeader>
              <CardContent className="px-0 pb-2">
                {d.campaignPerformance.length === 0 ? <EmptyState icon={Briefcase} title="Nenhuma campanha criada" /> : (
                  <Table>
                    <THead><TR><TH>Campanha</TH><TH>Leads</TH><TH>Resposta</TH><TH>Reuniões</TH><TH>Ganhos</TH></TR></THead>
                    <TBody>{d.campaignPerformance.map((c) => (
                      <TR key={c.id}><TD className="font-medium">{c.name}</TD><TD>{c.leads}</TD><TD>{formatPercent(c.responseRate)}</TD><TD>{c.meetings}</TD><TD>{c.conversions}</TD></TR>
                    ))}</TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
