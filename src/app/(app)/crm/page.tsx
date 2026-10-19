import { SegmentOptions } from "@/components/ui/segment-options";
import { Filter, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { LeadsTable, type LeadRow } from "@/components/crm/leads-table";
import { BulkAddButton } from "@/components/crm/bulk-add";
import { NewLeadButton } from "@/components/crm/new-lead-button";
import { canWrite, getContext } from "@/lib/auth";
import { UF_LIST } from "@/lib/constants";
import { applyLeadFilters, LEAD_SELECT, PAGE_SIZE, parseLeadQuery, type Sp } from "@/lib/leads/query";
import { getStages } from "@/lib/leads/service";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/whatsapp/link";
import Link from "next/link";

export const metadata = { title: "Meu CRM" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await getContext();
  const sp = await searchParams;
  const f = parseLeadQuery(sp);
  const [stages, { data: sources }] = await Promise.all([getStages(ctx.supabase, ctx.orgId), ctx.supabase.from("lead_sources").select("id, name").eq("organization_id", ctx.orgId)]);

  const from = (f.page - 1) * PAGE_SIZE;
  const base = ctx.supabase.from("leads").select(LEAD_SELECT, { count: "exact" });
  const { data, count, error } = await applyLeadFilters(base, ctx, f)
    .order(f.sort, { ascending: f.dir === "asc", nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;

  const params = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, stage: f.stage, segment: f.segment, state: f.state, city: f.city, priority: f.priority, source: f.source, fav: f.fav ? "1" : undefined, site: f.site, insta: f.insta, wa: f.wa, sort: f.sort, dir: f.dir, page: f.page, ...over })) if (v !== undefined && v !== "") u.set(k, String(v));
    return `/crm?${u}`;
  };
  const sortLinks = Object.fromEntries(["company_name", "city", "score", "created_at"].map((key) => [key, params({ sort: key, dir: f.sort === key && f.dir === "desc" ? "asc" : "desc", page: 1 })]));
  const rows = (data ?? []) as unknown as LeadRow[];
  const template = (ctx.orgSettings.whatsapp_template as string) || DEFAULT_WHATSAPP_TEMPLATE;
  const hasFilters = !!(f.q || f.stage || f.segment || f.state || f.city || f.priority || f.source || f.fav || f.site || f.insta || f.wa);

  return (
    <>
      <PageHeader title="Meu CRM" description="Todos os leads salvos, com filtros, pontuação e histórico." actions={canWrite(ctx.role) ? <><BulkAddButton /><NewLeadButton /></> : undefined} />
      <form action="/crm" className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4 xl:grid-cols-6">
        <label className="col-span-2 text-xs text-muted-foreground">Buscar<Input name="q" defaultValue={f.q} placeholder="Empresa, contato, e-mail, cidade, telefone…" className="mt-1" /></label>
        <label className="text-xs text-muted-foreground">Etapa<Select name="stage" defaultValue={f.stage ?? ""} className="mt-1"><option value="">Todas</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="text-xs text-muted-foreground">Segmento<Select name="segment" defaultValue={f.segment ?? ""} className="mt-1"><option value="">Todos</option><SegmentOptions /></Select></label>
        <label className="text-xs text-muted-foreground">Estado<Select name="state" defaultValue={f.state ?? ""} className="mt-1"><option value="">Todos</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select></label>
        <label className="text-xs text-muted-foreground">Cidade<Input name="city" defaultValue={f.city} className="mt-1" /></label>
        <label className="text-xs text-muted-foreground">Prioridade<Select name="priority" defaultValue={f.priority ?? ""} className="mt-1"><option value="">Todas</option><option value="high">Alta (80–100)</option><option value="medium">Média (50–79)</option><option value="low">Baixa (0–49)</option></Select></label>
        <label className="text-xs text-muted-foreground">Origem<Select name="source" defaultValue={f.source ?? ""} className="mt-1"><option value="">Todas</option>{(sources ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="text-xs text-muted-foreground">Site<Select name="site" defaultValue={f.site ?? ""} className="mt-1"><option value="">Todos</option><option value="yes">Com site</option><option value="no">Site não identificado</option></Select></label>
        <label className="text-xs text-muted-foreground">Instagram<Select name="insta" defaultValue={f.insta ?? ""} className="mt-1"><option value="">Todos</option><option value="yes">Com Instagram</option><option value="no">Não identificado</option></Select></label>
        <label className="flex items-end gap-2 pb-2 text-xs text-muted-foreground"><input type="checkbox" name="fav" value="1" defaultChecked={f.fav} className="accent-[#7c6cf6]" /> Somente favoritos</label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-2">
          <Button type="submit" size="sm"><Filter className="h-3.5 w-3.5" aria-hidden /> Filtrar</Button>
          {hasFilters && <Link href="/crm" className="text-xs text-muted-foreground hover:text-foreground">Limpar</Link>}
        </div>
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={hasFilters ? "Nenhum lead encontrado com esses filtros" : "Seu CRM está vazio"} description={hasFilters ? "Ajuste ou limpe os filtros." : "Salve leads a partir de “Encontrar Leads”, importe um CSV ou cadastre manualmente."}>
            {!hasFilters && <Link href="/encontrar-leads" className={buttonVariants()}>Encontrar leads</Link>}
          </EmptyState>
        ) : (
          <>
            <LeadsTable rows={rows} stages={stages} template={template} canWrite={canWrite(ctx.role)} sortLinks={sortLinks} />
            <Pagination page={f.page} pageSize={PAGE_SIZE} total={count ?? 0} href={(p) => params({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
