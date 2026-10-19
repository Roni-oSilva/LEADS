import Link from "next/link";
import { Kanban as KanbanIcon } from "lucide-react";
import { Kanban, type KanbanLead } from "@/components/crm/kanban";
import { buttonVariants } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { canWrite, getContext } from "@/lib/auth";
import { getStages } from "@/lib/leads/service";

export const metadata = { title: "Funil de Vendas" };
const LIMIT = 500;

export default async function FunilPage() {
  const ctx = await getContext();
  const [stages, { data, error }] = await Promise.all([
    getStages(ctx.supabase, ctx.orgId),
    ctx.supabase.from("leads").select("id, company_name, city, state, score, score_priority, estimated_value, follow_up_at, stage_id").eq("organization_id", ctx.orgId).order("score", { ascending: false }).limit(LIMIT),
  ]);
  if (error) throw error;
  const leads = ((data ?? []) as KanbanLead[]).map((l) => ({ ...l, estimated_value: l.estimated_value === null ? null : Number(l.estimated_value) }));
  return (
    <>
      <PageHeader title="Funil de Vendas" description="Arraste os cartões entre as etapas ou use o seletor de cada lead. Toda mudança é registrada no histórico." />
      {leads.length >= LIMIT && <Alert variant="warning" className="mb-4" title="Exibindo os 500 leads de maior pontuação">Use o Meu CRM com filtros para ver os demais.</Alert>}
      {leads.length === 0 ? (
        <EmptyState icon={KanbanIcon} title="Nenhum lead no funil" description="Salve leads para acompanhá-los pelas etapas.">
          <Link href="/encontrar-leads" className={buttonVariants()}>Encontrar leads</Link>
        </EmptyState>
      ) : (
        <Kanban stages={stages} leads={leads} canWrite={canWrite(ctx.role)} />
      )}
    </>
  );
}
