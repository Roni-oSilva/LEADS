"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Download, ExternalLink, Globe, ScanSearch, Star, Trash2 } from "lucide-react";
import { Instagram } from "@/components/ui/icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/form-controls";
import { ScoreBadge } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { WhatsAppButton } from "./whatsapp-button";
import { segmentLabel } from "@/lib/segments";
import { formatDate } from "@/lib/utils";
import { analyzeLeadsAction, deleteLeadsAction, moveStageAction, toggleFavoriteAction } from "@/lib/leads/actions";

export interface LeadRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  rating: number | null;
  reviews_count: number | null;
  score: number;
  score_priority: string;
  favorite: boolean;
  do_not_contact: boolean;
  discovered_at: string;
  stage: { id: string; name: string; key: string } | null;
  follow_up_at: string | null;
}

const STAGE_VARIANT: Record<string, "default" | "primary" | "success" | "warning" | "danger" | "info"> = {
  new: "default", analyzed: "info", qualified: "primary", first_contact: "info", negotiating: "warning", meeting: "warning", proposal: "warning", won: "success", lost: "danger", do_not_contact: "danger",
};

export function LeadsTable({ rows, stages, template, canWrite, sortLinks }: { rows: LeadRow[]; stages: { id: string; name: string }[]; template: string; canWrite: boolean; sortLinks: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function run(fn: () => Promise<{ ok: boolean; error?: string } | { ok: true }>, ok: string) {
    start(async () => {
      const r = (await fn()) as { ok: boolean; error?: string };
      if (!r.ok) toast.error(r.error ?? "Falha na operação.");
      else { toast.success(ok); setSelected(new Set()); router.refresh(); }
    });
  }

  return (
    <div>
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft px-4 py-2.5 text-sm">
          <span className="font-medium">{ids.length} selecionado(s)</span>
          <form action="/api/leads/export" method="post" target="_blank">
            <input type="hidden" name="ids" value={JSON.stringify(ids)} />
            <Button type="submit" variant="secondary" size="sm"><Download className="h-3.5 w-3.5" aria-hidden /> Exportar CSV</Button>
          </form>
          {canWrite && (
            <>
              <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => analyzeLeadsAction(ids, false), "Análise concluída.")}><ScanSearch className="h-3.5 w-3.5" aria-hidden /> Analisar</Button>
              <Select className="h-8 w-44 text-xs" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) run(async () => { for (const id of ids) { const r = await moveStageAction(id, v); if (!r.ok) return r; } return { ok: true }; }, "Leads movidos."); }} aria-label="Mover para etapa">
                <option value="">Mover para etapa…</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Button size="sm" variant="danger" loading={pending} onClick={() => confirm(`Excluir ${ids.length} lead(s)? Esta ação não pode ser desfeita.`) && run(() => deleteLeadsAction(ids), "Leads excluídos.")}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir</Button>
            </>
          )}
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Limpar seleção</button>
        </div>
      )}
      <div className="hidden md:block">
      <Table>
        <THead>
          <TR>
            <TH className="w-10"><Checkbox aria-label="Selecionar todos" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} /></TH>
            <TH><Link href={sortLinks.company_name} className="hover:text-foreground">Empresa</Link></TH>
            <TH>Segmento</TH>
            <TH><Link href={sortLinks.city} className="hover:text-foreground">Cidade/UF</Link></TH>
            <TH>Telefone</TH>
            <TH>Presença digital</TH>
            <TH>Avaliação</TH>
            <TH><Link href={sortLinks.score} className="hover:text-foreground">Pontuação</Link></TH>
            <TH>Etapa</TH>
            <TH><Link href={sortLinks.created_at} className="hover:text-foreground">Descoberta</Link></TH>
            <TH className="text-right">Ações</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const phone = r.whatsapp || r.phone;
            return (
              <TR key={r.id} className={selected.has(r.id) ? "bg-primary-soft/50" : undefined}>
                <TD><Checkbox aria-label={`Selecionar ${r.company_name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></TD>
                <TD>
                  <Link href={`/crm/${r.id}`} className="font-medium hover:text-primary">{r.company_name}</Link>
                  {r.contact_name && <p className="text-xs text-muted-foreground">{r.contact_name}</p>}
                </TD>
                <TD className="text-xs text-muted-foreground">{segmentLabel(r.segment)}</TD>
                <TD className="whitespace-nowrap text-xs">{[r.city, r.state].filter(Boolean).join("/") || "—"}</TD>
                <TD className="whitespace-nowrap text-xs">{phone || "—"}</TD>
                <TD>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" aria-label="Abrir site" className="hover:text-primary"><Globe className="h-4 w-4" /></a> : <span title="Site não identificado" className="opacity-30"><Globe className="h-4 w-4" /></span>}
                    {r.instagram ? <a href={r.instagram.startsWith("http") ? r.instagram : `https://instagram.com/${r.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram" className="hover:text-primary"><Instagram className="h-4 w-4" /></a> : <span title="Instagram não identificado" className="opacity-30"><Instagram className="h-4 w-4" /></span>}
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-xs">{r.rating ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" aria-hidden />{r.rating.toFixed(1)}<span className="text-muted-foreground">({r.reviews_count ?? 0})</span></span> : "—"}</TD>
                <TD><ScoreBadge score={r.score} priority={r.score_priority} /></TD>
                <TD>{r.stage && <Badge variant={STAGE_VARIANT[r.stage.key] ?? "default"}>{r.stage.name}</Badge>}</TD>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.discovered_at)}</TD>
                <TD>
                  <div className="flex items-center justify-end gap-0.5">
                    {canWrite && (
                      <button aria-label={r.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => run(() => toggleFavoriteAction(r.id, !r.favorite), r.favorite ? "Removido dos favoritos." : "Adicionado aos favoritos.")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                        <Star className={r.favorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
                      </button>
                    )}
                    <WhatsAppButton leadId={r.id} company={r.company_name} contact={r.contact_name} phone={phone} template={template} blockedReason={r.do_not_contact ? "Lead marcado como não contatar" : null} />
                    <Link href={`/crm/${r.id}`} aria-label="Ver detalhes" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></Link>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      </div>

      {/* Cartões (celular) */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => {
          const phone = r.whatsapp || r.phone;
          return (
            <li key={r.id} className="space-y-2.5 p-4">
              <div className="flex items-start gap-3">
                <Checkbox className="mt-1" aria-label={`Selecionar ${r.company_name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <div className="min-w-0 flex-1">
                  <Link href={`/crm/${r.id}`} className="font-medium leading-tight">{r.company_name}</Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{[segmentLabel(r.segment) !== "—" ? segmentLabel(r.segment) : null, [r.city, r.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</p>
                </div>
                <ScoreBadge score={r.score} priority={r.score_priority} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs text-muted-foreground">
                <span>{phone || "Sem telefone"}</span>
                {r.stage && <Badge variant={STAGE_VARIANT[r.stage.key] ?? "default"}>{r.stage.name}</Badge>}
                <span>{formatDate(r.discovered_at)}</span>
              </div>
              <div className="-ml-1 flex items-center pl-7">
                {canWrite && <button aria-label={r.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => run(() => toggleFavoriteAction(r.id, !r.favorite), r.favorite ? "Removido dos favoritos." : "Adicionado aos favoritos.")} className="rounded-md p-2 text-muted-foreground hover:bg-muted"><Star className={r.favorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} /></button>}
                <WhatsAppButton leadId={r.id} company={r.company_name} contact={r.contact_name} phone={phone} template={template} blockedReason={r.do_not_contact ? "Lead marcado como não contatar" : null} />
                <Link href={`/crm/${r.id}`} aria-label="Ver detalhes" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
