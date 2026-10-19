"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { CRITERIA, type Weights } from "@/lib/scoring";
import { SEGMENTS, UF_LIST } from "@/lib/constants";
import { DEFAULT_WHATSAPP_TEMPLATE, renderTemplate } from "@/lib/whatsapp/link";
import { saveWhatsAppTemplateAction } from "@/lib/whatsapp/actions";
import { removeFromSuppressionAction } from "@/lib/leads/actions";
import { addSuppressionAction, changeMemberRoleAction, createInviteAction, deleteInviteAction, eraseSubjectDataAction, removeMemberAction, resolveDsarAction, saveScoringAction, updateOrgAction, updateProfileAction } from "@/lib/settings/actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success: string) =>
    start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error ?? "Falha."); else { toast.success(r.message ?? success); router.refresh(); } });
  return { pending, run };
}

export function ProfileForm({ initial }: { initial: { full_name: string; phone: string; email: string; notify_followups: boolean; notify_form_submissions: boolean; notify_weekly_summary: boolean } }) {
  const { pending, run } = useRun();
  const [v, setV] = useState(initial);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => updateProfileAction(v), "Perfil atualizado."); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome"><Input value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} maxLength={100} /></Field>
        <Field label="E-mail"><Input value={v.email} disabled /></Field>
        <Field label="Telefone"><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} maxLength={30} /></Field>
      </div>
      <fieldset className="space-y-2 text-sm"><legend className="mb-1 text-xs font-medium text-muted-foreground">Preferências de notificação</legend>
        {([["notify_followups", "Lembretes de retornos e tarefas"], ["notify_form_submissions", "Novos envios de formulários"], ["notify_weekly_summary", "Resumo semanal de desempenho"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><Checkbox checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} /> {l}</label>)}
        <p className="text-[11px] text-muted-foreground">Preferências registradas; o envio de notificações por e-mail depende de integração de e-mail transacional (não incluída nesta versão).</p>
      </fieldset>
      <Button type="submit" size="sm" loading={pending}>Salvar perfil</Button>
    </form>
  );
}

export function OrgForm({ name, disabled }: { name: string; disabled: boolean }) {
  const { pending, run } = useRun();
  const [v, setV] = useState(name);
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => updateOrgAction(v), "Organização atualizada."); }}>
      <Field label="Nome da organização" className="min-w-64 flex-1"><Input value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} maxLength={120} /></Field>
      <Button type="submit" size="sm" loading={pending} disabled={disabled}>Salvar</Button>
    </form>
  );
}

export function ScoringForm({ weights, targetSegments, targetStates, targetCities, disabled }: { weights: Weights; targetSegments: string[]; targetStates: string[]; targetCities: string[]; disabled: boolean }) {
  const { pending, run } = useRun();
  const [w, setW] = useState<Record<string, number>>({ ...weights });
  const [segs, setSegs] = useState(targetSegments);
  const [states, setStates] = useState(targetStates);
  const [cities, setCities] = useState(targetCities.join(", "));
  const [recalc, setRecalc] = useState(true);
  const total = Object.values(w).reduce((s, n) => s + (Number(n) || 0), 0);
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); run(() => saveScoringAction({ weights: w, targetSegments: segs, targetStates: states, targetCities: cities.split(",").map((c) => c.trim()).filter(Boolean), recalc }), "Critérios salvos."); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {CRITERIA.map((c) => <Field key={c.key} label={`${c.label} (peso)`}><Input type="number" min={0} max={100} value={w[c.key]} disabled={disabled} onChange={(e) => setW({ ...w, [c.key]: Number(e.target.value) })} /></Field>)}
      </div>
      <p className="text-xs text-muted-foreground">Soma atual: {total}. Os pesos são normalizados automaticamente para totalizar 100.</p>
      <Field label="Segmentos-alvo (vazio = todos)">
        <div className="grid gap-1.5 sm:grid-cols-2">{SEGMENTS.map((s) => <label key={s.value} className="flex items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={segs.includes(s.value)} onChange={(e) => setSegs(e.target.checked ? [...segs, s.value] : segs.filter((x) => x !== s.value))} /> {s.label}</label>)}</div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estados-alvo (Ctrl/Cmd para vários)"><select multiple size={6} disabled={disabled} value={states} onChange={(e) => setStates([...e.target.selectedOptions].map((o) => o.value))} className="w-full rounded-lg border border-border bg-muted/60 p-2 text-sm">{UF_LIST.map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Cidades-alvo (separadas por vírgula)"><Textarea rows={5} value={cities} disabled={disabled} onChange={(e) => setCities(e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={recalc} onChange={(e) => setRecalc(e.target.checked)} disabled={disabled} /> Recalcular pontuação dos leads existentes (até 300)</label>
      <Button type="submit" size="sm" loading={pending} disabled={disabled}>Salvar critérios</Button>
    </form>
  );
}

export function WhatsAppTemplateForm({ template, disabled }: { template: string; disabled: boolean }) {
  const { pending, run } = useRun();
  const [v, setV] = useState(template);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveWhatsAppTemplateAction(v), "Modelo salvo."); }}>
      <Field label="Mensagem inicial padrão" hint="Variáveis: {{empresa}}, {{contato}}, {{servico}}, {{servico_frase}}, {{portfolio}}. O usuário pode editar antes de cada contato."><Textarea rows={7} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} maxLength={1500} /></Field>
      <div className="rounded-lg border border-border bg-card-2/50 p-3"><p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Prévia</p><p className="whitespace-pre-wrap text-sm">{renderTemplate(v, { empresa: "Pizzaria Bella", servico: "cardapio_digital" })}</p></div>
      <div className="flex gap-2"><Button type="submit" size="sm" loading={pending} disabled={disabled}>Salvar modelo</Button><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => setV(DEFAULT_WHATSAPP_TEMPLATE)}>Restaurar padrão</Button></div>
    </form>
  );
}

