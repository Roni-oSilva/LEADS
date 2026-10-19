"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { SEGMENT_GROUPS, SEGMENTS } from "@/lib/segments";

const MAX = 8;

/** Seleção de vários nichos, agrupados por área, com busca por texto. */
export function NichePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const groups = useMemo(() => {
    const term = norm(q.trim());
    return SEGMENT_GROUPS.map((g) => ({ group: g, items: SEGMENTS.filter((s) => s.group === g && (!term || norm(s.label).includes(term))) })).filter((g) => g.items.length);
  }, [q]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : value.length < MAX ? [...value, v] : value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Nichos <span className="font-normal">(escolha até {MAX})</span></span>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground">Limpar ({value.length})</button>}
      </div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Nichos selecionados">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-1 pl-2.5 pr-1 text-xs">
              {SEGMENTS.find((s) => s.value === v)?.label}
              <button type="button" aria-label={`Remover ${v}`} onClick={() => toggle(v)} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nicho (ex.: oficina, pizzaria, barbearia)…" className="pl-9" aria-label="Buscar nicho" />
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-card-2/40 p-3">
        {groups.length === 0 && <p className="text-xs text-muted-foreground">Nenhum nicho encontrado.</p>}
        {groups.map(({ group, items }) => (
          <fieldset key={group}>
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</legend>
            <div className="flex flex-wrap gap-1.5">
              {items.map((s) => {
                const on = value.includes(s.value);
                return (
                  <button key={s.value} type="button" aria-pressed={on} onClick={() => toggle(s.value)} disabled={!on && value.length >= MAX}
                    className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")}>
                    {on && <Check className="h-3 w-3 text-primary" aria-hidden />}{s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
