/**
 * Avaliador do subconjunto de filtros Overpass usado em src/lib/segments.ts:
 *   ["chave"]  ["chave"="valor"]  ["chave"~"regex"]  ["chave"~"regex",i]
 * Permite descobrir em QUAL nicho cada elemento retornado se encaixa (uma consulta, vários nichos).
 */
type Condition = { key: string; op: "has" | "eq" | "re"; value?: string; re?: RegExp };

const COND = /\["([^"]+)"(?:(=|~)"((?:[^"\\]|\\.)*)"(,i)?)?\]/g;

export function parseFilter(filter: string): Condition[] {
  const out: Condition[] = [];
  for (const m of filter.matchAll(COND)) {
    const [, key, op, value, ci] = m;
    if (!op) out.push({ key, op: "has" });
    else if (op === "=") out.push({ key, op: "eq", value });
    else out.push({ key, op: "re", re: new RegExp(value, ci ? "i" : "") });
  }
  return out;
}

export function matchesFilter(tags: Record<string, string>, filter: string): boolean {
  const conds = parseFilter(filter);
  if (conds.length === 0) return false;
  return conds.every((c) => {
    const v = tags[c.key];
    if (v === undefined) return false;
    if (c.op === "has") return true;
    if (c.op === "eq") return v === c.value;
    return c.re!.test(v);
  });
}

/** Primeiro nicho (na ordem informada) cujo filtro casa com as tags. */
export function classifySegment(tags: Record<string, string>, segments: { value: string; osm: string[] }[]): string | null {
  for (const s of segments) if (s.osm.some((f) => matchesFilter(tags, f))) return s.value;
  return null;
}