export function MemberRow({ userId, role, isSelf, disabled }: { userId: string; role: string; isSelf: boolean; disabled: boolean }) {
  const { pending, run } = useRun();
  if (role === "owner" || isSelf || disabled) return <span className="text-xs text-muted-foreground">{role === "owner" ? "Proprietário" : isSelf ? "Você" : "—"}</span>;
  return (
    <div className="flex items-center gap-2">
      <Select aria-label="Perfil de acesso" className="h-8 w-36 text-xs" value={role} disabled={pending} onChange={(e) => run(() => changeMemberRoleAction(userId, e.target.value), "Perfil atualizado.")}>
        <option value="admin">Administrador</option><option value="member">Membro</option><option value="viewer">Somente leitura</option>
      </Select>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => confirm("Remover este membro da organização?") && run(() => removeMemberAction(userId), "Membro removido.")}>Remover</Button>
    </div>
  );
}

export function InviteForm() {
  const { pending, run } = useRun();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createInviteAction(email, role); if (r.ok) setEmail(""); return r; }, "Convite registrado."); }}>
      <Field label="E-mail do convidado" className="min-w-56 flex-1"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="Perfil"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">Administrador</option><option value="member">Membro</option><option value="viewer">Somente leitura</option></Select></Field>
      <Button type="submit" size="sm" loading={pending}>Convidar</Button>
    </form>
  );
}

export function InviteDelete({ id }: { id: string }) {
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteInviteAction(id), "Convite removido.")}>Cancelar convite</Button>;
}

export function SuppressionForm({ disabled }: { disabled: boolean }) {
  const { pending, run } = useRun();
  const [kind, setKind] = useState<"email" | "phone" | "domain">("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await addSuppressionAction(kind, value, reason); if (r.ok) { setValue(""); setReason(""); } return r; }, "Adicionado à lista de supressão."); }}>
      <Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="email">E-mail</option><option value="phone">Telefone</option><option value="domain">Domínio</option></Select></Field>
      <Field label="Valor" className="min-w-52 flex-1"><Input value={value} onChange={(e) => setValue(e.target.value)} required /></Field>
      <Field label="Motivo" className="min-w-40 flex-1"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
      <Button type="submit" size="sm" loading={pending} disabled={disabled}>Adicionar</Button>
    </form>
  );
}

export function SuppressionRemove({ id, disabled }: { id: string; disabled: boolean }) {
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending || disabled} onClick={() => confirm("Remover da lista de supressão? Só faça isso com base legítima (ex.: novo consentimento).") && run(() => removeFromSuppressionAction(id), "Removido.")}>Remover</Button>;
}

export function EraseForm() {
  const { pending, run } = useRun();
  const [v, setV] = useState("");
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!confirm(`Excluir definitivamente todos os leads vinculados a “${v}” e impedir novos contatos?`)) return; run(async () => { const r = await eraseSubjectDataAction(v); if (r.ok) setV(""); return r.ok ? { ...r, message: `${(r as { data?: { deleted: number } }).data?.deleted ?? 0} lead(s) excluído(s); contato incluído na lista de supressão.` } : r; }, "Dados excluídos."); }}>
      <Field label="E-mail ou telefone do titular" className="min-w-64 flex-1"><Input value={v} onChange={(e) => setV(e.target.value)} required /></Field>
      <Button type="submit" size="sm" variant="danger" loading={pending}>Excluir dados do titular</Button>
      <a className="text-xs text-primary hover:underline" href={v ? `/api/dsar/export?q=${encodeURIComponent(v)}` : undefined} aria-disabled={!v}>Exportar dados (JSON)</a>
    </form>
  );
}

export function DsarActions({ id, status }: { id: string; status: string }) {
  const { pending, run } = useRun();
  const [res, setRes] = useState("");
  if (status === "done" || status === "rejected") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Resolução" className="h-8 w-56 text-xs" placeholder="Resolução / observação" value={res} onChange={(e) => setRes(e.target.value)} />
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => resolveDsarAction(id, "in_progress", res), "Em andamento.")}>Em andamento</Button>
      <Button size="sm" disabled={pending} onClick={() => run(() => resolveDsarAction(id, "done", res), "Concluída.")}>Concluir</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveDsarAction(id, "rejected", res), "Rejeitada.")}>Rejeitar</Button>
    </div>
  );
}
