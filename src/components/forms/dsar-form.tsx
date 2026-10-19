"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";

export function DsarForm({ org }: { org: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const rendered = useRef(0);
  useEffect(() => { rendered.current = Date.now(); }, []);
  const hp = useRef<HTMLInputElement>(null);
  if (state === "done") return <div className="py-6 text-center" role="status"><CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-success" aria-hidden /><p className="font-semibold">Solicitação registrada</p><p className="mt-1 text-sm text-muted-foreground">Responderemos ao e-mail informado dentro do prazo legal.</p></div>;
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setError(null); setState("sending");
      const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
      const res = await fetch("/api/dsar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org, name: fd.name, email: fd.email, kind: fd.kind, details: fd.details, hp: hp.current?.value ?? "", t: rendered.current }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) { setError(json?.error ?? "Não foi possível enviar."); setState("idle"); } else setState("done");
    }}>
      <Field label="Seu nome"><Input name="name" required maxLength={120} autoComplete="name" /></Field>
      <Field label="E-mail para resposta"><Input name="email" type="email" required maxLength={200} autoComplete="email" /></Field>
      <Field label="Tipo de solicitação"><Select name="kind" defaultValue="access"><option value="access">Acesso aos meus dados</option><option value="correction">Correção de dados</option><option value="deletion">Eliminação dos meus dados</option><option value="opposition">Não quero ser contatado(a)</option><option value="portability">Portabilidade</option><option value="other">Outro</option></Select></Field>
      <Field label="Detalhes (opcional)"><Textarea name="details" rows={3} maxLength={1500} /></Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Não preencha<input ref={hp} tabIndex={-1} autoComplete="off" /></label></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" loading={state === "sending"}>Enviar solicitação</Button>
    </form>
  );
}
