"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { SERVICES } from "@/lib/constants";
import { DEFAULT_FORM_FIELDS, type FormFieldDef } from "@/lib/forms/schema";
import { deleteFormAction, saveFormAction } from "@/lib/forms/actions";
import { slugify } from "@/lib/utils";

export interface BuilderInitial {
  id: string | null;
  slug?: string;
  title: string;
  description: string;
  kind: string;
  service_interest: string;
  thank_you_message: string;
  thank_you_url: string;
  campaign_id: string;
  campaign_origin: string;
  privacy_notice: string;
  collect_comm_preferences: boolean;
  active: boolean;
  fields: FormFieldDef[];
}

export const NEW_FORM: BuilderInitial = {
  id: null, title: "", description: "", kind: "quote", service_interest: "", thank_you_message: "Obrigado! Recebemos seus dados e entraremos em contato em breve.", thank_you_url: "",
  campaign_id: "", campaign_origin: "", privacy_notice: "Usaremos seus dados apenas para responder a esta solicitação, conforme nossa política de privacidade.", collect_comm_preferences: true, active: true, fields: DEFAULT_FORM_FIELDS,
};

const KINDS = [["quote", "Solicitação de orçamento"], ["demo", "Agendamento de demonstração"], ["material", "Download de material"], ["newsletter", "Receber novidades"], ["diagnostic", "Diagnóstico gratuito"], ["webinar", "Inscrição em webinar"], ["contact", "Contato comercial"]] as const;
const TYPES = [["text", "Texto"], ["email", "E-mail"], ["phone", "Telefone"], ["textarea", "Texto longo"], ["select", "Lista de opções"], ["checkbox", "Caixa de seleção"]] as const;

function CopyBox({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <code className="block flex-1 overflow-x-auto whitespace-pre rounded-lg border border-border bg-muted/60 p-2.5 text-xs">{value}</code>
        <Button type="button" variant="secondary" size="icon" aria-label={`Copiar ${label}`} onClick={() => navigator.clipboard.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}>{ok ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}</Button>
      </div>
    </div>
  );
}

