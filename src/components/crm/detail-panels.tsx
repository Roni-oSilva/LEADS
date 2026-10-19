"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCheck, Pencil, ScanSearch, ShieldCheck, Trash2, Reply, Phone, Mail, CalendarCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { LeadForm } from "./lead-form";
import { addNoteAction, analyzeLeadAction, deleteLeadsAction, moveStageAction, setConsentAction, setFollowUpAction } from "@/lib/leads/actions";
import { registerContactAction } from "@/lib/whatsapp/actions";
import type { LeadInput } from "@/lib/leads/schema";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Falha na operação.");
      else { toast.success(success); after?.(); router.refresh(); }
    });
  return { pending, act, router };
}

export function StageSelect({ leadId, stageId, stages, disabled }: { leadId: string; stageId: string | null; stages: { id: string; name: string }[]; disabled?: boolean }) {
  const { pending, act } = useAct();
  return (
    <Select aria-label="Etapa do funil" className="h-9 w-52" value={stageId ?? ""} disabled={disabled || pending} onChange={(e) => act(() => moveStageAction(leadId, e.target.value), "Etapa atualizada.")}>
      {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </Select>
  );
}

export function EditLeadButton({ leadId, initial, members }: { leadId: string; initial: Record<string, string | number | null>; members: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar lead" className="max-w-2xl">
        <LeadForm leadId={leadId} initial={initial as Partial<Record<keyof LeadInput, string | number | null>>} members={members} onDone={() => { setOpen(false); router.refresh(); }} />
      </Dialog>
    </>
  );
}

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const { pending, act, router } = useAct();
  return (
    <Button variant="danger" size="sm" loading={pending} onClick={() => confirm("Excluir este lead e todo o histórico? Esta ação não pode ser desfeita.") && act(() => deleteLeadsAction([leadId]), "Lead excluído.", () => router.push("/crm"))}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
    </Button>
  );
}

export function AnalyzeButtons({ leadId, hasWebsite, disabled }: { leadId: string; hasWebsite: boolean; disabled?: boolean }) {
  const { pending, act } = useAct();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" loading={pending} disabled={disabled} onClick={() => act(() => analyzeLeadAction(leadId, false), "Análise concluída.")}><ScanSearch className="h-3.5 w-3.5" aria-hidden /> Analisar oportunidades</Button>
      <Button size="sm" variant="secondary" loading={pending} disabled={disabled || !hasWebsite} title={hasWebsite ? "Faz 1 requisição pública à página inicial do site" : "Sem site cadastrado"} onClick={() => act(() => analyzeLeadAction(leadId, true), "Site verificado e análise concluída.")}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verificar site
      </Button>
    </div>
  );
}

export function ContactLog({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const { pending, act } = useAct();
  const [summary, setSummary] = useState("");
  const btn = (type: Parameters<typeof registerContactAction>[1], label: string, Icon: React.ElementType) => (
    <Button size="sm" variant="secondary" disabled={disabled || pending} onClick={() => act(() => registerContactAction(leadId, type, summary), `${label} registrado.`, () => setSummary(""))}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
    </Button>
  );
  return (
    <div className="space-y-3">
      <Input placeholder="Resumo opcional (ex.: pediu orçamento, retornar sexta)" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={400} aria-label="Resumo do contato" />
      <div className="flex flex-wrap gap-2">
        {btn("contact_done", "Contato realizado", CheckCheck)}
        {btn("whatsapp_response", "Resposta recebida", Reply)}
        {btn("call", "Ligação", Phone)}
        {btn("email", "E-mail", Mail)}
        {btn("meeting", "Reunião", CalendarCheck)}
        {btn("proposal", "Proposta enviada", FileText)}
      </div>
    </div>
  );
}

export function NoteForm({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const { pending, act } = useAct();
  const [body, setBody] = useState("");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(() => addNoteAction(leadId, body), "Observação salva.", () => setBody("")); }}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Registrar observação…" rows={3} maxLength={5000} disabled={disabled} aria-label="Nova observação" />
      <Button type="submit" size="sm" loading={pending} disabled={disabled || !body.trim()}>Salvar observação</Button>
    </form>
  );
}

export function FollowUpForm({ leadId, nextAction, followUpAt, disabled }: { leadId: string; nextAction: string | null; followUpAt: string | null; disabled?: boolean }) {
  const { pending, act } = useAct();
  const [action, setAction] = useState(nextAction ?? "");
  const [date, setDate] = useState(followUpAt ? followUpAt.slice(0, 10) : "");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => setFollowUpAction(leadId, action, date ? new Date(`${date}T12:00:00-03:00`).toISOString() : null), "Próxima ação salva e tarefa criada."); }}>
      <Field label="Próxima ação"><Input value={action} onChange={(e) => setAction(e.target.value)} maxLength={300} disabled={disabled} /></Field>
      <Field label="Data de retorno"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} /></Field>
      <Button type="submit" size="sm" loading={pending} disabled={disabled}>Salvar</Button>
    </form>
  );
}

export function PrivacyForm({ leadId, basis, prefs, disabled }: { leadId: string; basis: string | null; prefs: { allow_whatsapp: boolean; allow_email: boolean; allow_phone: boolean }; disabled?: boolean }) {
  const { pending, act } = useAct();
  const [b, setB] = useState(basis ?? "legitimate_interest");
  const [p, setP] = useState(prefs);
  const [evidence, setEvidence] = useState("");
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => setConsentAction(leadId, { basis: b as "consent", ...p, evidence }), "Preferências registradas."); }}>
      <Field label="Base legal aplicável" hint="Registre a base legal usada para esta abordagem comercial.">
        <Select value={b} onChange={(e) => setB(e.target.value)} disabled={disabled}>
          <option value="legitimate_interest">Legítimo interesse</option>
          <option value="consent">Consentimento</option>
          <option value="contract">Execução de contrato</option>
          <option value="other">Outra</option>
        </Select>
      </Field>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Canais autorizados</legend>
        {([["allow_whatsapp", "WhatsApp"], ["allow_email", "E-mail"], ["allow_phone", "Telefone"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2"><Checkbox checked={p[k]} disabled={disabled} onChange={(e) => setP({ ...p, [k]: e.target.checked })} /> {label}</label>
        ))}
      </fieldset>
      <Field label="Evidência / observação (opcional)"><Input value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={500} disabled={disabled} placeholder="Ex.: respondeu ao formulário em 12/10" /></Field>
      <Button type="submit" size="sm" loading={pending} disabled={disabled}>Registrar</Button>
    </form>
  );
}
