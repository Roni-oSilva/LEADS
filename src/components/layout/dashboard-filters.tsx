import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { SEGMENTS } from "@/lib/constants";

export interface FilterValues {
  from: string; to: string; segment?: string; state?: string; city?: string; owner?: string; source?: string; g?: string;
}

/** Filtros via GET (URL): funciona sem JavaScript e permite compartilhar a visão. */
export function DashboardFilters({ values, states, cities, owners, sources, action }: { values: FilterValues; states: string[]; cities: string[]; owners: { id: string; name: string }[]; sources: { key: string; name: string }[]; action: string }) {
  return (
    <form action={action} className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 xl:grid-cols-8">
      <label className="text-xs text-muted-foreground">De<Input type="date" name="from" defaultValue={values.from} className="mt-1" /></label>
      <label className="text-xs text-muted-foreground">Até<Input type="date" name="to" defaultValue={values.to} className="mt-1" /></label>
      <label className="text-xs text-muted-foreground">Segmento
        <Select name="segment" defaultValue={values.segment ?? ""} className="mt-1"><option value="">Todos</option>{SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
      </label>
      <label className="text-xs text-muted-foreground">Estado
        <Select name="state" defaultValue={values.state ?? ""} className="mt-1"><option value="">Todos</option>{states.map((s) => <option key={s}>{s}</option>)}</Select>
      </label>
      <label className="text-xs text-muted-foreground">Cidade
        <Select name="city" defaultValue={values.city ?? ""} className="mt-1"><option value="">Todas</option>{cities.map((s) => <option key={s}>{s}</option>)}</Select>
      </label>
      <label className="text-xs text-muted-foreground">Responsável
        <Select name="owner" defaultValue={values.owner ?? ""} className="mt-1"><option value="">Todos</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
      </label>
      <label className="text-xs text-muted-foreground">Origem
        <Select name="source" defaultValue={values.source ?? ""} className="mt-1"><option value="">Todas</option>{sources.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</Select>
      </label>
      <label className="text-xs text-muted-foreground">Agrupar por
        <Select name="g" defaultValue={values.g ?? "day"} className="mt-1"><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></Select>
      </label>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4 xl:col-span-8">
        <Button type="submit" size="sm"><Filter className="h-3.5 w-3.5" aria-hidden /> Aplicar filtros</Button>
        <a href={action} className="text-xs text-muted-foreground hover:text-foreground">Limpar</a>
      </div>
    </form>
  );
}
