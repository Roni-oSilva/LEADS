import Link from "next/link";
import { Filter, ScanSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form-controls";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getContext } from "@/lib/auth";
import { SERVICES, serviceLabel } from "@/lib/constants";
import { first, PAGE_SIZE, type Sp } from "@/lib/leads/query";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Oportunidades Digitais" };

const CONF = { high: ["Alta", "success"], medium: ["Média", "warning"], low: ["Baixa", "default"] } as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await getContext();
  const sp = await searchParams;
  const conf = first(sp.conf), service = first(sp.service), verified = first(sp.verified);
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let q = ctx.supabase.from("lead_evidence").select("*, lead:leads(id, company_name, city, state)", { count: "exact" }).eq("organization_id", ctx.orgId);
  if (conf && conf in CONF) q = q.eq("confidence", conf);
  if (service) q = q.eq("service", service);
  if (verified === "yes") q = q.eq("verified", true);
  if (verified === "no") q = q.eq("verified", false);
  const { data, count, error } = await q.order("checked_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) throw error;

  const href = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ conf, service, verified, page: p })) if (v) u.set(k, String(v));
    return `/oportunidades?${u}`;
  };
  type Row = { id: string; title: string; evidence: string; source: string; checked_at: string; service: string | null; confidence: keyof typeof CONF; recommended_action: string | null; verified: boolean; lead: { id: string; company_name: string; city: string | null; state: string | null } | null };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Oportunidades Digitais" description="Sinais comerciais identificados em dados públicos e fontes autorizadas, com evidência, fonte, data e grau de confiança." />
      <Alert variant="info" className="mb-4" title="Como interpretar">
        Ausência de site nos resultados <strong>não comprova</strong> que a empresa não possui um — o status é “não identificado” até ser verificado. Sinais “não verificados” são hipóteses para você confirmar antes de abordar.
      </Alert>
      <form action="/oportunidades" className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <label className="text-xs text-muted-foreground">Confiança<Select name="conf" defaultValue={conf ?? ""} className="mt-1"><option value="">Todas</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></Select></label>
        <label className="text-xs text-muted-foreground">Serviço<Select name="service" defaultValue={service ?? ""} className="mt-1"><option value="">Todos</option>{SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></label>
        <label className="text-xs text-muted-foreground">Verificação<Select name="verified" defaultValue={verified ?? ""} className="mt-1"><option value="">Todas</option><option value="yes">Verificados</option><option value="no">Não verificados</option></Select></label>
        <div className="flex items-end"><Button type="submit" size="sm"><Filter className="h-3.5 w-3.5" aria-hidden /> Filtrar</Button></div>
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ScanSearch} title="Nenhuma oportunidade registrada" description="As oportunidades são geradas ao salvar leads ou ao executar “Analisar oportunidades” no detalhe do lead.">
            <Link href="/crm" className={buttonVariants({ variant: "secondary" })}>Abrir Meu CRM</Link>
          </EmptyState>
        ) : (
          <>
            <Table>
              <THead><TR><TH>Empresa</TH><TH>Oportunidade</TH><TH>Evidência observada</TH><TH>Fonte</TH><TH>Verificação</TH><TH>Serviço</TH><TH>Confiança</TH><TH>Próxima ação</TH></TR></THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.id} className="align-top">
                    <TD>{r.lead ? <Link href={`/crm/${r.lead.id}`} className="font-medium hover:text-primary">{r.lead.company_name}</Link> : "—"}<p className="text-xs text-muted-foreground">{[r.lead?.city, r.lead?.state].filter(Boolean).join("/")}</p></TD>
                    <TD className="min-w-44 font-medium">{r.title}</TD>
                    <TD className="min-w-64 max-w-sm text-xs text-muted-foreground">{r.evidence}</TD>
                    <TD className="min-w-32 text-xs">{r.source}</TD>
                    <TD className="whitespace-nowrap text-xs"><Badge variant={r.verified ? "success" : "default"}>{r.verified ? "Verificado" : "Não verificado"}</Badge><p className="mt-1 text-muted-foreground">{formatDate(r.checked_at, true)}</p></TD>
                    <TD className="min-w-36 text-xs">{serviceLabel(r.service)}</TD>
                    <TD><Badge variant={CONF[r.confidence][1]}>{CONF[r.confidence][0]}</Badge></TD>
                    <TD className="min-w-56 max-w-xs text-xs text-muted-foreground">{r.recommended_action}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={href} />
          </>
        )}
      </Card>
    </>
  );
}
