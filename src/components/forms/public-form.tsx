"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import type { FormFieldDef } from "@/lib/forms/schema";
import { UTM_KEYS } from "@/lib/forms/schema";

interface Props {
  slug: string;
  title: string;
  description: string | null;
  privacyNotice: string;
  collectPrefs: boolean;
  fields: FormFieldDef[];
  embedded?: boolean;
}

export function PublicForm({ slug, title, description, privacyNotice, collectPrefs, fields, embedded }: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [prefs, setPrefs] = useState({ whatsapp: true, email: true, phone: false });
  const [privacy, setPrivacy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState("");
  const rendered = useRef(0);
  useEffect(() => { rendered.current = Date.now(); }, []);
  const hp = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // Informa a altura ao script de incorporação.
  useEffect(() => {
    if (!embedded) return;
    const send = () => window.parent?.postMessage({ type: "leadfinder:height", slug, height: root.current?.scrollHeight ?? 0 }, "*");
    send();
    const ro = new ResizeObserver(send);
    if (root.current) ro.observe(root.current);
    return () => ro.disconnect();
  }, [embedded, slug, status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      if (f.required && (f.type === "checkbox" ? values[f.name] !== true : !String(values[f.name] ?? "").trim())) return setError(`Preencha: ${f.label}`);
    }
    if (!privacy) return setError("Confirme que leu o aviso de privacidade.");
    setStatus("sending");
    const q = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(UTM_KEYS.filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
    try {
      const res = await fetch(`/api/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values, utm, ref: q.get("ref") ?? document.referrer, prefs, privacy: true, hp: hp.current?.value ?? "", t: rendered.current }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Não foi possível enviar.");
      setThanks(json.message);
      setStatus("done");
      if (json.redirect) window.setTimeout(() => { window.location.href = json.redirect; }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
      setStatus("idle");
    }
  }

  return (
    <div ref={root} className={embedded ? "p-4" : "mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"}>
      {status === "done" ? (
        <div className="py-8 text-center" role="status">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" aria-hidden />
          <p className="text-lg font-semibold">Recebemos seus dados</p>
          <p className="mt-2 text-sm text-muted-foreground">{thanks}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
          {fields.map((f) => (
            <div key={f.name}>
              {f.type !== "checkbox" && <Label htmlFor={`f-${f.name}`}>{f.label}{f.required && " *"}</Label>}
              {f.type === "textarea" ? <Textarea id={`f-${f.name}`} rows={3} maxLength={2000} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                : f.type === "select" ? <Select id={`f-${f.name}`} defaultValue="" onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}><option value="">Selecione…</option>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</Select>
                : f.type === "checkbox" ? <label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} /> {f.label}{f.required && " *"}</label>
                : <Input id={`f-${f.name}`} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} autoComplete={f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.name === "nome" ? "name" : f.name === "empresa" ? "organization" : "off"} maxLength={200} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />}
            </div>
          ))}
          {/* Honeypot: invisível para pessoas */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Não preencha<input ref={hp} tabIndex={-1} autoComplete="off" /></label></div>
          {collectPrefs && (
            <fieldset className="rounded-lg border border-border p-3">
              <legend className="px-1 text-xs text-muted-foreground">Como podemos falar com você?</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {([["whatsapp", "WhatsApp"], ["email", "E-mail"], ["phone", "Telefone"]] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2"><Checkbox checked={prefs[k]} onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))} /> {l}</label>)}
              </div>
            </fieldset>
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground"><Checkbox className="mt-0.5" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span>{privacyNotice} <a href="/privacidade" target="_blank" rel="noopener" className="text-primary underline">Política de privacidade</a>.</span></label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={status === "sending"}>{status === "sending" ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : "Enviar"}</Button>
        </form>
      )}
    </div>
  );
}
