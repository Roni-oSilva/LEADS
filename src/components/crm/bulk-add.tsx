"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { SegmentOptions } from "@/components/ui/segment-options";
import { parsePastedLeads } from "@/lib/csv/paste";
import { UF_LIST } from "@/lib/constants";
import { finishImportAction, importChunkAction } from "@/lib/import/actions";

export function BulkAddButton({ variant = "secondary" }: { variant?: "secondary" | "default" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [segment, setSegment] = useState("");
  const [state, setState] = useState("");
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parsePastedLeads(text, { segment: segment || undefined, state: state || undefined }), [text, segment, state]);

  function submit() {
    start(async () => {
      const rows = parsed.rows.slice(0, 500);
      let imported = 0, duplicates = 0;
      const errors: { line: number; message: string }[] = [];
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const r = await importChunkAction(chunk, true);
        if (!r.ok) return void toast.error(r.error);
        imported += r.data!.imported; duplicates += r.data!.duplicates;
        r.data!.errors.forEach((e) => errors.push({ line: i + e.index + 1, message: e.message }));
      }
      await finishImportAction({ filename: "Lista colada", total: rows.length, imported, duplicates, errors, mapping: {} });
      toast.success(`${imported} lead(s) adicionado(s)${duplicates ? ` · ${duplicates} duplicado(s) ignorado(s)` : ""}${errors.length ? ` · ${errors.length} linha(s) com erro` : ""}.`);
      setOpen(false); setText(""); router.refresh();
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}><ClipboardPaste className="h-4 w-4" aria-hidden /> Colar lista</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Adicionar vários leads colando uma lista" description="Uma empresa por linha. Útil para contatos de planilhas, anotações ou listas próprias." className="max-w-2xl">
        <div className="space-y-4">
          <Field label="Lista" hint="Separe por ponto e vírgula (;) ou TAB. Ex.: Auto Center Silva; Campinas/SP; (19) 99999-8888; silva@auto.com; autosilva.com.br">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Auto Center Silva; Campinas/SP; (19) 99999-8888\nBorracharia do Zé; (31) 3333-4444; Belo Horizonte/MG"} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nicho de todos (opcional)"><Select value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">—</option><SegmentOptions /></Select></Field>
            <Field label="Estado padrão (opcional)"><Select value={state} onChange={(e) => setState(e.target.value)}><option value="">—</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select></Field>
          </div>
          <p className="text-xs text-muted-foreground">{parsed.rows.length} empresa(s) reconhecida(s){parsed.ignored ? ` · ${parsed.ignored} linha(s) ignorada(s) (sem nome)` : ""}{parsed.rows.length > 500 ? " · serão importadas as 500 primeiras" : ""}. Duplicidades são ignoradas. Use apenas contatos comerciais com base legal.</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit} loading={pending} disabled={parsed.rows.length === 0}>Adicionar {parsed.rows.length || ""} lead(s)</Button></div>
        </div>
      </Dialog>
    </>
  );
}