export function FormBuilder({ initial, campaigns, appUrl }: { initial: BuilderInitial; campaigns: { id: string; name: string }[]; appUrl: string }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState<{ id: string; slug: string } | null>(initial.id && initial.slug ? { id: initial.id, slug: initial.slug } : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof BuilderInitial>(k: K, v: BuilderInitial[K]) => setF((s) => ({ ...s, [k]: v }));
  const setField = (i: number, patch: Partial<FormFieldDef>) => setF((s) => ({ ...s, fields: s.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const move = (i: number, d: -1 | 1) => setF((s) => { const a = [...s.fields]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, fields: a }; });

  function addField() {
    set("fields", [...f.fields, { name: `campo_${f.fields.length + 1}`, label: "Novo campo", type: "text", required: false }]);
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveFormAction(f.id, { ...f, campaign_id: f.campaign_id || null, fields: f.fields.map((x) => ({ ...x, options: x.type === "select" ? x.options ?? [] : [] })) });
      if (!r.ok) return setError(r.error);
      toast.success("Formulário salvo.");
      setSaved(r.data!);
      if (!f.id) router.replace(`/formularios/${r.data!.id}`); else router.refresh();
    });
  }

  const link = saved ? `${appUrl}/f/${saved.slug}` : "";
  const embed = saved ? `<script src="${appUrl}/embed.js" data-leadfinder-form="${saved.slug}" async></script>` : "";

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {error && <Alert variant="danger">{error}</Alert>}
        <Card>
          <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Título *" className="sm:col-span-2"><Input value={f.title} maxLength={160} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Descrição" className="sm:col-span-2"><Textarea rows={2} value={f.description} maxLength={600} onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Tipo de formulário"><Select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            <Field label="Serviço de interesse"><Select value={f.service_interest} onChange={(e) => set("service_interest", e.target.value)}><option value="">—</option>{SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
            <Field label="Mensagem de agradecimento *" className="sm:col-span-2"><Input value={f.thank_you_message} maxLength={500} onChange={(e) => set("thank_you_message", e.target.value)} /></Field>
            <Field label="Página de agradecimento (URL opcional)" hint="Se informada, o visitante é redirecionado após o envio."><Input value={f.thank_you_url} placeholder="https://" onChange={(e) => set("thank_you_url", e.target.value)} /></Field>
            <Field label="Campanha associada"><Select value={f.campaign_id} onChange={(e) => set("campaign_id", e.target.value)}><option value="">Nenhuma</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Origem da campanha (rótulo)" hint="Ex.: landing-page-pizzarias"><Input value={f.campaign_origin} maxLength={120} onChange={(e) => set("campaign_origin", e.target.value)} /></Field>
            <Field label="Aviso de privacidade *" className="sm:col-span-2" hint="Exibido ao visitante junto da caixa de confirmação obrigatória."><Textarea rows={2} value={f.privacy_notice} maxLength={600} onChange={(e) => set("privacy_notice", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.collect_comm_preferences} onChange={(e) => set("collect_comm_preferences", e.target.checked)} /> Perguntar preferências de comunicação</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Formulário ativo</label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Campos</CardTitle><CardDescription>Peça somente o necessário. Campos chamados <code>nome</code>, <code>empresa</code>, <code>email</code> e <code>telefone</code> preenchem o lead; os demais ficam na observação.</CardDescription></div><Button size="sm" variant="secondary" onClick={addField} disabled={f.fields.length >= 20}><Plus className="h-3.5 w-3.5" aria-hidden /> Campo</Button></CardHeader>
          <CardContent className="space-y-3">
            {f.fields.map((fl, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-border bg-card-2/40 p-3 sm:grid-cols-12">
                <Field label="Rótulo" className="sm:col-span-4"><Input value={fl.label} onChange={(e) => { const label = e.target.value; setField(i, { label, ...(fl.name.startsWith("campo_") ? { name: slugify(label).replaceAll("-", "_").replace(/^[^a-z]+/, "c_").slice(0, 40) || fl.name } : {}) }); }} /></Field>
                <Field label="Nome interno" className="sm:col-span-3"><Input value={fl.name} onChange={(e) => setField(i, { name: e.target.value })} /></Field>
                <Field label="Tipo" className="sm:col-span-3"><Select value={fl.type} onChange={(e) => setField(i, { type: e.target.value as FormFieldDef["type"] })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
                <div className="flex items-end justify-between gap-2 sm:col-span-2">
                  <label className="flex items-center gap-1.5 pb-2 text-xs"><Checkbox checked={fl.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Obrig.</label>
                  <div className="flex pb-1"><button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label="Descer" onClick={() => move(i, 1)} className="rounded p-1 text-muted-foreground hover:bg-muted"><ArrowDown className="h-4 w-4" /></button><button type="button" aria-label="Remover campo" onClick={() => set("fields", f.fields.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button></div>
                </div>
                {fl.type === "select" && <Field label="Opções (separadas por vírgula)" className="sm:col-span-12"><Input value={(fl.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} /></Field>}
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <div>{initial.id && <Button variant="danger" size="sm" onClick={() => confirm("Excluir formulário e suas submissões?") && start(async () => { const r = await deleteFormAction(initial.id!); if (!r.ok) return void toast.error(r.error); router.push("/formularios"); })}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir</Button>}</div>
          <Button onClick={save} loading={pending}>Salvar formulário</Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><div><CardTitle>Publicação</CardTitle><CardDescription>Disponível após salvar.</CardDescription></div></CardHeader>
          <CardContent className="space-y-4">
            {saved ? (
              <>
                <CopyBox label="Link público" value={link} />
                <CopyBox label="Código de incorporação" value={embed} />
                <p className="text-xs text-muted-foreground">Cole o código onde o formulário deve aparecer. Os parâmetros UTM da página (utm_source, utm_campaign…) são capturados automaticamente.</p>
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Abrir formulário em nova aba</a>
              </>
            ) : <p className="text-sm text-muted-foreground">Salve o formulário para gerar o link e o código de incorporação.</p>}
          </CardContent>
        </Card>
        <Alert variant="info" title="Proteções ativas">Limite de envios por IP, campo armadilha (honeypot), validação no servidor, confirmação obrigatória do aviso de privacidade e registro de consentimento.</Alert>
      </div>
    </div>
  );
}
