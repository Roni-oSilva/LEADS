"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

const MAX = 5;
const SHOWN = 60;

/** Lista de municípios do estado com busca; permite escolher até 5 cidades. */
export function CityPicker({ cities, value, onChange, disabled }: { cities: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtered = useMemo(() => {
    const term = norm(q.trim());
    return (term ? cities.filter((c) => norm(c).includes(term)) : cities).slice(0, SHOWN);
  }, [cities, q]);
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : value.length < MAX ? [...value, c] : value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Cidades <span className="font-normal">(até {MAX})</span></span>
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground">Limpar</button>}
      </div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Cidades selecionadas">
          {value.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-1 pl-2.5 pr-1 text-xs">{c}
              <button type="button" aria-label={`Remover ${c}`} onClick={() => toggle(c)} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} disabled={disabled} placeholder={disabled ? "Escolha o estado primeiro" : `Buscar entre ${cities.length} cidades…`} className="pl-9" aria-label="Buscar cidade" />
      </div>
      <ul className={cn("max-h-48 overflow-y-auto rounded-lg border border-border bg-card-2/40", disabled && "opacity-50")} role="listbox" aria-multiselectable aria-label="Cidades">
        {filtered.map((c) => {
          const on = value.includes(c);
          return (
            <li key={c} role="option" aria-selected={on}>
              <button type="button" disabled={disabled || (!on && value.length >= MAX)} onClick={() => toggle(c)}
                className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40", on && "bg-primary-soft")}>
                {c}{on && <span className="text-xs text-primary">selecionada</span>}
              </button>
            </li>
          );
        })}
        {!disabled && filtered.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">Nenhuma cidade encontrada.</li>}
      </ul>
      {!disabled && cities.length > SHOWN && !q && <p className="mt-1 text-[11px] text-muted-foreground">Mostrando as primeiras {SHOWN} — digite para filtrar as {cities.length} cidades.</p>}
    </div>
  );
}
