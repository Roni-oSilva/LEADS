import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader, ScoreBadge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatCard } from "@/components/layout/stat-card";
import { AddLeadsForm, CampaignFormButton, CampaignStatusSelect, DeleteCampaignButton, GenerateTasksButton, RemoveLeadButton } from "@/components/campaigns/campaign-ui";
import { canWrite, getContext } from "@/lib/auth";
import { segmentLabel } from "@/lib/constants";
import { computeDashboard } from "@/lib/dashboard/aggregate";
import { loadDashboardData } from "@/lib/dashboard/load";
import { sequenceToText, type SequenceStep } from "@/lib/campaigns/schema";
import { getStages } from "@/lib/leads/service";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { CalendarCheck, MessageCircle, Reply, Trophy, Users, Wallet } from "lucide-react";

export const metadata = { title: "Campanha" };

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getContext();
  const { data: c } = await ctx.supabase.from("campaigns").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!c) notFound();
  const [stages, dash, { data: cls }] = await Promise.all([
    getStages(ctx.supabase, ctx.orgId),
    loadDashboardData(ctx),
    ctx.supabase.from("campaign_leads").select("lead:leads(id, company_name, city, state, score, score_priority, stage:pipeline_stages(name))").eq("campaign_id", id).limit(200),
  ]);
  const p = computeDashboard(dash.leads, dash.activities, dash.campaigns, dash.campaignLeads, {}).campaignPerformance.find((x) => x.id === id);
  type L = { lead: { id: string; company_name: string; city: string | null; state: string | null; score: number; score_priority: string; stage: { name: string } | null } | null };
  const leads = ((cls ?? []) as unknown as L[]).map((x) => x.lead).filter((l): l is NonNullable<typeof l> => !!l);
  const seq = (c.sequence ?? []) as SequenceStep[];
  const write = canWrite(ctx.role);
  return (
    <>
      <Link href="/campanhas" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Campanhas</Link>
      <PageHeader title={c.name} description={c.objective ?? undefined} actions={write ? (<><CampaignStatusSelect id={id} status={c.status} /><CampaignFormButton initial={{ id, name: c.name, objective: c.objective, target_segment: c.target_segment, source_key: c.source_key, status: c.status, starts_at: c.starts_at, ends_at: c.ends_at, sequence: sequenceToText(seq) }} /><DeleteCampaignButton id={id} /></>) : undefined} />
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Leads" value={String(p?.leads ?? 0)} icon={Users} />
          <StatCard label="Contatados" value={String(p?.contacted ?? 0)} icon={MessageCircle} accent="info" />
          <StatCard label="Respostas" value={String(p?.responses ?? 0)} icon={Reply} accent="success" hint={`Taxa: ${formatPercent(p?.responseRate ?? 0)}`} />
          <StatCard label="Reuniões" value={String(p?.meetings ?? 0)} icon={CalendarCheck} accent="warning" />
          <StatCard label="Conversões" value={String(p?.conversions ?? 0)} icon={Trophy} accent="success" />
          <StatCard label="Retorno registrado" value={formatCurrency(p?.value ?? 0)} icon={Wallet} />
        </section>
        <Card>
          <CardHeader><div><CardTitle>Sequência de acompanhamento</CardTitle><CardDescription>Gera tarefas de retorno para cada lead associado, respeitando “não contatar” e preferências de canal.</CardDescription></div>{write && <GenerateTasksButton campaignId={id} disabled={seq.length === 0 || leads.length === 0} />}</CardHeader>
          <CardContent>{seq.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma etapa definida. Edite a campanha para adicionar.</p> : <ol className="space-y-1.5 text-sm">{seq.map((s, i) => <li key={i} className="flex items-center gap-3"><Badge variant="primary">Dia {s.day_offset}</Badge>{s.title}</li>)}</ol>}
            <Alert variant="info" className="mt-4">Mensagens em massa não são enviadas por esta área. O contato é feito individualmente, com mensagem revisada por você, e somente para quem tem base legal e canal permitido.</Alert></CardContent>
        </Card>
        {write && <Card><CardHeader><div><CardTitle>Associar leads</CardTitle><CardDescription>Selecione leads da sua base por critérios. Leads marcados como “não contatar” nunca são associados.</CardDescription></div></CardHeader><CardContent><AddLeadsForm campaignId={id} stages={stages} /></CardContent></Card>}
        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Leads da campanha ({leads.length}){c.target_segment ? ` · alvo: ${segmentLabel(c.target_segment)}` : ""}</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            {leads.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum lead associado ainda.</p> : (
              <Table><THead><TR><TH>Empresa</TH><TH>Cidade/UF</TH><TH>Pontuação</TH><TH>Etapa</TH><TH className="w-10" /></TR></THead>
                <TBody>{leads.map((l) => <TR key={l.id}><TD><Link href={`/crm/${l.id}`} className="font-medium hover:text-primary">{l.company_name}</Link></TD><TD className="text-xs">{[l.city, l.state].filter(Boolean).join("/") || "—"}</TD><TD><ScoreBadge score={l.score} priority={l.score_priority} /></TD><TD><Badge>{l.stage?.name ?? "—"}</Badge></TD><TD>{write && <RemoveLeadButton campaignId={id} leadId={l.id} />}</TD></TR>)}</TBody></Table>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Criada em {formatDate(c.created_at)} · período {formatDate(c.starts_at)} → {formatDate(c.ends_at)}</p>
      </div>
    </>
  );
}
