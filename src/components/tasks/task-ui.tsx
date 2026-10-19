"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/dialog";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/lib/tasks/actions";

export function NewTaskButton({ leads }: { leads: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Nova tarefa</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nova tarefa">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await createTaskAction({ title: fd.get("title"), type: fd.get("type"), due: fd.get("due"), lead_id: fd.get("lead_id") });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Tarefa criada."); setOpen(false); router.refresh();
          });
        }}>
          <Field label="Título"><Input name="title" required maxLength={200} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><Select name="type"><option value="follow_up">Retorno</option><option value="call">Ligação</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="proposal">Proposta</option><option value="other">Outro</option></Select></Field>
            <Field label="Data"><Input name="due" type="date" /></Field>
          </div>
          <Field label="Lead (opcional)"><Select name="lead_id" defaultValue=""><option value="">Sem lead</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={pending}>Criar</Button></div>
        </form>
      </Dialog>
    </>
  );
}

export function TaskCheck({ id, done, title, disabled }: { id: string; done: boolean; title: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Checkbox aria-label={`${done ? "Reabrir" : "Concluir"}: ${title}`} checked={done} disabled={pending || disabled} onChange={(e) => start(async () => { const r = await toggleTaskAction(id, e.target.checked); if (!r.ok) toast.error(r.error); router.refresh(); })} />;
}

export function TaskDelete({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button aria-label="Excluir tarefa" disabled={pending || disabled} onClick={() => start(async () => { const r = await deleteTaskAction(id); if (!r.ok) toast.error(r.error); router.refresh(); })} className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>;
}
