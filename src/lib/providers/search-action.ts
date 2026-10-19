"use server";

import { getContext, type ActionResult } from "@/lib/auth";
import { computeDedupeKeys } from "@/lib/dedupe";
import { errorMessage } from "@/lib/utils";
import { applyLeadFilters, safeTerm } from "@/lib/leads/query";
import { rateLimit } from "@/lib/security/rate-limit";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getProvider } from "./registry";
import { matchesPresence, type ResultRow, type SearchInput, type SearchOutput } from "./search-types";
import { ProviderNotConfiguredError } from "./types";

const PAGE = 20;

export async function searchLeadsAction(input: SearchInput): Promise<ActionResult<SearchOutput> & { notConfigured?: { provider: string; missing: string[]; instructions: string } }> {
  try {
    const ctx = await getContext();
    if (isServiceRoleConfigured() && !(await rateLimit(`search:${ctx.userId}`, 60, 3600))) {
      return { ok: false, error: "Limite de pesquisas por hora atingido. Tente novamente mais tarde." };
    }

    if (input.provider === "internal") return { ok: true, data: await searchInternal(ctx, input) };

    const provider = getProvider(input.provider);
    if (!provider) return { ok: false, error: "Fonte de dados desconhecida." };
    const status = provider.status();
    if (!status.configured) return { ok: false, error: `A fonte “${provider.name}” ainda não está conectada.`, notConfigured: { provider: provider.name, missing: status.missing, instructions: status.instructions } };

    const res = await provider.search({
      query: [input.name, input.category].filter(Boolean).join(" ") || undefined,
      segment: input.segment, country: input.country || "BR", state: input.state, city: input.city, neighborhood: input.neighborhood,
      pageToken: input.pageToken ?? undefined,
    });

    // Marca o que já está salvo na base (deduplicação) usando as chaves de cada resultado.
    const keysByRef = new Map(res.leads.map((l) => [l.sourceRef, computeDedupeKeys({ company_name: l.companyName, city: l.city, phone: l.phone, website: l.website, source_key: l.providerKey, source_ref: l.sourceRef })]));
    const allKeys = [...new Set([...keysByRef.values()].flat())];
    const saved: { id: string; score: number; score_priority: string; dedupe_keys: string[]; stage: { name: string } | null }[] = [];
    if (allKeys.length) {
      const { data } = await ctx.supabase.from("leads").select("id, score, score_priority, dedupe_keys, stage:pipeline_stages(name)").eq("organization_id", ctx.orgId).overlaps("dedupe_keys", allKeys);
      saved.push(...((data ?? []) as unknown as typeof saved));
    }
    const results: ResultRow[] = res.leads
      .map((l) => {
        const keys = keysByRef.get(l.sourceRef) ?? [];
        const hit = saved.find((s) => s.dedupe_keys.some((k) => keys.includes(k)));
        return { ...l, savedLeadId: hit?.id ?? null, score: hit?.score ?? null, scorePriority: hit?.score_priority ?? null, stageName: hit?.stage?.name ?? null };
      })
      .filter((r) => matchesPresence(r, input));
    return { ok: true, data: { results, nextPageToken: res.nextPageToken ?? null, note: provider.termsNote } };
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) return { ok: false, error: e.message, notConfigured: { provider: e.provider, missing: e.missing, instructions: "Configure as variáveis de ambiente indicadas." } };
    return { ok: false, error: errorMessage(e, "Falha ao pesquisar.") };
  }
}

async function searchInternal(ctx: Awaited<ReturnType<typeof getContext>>, input: SearchInput): Promise<SearchOutput> {
  const page = Math.max(0, Number(input.pageToken) || 0);
  const base = ctx.supabase.from("leads").select("*, stage:pipeline_stages(name)");
  const filtered = applyLeadFilters(base, ctx, {
    q: safeTerm(input.name ?? ""), stage: undefined, segment: input.segment || undefined, state: input.state || undefined, city: input.city || undefined,
    owner: undefined, priority: undefined, source: undefined, fav: false, site: input.site || undefined, insta: input.insta || undefined, wa: input.wa || undefined,
    sort: "created_at", dir: "desc", page: 1,
  });
  let q = filtered;
  if (input.neighborhood) q = q.ilike("neighborhood", `%${safeTerm(input.neighborhood)}%`);
  if (input.category) q = q.ilike("category", `%${safeTerm(input.category)}%`);
  if (input.country) q = q.eq("country", input.country);
  if (input.minRating) q = q.gte("rating", input.minRating);
  if (input.minReviews) q = q.gte("reviews_count", input.minReviews);
  if (input.updatedSince) q = q.gte("data_updated_at", input.updatedSince);
  const { data, error } = await q.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const more = rows.length > PAGE;
  const results: ResultRow[] = rows.slice(0, PAGE).map((r) => ({
    sourceRef: String(r.id), providerKey: "internal", companyName: String(r.company_name), category: (r.category as string) ?? null, phone: (r.phone as string) ?? null,
    whatsapp: (r.whatsapp as string) ?? null, website: (r.website as string) ?? null, instagram: (r.instagram as string) ?? null, address: (r.address as string) ?? null,
    neighborhood: (r.neighborhood as string) ?? null, city: (r.city as string) ?? null, state: (r.state as string) ?? null, country: (r.country as string) ?? null,
    rating: r.rating === null ? null : Number(r.rating), reviewsCount: (r.reviews_count as number) ?? null, sourceUrl: (r.source_url as string) ?? null,
    fetchedAt: String(r.data_updated_at), savedLeadId: String(r.id), score: Number(r.score), scorePriority: String(r.score_priority),
    stageName: (r.stage as { name?: string } | null)?.name ?? null, doNotContact: Boolean(r.do_not_contact), updatedAt: String(r.data_updated_at),
  }));
  return { results, nextPageToken: more ? String(page + 1) : null, note: "Pesquisa na sua própria base de leads salvos." };
}
