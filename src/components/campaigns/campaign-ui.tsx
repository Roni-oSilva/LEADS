"use client";

import { SegmentOptions } from "@/components/ui/segment-options";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ListPlus, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { UF_LIST } from "@/lib/constants";
import { addLeadsToCampaignAction, deleteCampaignAction, generateCampaignTasksAction, removeLeadFromCampaignAction, saveCampaignAction, setCampaignStatusAction } from "@/lib/campaigns/actions";

export interface CampaignInitial {
  id?: string; name?: string; objective?: string | null; target_segment?: string | null; source_key?: string | null; status?: string; starts_at?: string | null; ends_at?: string | null; sequence?: string;
}

export function CampaignFormButton({ initial }: { initial?: CampaignInitial }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const editing = !!initial?.id;
  return (
    <>
      <Button variant={editing ? "secondary" : "default"} size={editing ? "sm" : "default"} onClick={() => setOpen(true)}>{editing ? <><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</> : <><Plus className="h-4 w-4" aria-hidden /> Nova campanha</>}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Editar campanha" : "Nova campanha"} className="max-w-xl">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
          start(async () => {
            const r = await saveCampaignAction(initial?.id ?? null, fd);
            if (!r.ok) return void toast.error(r.error);
            toast.success("Campanha salva."); setOpen(false);
            if (!editing && r.data) router.push(`/campanhas/${r.data.id}`); else router.refresh();
          });
        }}>
          <Field label="Nome *" className="sm:col-span-2"><Input name="name" required defaultValue={initial?.name} maxLength={120} /></Field>
          <Field label="Objetivo" className="sm:col-span-2"><Textarea name="objective" rows={2} defaultValue={initial?.objective ?? ""} maxLength={500} /></Field>
          <Field label="Segmento-alvo"><Select name="target_segment" defaultValue={initial?.target_segment ?? ""}><option value="">Todos</option><SegmentOptions /></Select></Field>
          <Field label="Origem dos leads"><Select name="source_key" defaultValue={initial?.source_key ?? ""}><option value="">Qualquer</option><option value="google_places">Google Places</option><option value="csv_import">Importação CSV</option><option value="form">Formulários</option><option value="manual">Manual</option></Select></Field>
          <Field label="Início"><Input type="date" name="starts_at" defaultValue={initial?.starts_at ?? ""} /></Field>
          <Field label="Encerramento"><Input type="date" name="ends_at" defaultValue={initial?.ends_at ?? ""} /></Field>
          <Field label="Status"><Select name="status" defaultValue={initial?.status ?? "draft"}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="paused">Pausada</option><option value="finished">Encerrada</option></Select></Field>
          <Field label="Sequência de acompanhamento" className="sm:col-span-2" hint="Uma etapa por linha no formato “dia|tarefa”. Ex.: 0|Primeiro contato · 3|Retornar se não houver resposta">
            <Textarea name="sequence" rows={4} defaultValue={initial?.sequence ?? ""} placeholder={"0|Primeiro contato\n3|Retornar se não houver resposta\n7|Última tentativa"} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={pending}>Salvar</Button></div>
        </form>
      </Dialog>
    </>
  );
}

export function CampaignStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select aria-label="Status da campanha" className="h-9 w-36" value={status} disabled={pending} onChange={(e) => start(async () => { const r = await setCampaignStatusAction(id, e.target.value); if (!r.ok) toast.error(r.error); else toast.success("Status atualizado."); router.refresh(); })}>
      <option value="draft">Rascunho</option><option value="active">Ativa</option><option value="paused">Pausada</option><option value="finished">Encerrada</option>
    </Select>
  );
}

export function AddLeadsForm({ campaignId, stages }: { campaignId: string; stages: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => {
        const r = await addLeadsToCampaignAction(campaignId, { segment: String(fd.get("segment") || "") || undefined, state: String(fd.get("state") || "") || undefined, city: String(fd.get("city") || "") || undefined, minScore: Number(fd.get("minScore")) || undefined, stageId: String(fd.get("stageId") || "") || undefined });
        if (!r.ok) return void toast.error(r.error);
        toast.success(`${r.data!.added} lead(s) associado(s) (leads “não contatar” são ignorados).`); router.refresh();
      });
    }}>
      <Field label="Segmento"><Select name="segment" defaultValue=""><option value="">Todos</option><SegmentOptions /></Select></Field>
      <Field label="Estado"><Select name="state" defaultValue=""><option value="">Todos</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      <Field label="Cidade"><Input name="city" /></Field>
      <Field label="Pontuação mínima"><Input name="minScore" type="number" min={0} max={100} placeholder="0" /></Field>
      <Field label="Etapa"><Select name="stageId" defaultValue=""><option value="">Todas</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <div className="sm:col-span-2 lg:col-span-5"><Button type="submit" size="sm" loading={pending}><ListPlus className="h-3.5 w-3.5" aria-hidden /> Associar leads (máx. 500)</Button></div>
    </form>
  );
}

export function GenerateTasksButton({ campaignId, disabled }: { campaignId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" loading={pending} disabled={disabled} onClick={() => start(async () => {
      const r = await generateCampaignTasksAction(campaignId);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data!.created} tarefa(s) criada(s)${r.data!.skipped ? ` · ${r.data!.skipped} lead(s) ignorado(s) por preferência de contato` : ""}.`); router.refresh();
    })}><Wand2 className="h-3.5 w-3.5" aria-hidden /> Gerar tarefas da sequência</Button>
  );
}

export function RemoveLeadButton({ campaignId, leadId }: { campaignId: string; leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button aria-label="Remover da campanha" disabled={pending} onClick={() => start(async () => { const r = await removeLeadFromCampaignAction(campaignId, leadId); if (!r.ok) toast.error(r.error); router.refresh(); })} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>;
}

export function DeleteCampaignButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="danger" size="sm" loading={pending} onClick={() => confirm("Excluir esta campanha? Os leads são mantidos.") && start(async () => { const r = await deleteCampaignAction(id); if (!r.ok) return void toast.error(r.error); toast.success("Campanha excluída."); router.push("/campanhas"); })}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir</Button>;
}
