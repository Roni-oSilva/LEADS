import "server-only";
import type { Ctx } from "../auth";
import { digitsOnly } from "../utils";

export const PAGE_SIZE = 20;
export const SORTABLE = ["created_at", "company_name", "score", "city", "follow_up_at"] as const;

export type Sp = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Remove caracteres que quebrariam a sintaxe de filtros `or()` do PostgREST. */
export function safeTerm(v: string) {
  return v.replace(/[,()%*\\:]/g, " ").trim().slice(0, 80);
}

export function parseLeadQuery(sp: Sp) {
  const sort = (SORTABLE as readonly string[]).includes(first(sp.sort) ?? "") ? first(sp.sort)! : "created_at";
  const dir = first(sp.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(first(sp.page)) || 1);
  return {
    q: first(sp.q) ?? "", stage: first(sp.stage), segment: first(sp.segment), state: first(sp.state), city: first(sp.city),
    owner: first(sp.owner), priority: first(sp.priority), source: first(sp.source), fav: first(sp.fav) === "1",
    site: first(sp.site), insta: first(sp.insta), wa: first(sp.wa), sort, dir, page,
  } as const;
}
export type LeadQuery = ReturnType<typeof parseLeadQuery>;

export const LEAD_SELECT = "*, stage:pipeline_stages(id, key, name, position), source:lead_sources(key, name)";

/** Aplica os filtros do CRM a uma query do Supabase (RLS garante o escopo da organização). */
export function applyLeadFilters<T extends { eq: Function; or: Function; not: Function; is: Function; in: Function }>(query: T, ctx: Pick<Ctx, "orgId">, f: LeadQuery): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query.eq("organization_id", ctx.orgId);
  const term = safeTerm(f.q);
  if (term) {
    const digits = digitsOnly(term);
    q = q.or([`company_name.ilike.%${term}%`, `contact_name.ilike.%${term}%`, `email.ilike.%${term}%`, `city.ilike.%${term}%`, digits.length >= 4 ? `phone.ilike.%${digits}%` : null].filter(Boolean).join(","));
  }
  if (f.stage) q = q.eq("stage_id", f.stage);
  if (f.segment) q = q.eq("segment", f.segment);
  if (f.state) q = q.eq("state", f.state);
  if (f.city) q = q.ilike("city", safeTerm(f.city));
  if (f.owner) q = q.eq("owner_id", f.owner);
  if (f.priority) q = q.eq("score_priority", f.priority);
  if (f.source) q = q.eq("source_id", f.source);
  if (f.fav) q = q.eq("favorite", true);
  if (f.site === "yes") q = q.not("website", "is", null);
  if (f.site === "no") q = q.is("website", null);
  if (f.insta === "yes") q = q.not("instagram", "is", null);
  if (f.insta === "no") q = q.is("instagram", null);
  if (f.wa === "yes") q = q.not("whatsapp", "is", null);
  return q as T;
}
