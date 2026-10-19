"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { CalendarClock, GripVertical, LayoutGrid, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/form-controls";
import { ScoreBadge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { moveStageAction } from "@/lib/leads/actions";

export interface KanbanLead {
  id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  score: number;
  score_priority: string;
  estimated_value: number | null;
  follow_up_at: string | null;
  stage_id: string | null;
}
export interface KanbanStage {
  id: string;
  name: string;
  key: string;
}

export function Kanban({ stages, leads, canWrite }: { stages: KanbanStage[]; leads: KanbanLead[]; canWrite: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "table">("board");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(leads, (state, p: { id: string; stageId: string }) => state.map((l) => (l.id === p.id ? { ...l, stage_id: p.stageId } : l)));

  function moveTo(id: string, stageId: string) {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead || lead.stage_id === stageId) return;
    start(async () => {
      move({ id, stageId });
      const r = await moveStageAction(id, stageId);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  const tabBtn = (v: "board" | "table", label: string, Icon: React.ElementType) => (
    <button onClick={() => setView(v)} aria-pressed={view === v} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === v ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">{tabBtn("board", "Quadro", LayoutGrid)}{tabBtn("table", "Tabela", Table2)}</div>

      {view === "board" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {stages.map((stage) => {
            const items = optimistic.filter((l) => l.stage_id === stage.id);
            const total = items.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
            return (
              <section
                key={stage.id}
                aria-label={stage.name}
                onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOverStage(stage.id); } }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); setOverStage(null); const id = e.dataTransfer.getData("text/plain") || dragId; if (id) moveTo(id, stage.id); setDragId(null); }}
                className={cn("flex max-h-[70vh] w-72 shrink-0 flex-col rounded-xl border bg-card/60 transition-colors", overStage === stage.id ? "border-primary bg-primary-soft/40" : "border-border")}
              >
                <header className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2"><h2 className="text-xs font-semibold">{stage.name}</h2><Badge>{items.length}</Badge></div>
                  {total > 0 && <span className="text-[11px] text-muted-foreground">{formatCurrency(total)}</span>}
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {items.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">Nenhum lead</p>}
                  {items.map((l) => (
                    <article
                      key={l.id}
                      draggable={canWrite}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; setDragId(l.id); }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      className={cn("rounded-lg border border-border bg-card-2 p-3 text-sm shadow-sm transition-opacity", dragId === l.id && "opacity-40", canWrite && "cursor-grab active:cursor-grabbing")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/crm/${l.id}`} className="font-medium leading-tight hover:text-primary">{l.company_name}</Link>
                        <div className="flex items-center gap-1">{canWrite && <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />}<ScoreBadge score={l.score} priority={l.score_priority} /></div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{[l.city, l.state].filter(Boolean).join("/") || "—"}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{l.estimated_value ? formatCurrency(l.estimated_value) : ""}</span>
                        {l.follow_up_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" aria-hidden />{formatDate(l.follow_up_at)}</span>}
                      </div>
                      {canWrite && (
                        <Select aria-label={`Mover ${l.company_name}`} className="mt-2 h-7 text-[11px]" value={l.stage_id ?? ""} onChange={(e) => moveTo(l.id, e.target.value)}>
                          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <THead><TR><TH>Empresa</TH><TH>Cidade/UF</TH><TH>Pontuação</TH><TH>Valor</TH><TH>Retorno</TH><TH>Etapa</TH></TR></THead>
            <TBody>
              {optimistic.map((l) => (
                <TR key={l.id}>
                  <TD><Link href={`/crm/${l.id}`} className="font-medium hover:text-primary">{l.company_name}</Link></TD>
                  <TD className="text-xs">{[l.city, l.state].filter(Boolean).join("/") || "—"}</TD>
                  <TD><ScoreBadge score={l.score} priority={l.score_priority} /></TD>
                  <TD className="text-xs">{l.estimated_value ? formatCurrency(l.estimated_value) : "—"}</TD>
                  <TD className="text-xs">{formatDate(l.follow_up_at)}</TD>
                  <TD><Select aria-label={`Etapa de ${l.company_name}`} className="h-8 w-48 text-xs" disabled={!canWrite} value={l.stage_id ?? ""} onChange={(e) => moveTo(l.id, e.target.value)}>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
