import { defaultRange, type DashFilters, type Granularity } from "./aggregate";

export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseFilters(sp: RawParams): { filters: DashFilters; granularity: Granularity; values: { from: string; to: string; segment?: string; state?: string; city?: string; owner?: string; source?: string; g: string } } {
  const def = defaultRange(30);
  const from = isDate(one(sp.from)) ? one(sp.from)! : def.from;
  const to = isDate(one(sp.to)) ? one(sp.to)! : def.to;
  const g = (["day", "week", "month"].includes(one(sp.g) ?? "") ? one(sp.g) : "day") as Granularity;
  const filters: DashFilters = { from, to, segment: one(sp.segment), state: one(sp.state), city: one(sp.city), owner: one(sp.owner), source: one(sp.source) };
  return { filters, granularity: g, values: { ...filters, from, to, g } };
}
