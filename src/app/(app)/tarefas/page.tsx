import Link from "next/link";
import { CalendarClock, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { NewTaskButton, TaskCheck, TaskDelete } from "@/components/tasks/task-ui";
import { canWrite, getContext } from "@/lib/auth";
import { first, type Sp } from "@/lib/leads/query";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Tarefas e Retornos" };
const TYPE: Record<string, string> = { follow_up: "Retorno", call: "Ligação", whatsapp: "WhatsApp", email: "E-mail", meeting: "Reunião", proposal: "Proposta", other: "Outro" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const ctx = await getContext();
  const filter = first((await searchParams).f) ?? "pending";
  const now = new Date().toISOString();
  let q = ctx.supabase.from("tasks").select("id, title, type, due_at, done_at, lead:leads(id, company_name)").eq("organization_id", ctx.orgId);
  if (filter === "done") q = q.not("done_at", "is", null).order("done_at", { ascending: false });
  else {
    q = q.is("done_at", null).order("due_at", { ascending: true, nullsFirst: false });
    if (filter === "overdue") q = q.lt("due_at", now);
  }
  const [{ data: tasks, error }, { data: leads }] = await Promise.all([q.limit(200), ctx.supabase.from("leads").select("id, company_name").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(300)]);
  if (error) throw error;
  type Row = { id: string; title: string; type: string; due_at: string | null; done_at: string | null; lead: { id: string; company_name: string } | null };
  const rows = (tasks ?? []) as unknown as Row[];
  const write = canWrite(ctx.role);
  const tab = (key: string, label: string) => <Link key={key} href={`/tarefas?f=${key}`} aria-current={filter === key ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", filter === key ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</Link>;
  return (
    <>
      <PageHeader title="Tarefas e Retornos" description="Controle os retornos agendados e as ações de acompanhamento." actions={write ? <NewTaskButton leads={(leads ?? []).map((l) => ({ id: l.id, name: l.company_name }))} /> : undefined} />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">{tab("pending", "Pendentes")}{tab("overdue", "Atrasadas")}{tab("done", "Concluídas")}</div>
      <Card>
        {rows.length === 0 ? <EmptyState icon={ListChecks} title={filter === "done" ? "Nenhuma tarefa concluída" : "Nenhuma tarefa por aqui"} description="Defina uma próxima ação com data de retorno no detalhe de um lead, ou crie uma tarefa." /> : (
          <ul className="divide-y divide-border">
            {rows.map((t) => {
              const overdue = !t.done_at && t.due_at && t.due_at < now;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <TaskCheck id={t.id} done={!!t.done_at} title={t.title} disabled={!write} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", t.done_at && "text-muted-foreground line-through")}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.lead ? <Link href={`/crm/${t.lead.id}`} className="hover:text-primary">{t.lead.company_name}</Link> : "Sem lead"}</p>
                  </div>
                  <Badge className="hidden sm:inline-flex">{TYPE[t.type] ?? t.type}</Badge>
                  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", overdue ? "text-danger" : "text-muted-foreground")}><CalendarClock className="h-3.5 w-3.5" aria-hidden />{formatDate(t.due_at)}{overdue && " · atrasada"}</span>
                  <TaskDelete id={t.id} disabled={!write} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
