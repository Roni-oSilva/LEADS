import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeDedupeKeys, normalizePhone } from "../dedupe";
import type { Role } from "../auth";
import { analyzeOpportunities } from "../opportunities/analyze";
import { checkWebsite } from "../opportunities/check-website";
import { DEFAULT_CONFIG, normalizeWeights, scoreLead, type ScoringConfig } from "../scoring";
import type { ProviderLead } from "../providers/types";
import type { Stage } from "../types";

type Db = SupabaseClient<any, any, any>;
/** Quem executa a operação. `userId` é null em fluxos públicos (formulários), que usam o cliente de serviço. */
export interface Actor {
  supabase: Db;
  orgId: string;
  userId: string | null;
  role: Role;
  orgSettings: Record<string, unknown>;
}

export async function getStages(db: Db, orgId: string): Promise<Stage[]> {
  const { data, error } = await db.from("pipeline_stages").select("*").eq("organization_id", orgId).order("position");
  if (error) throw error;
  return (data ?? []) as Stage[];
}

export async function ensureSource(db: Db, orgId: string, key: string, name: string, kind: string) {
  const { data } = await db.from("lead_sources").select("id").eq("organization_id", orgId).eq("key", key).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await db.from("lead_sources").insert({ organization_id: orgId, key, name, kind }).select("id").single();
  if (error) throw error;
  return created.id as string;
}

export function scoringConfigFrom(settings: Record<string, unknown>): ScoringConfig {
  const s = (settings?.scoring ?? {}) as Partial<ScoringConfig>;
  return {
    weights: normalizeWeights(s.weights),
    targetSegments: s.targetSegments ?? DEFAULT_CONFIG.targetSegments,
    targetStates: s.targetStates ?? DEFAULT_CONFIG.targetStates,
    targetCities: s.targetCities ?? DEFAULT_CONFIG.targetCities,
  };
}

export async function logActivity(a: Pick<Actor, "supabase" | "orgId" | "userId">, leadId: string, type: string, summary: string, metadata: Record<string, unknown> = {}) {
  const { error } = await a.supabase.from("lead_activities").insert({ organization_id: a.orgId, lead_id: leadId, user_id: a.userId, type, summary, metadata });
  if (error) throw error;
}

/** Recalcula e persiste a pontuação (e guarda histórico). */
export async function refreshScore(a: Actor, leadId: string) {
  const { data: lead, error } = await a.supabase.from("leads").select("*, source:lead_sources(key)").eq("id", leadId).single();
  if (error || !lead) throw error ?? new Error("Lead não encontrado");
  const [{ data: evidence }, { count: responses }, { count: formSubmissions }] = await Promise.all([
    a.supabase.from("lead_evidence").select("confidence, verified").eq("lead_id", leadId),
    a.supabase.from("lead_activities").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("type", "whatsapp_response"),
    a.supabase.from("lead_activities").select("id", { count: "exact", head: true }).eq("lead_id", leadId).contains("metadata", { kind: "form_submission" }),
  ]);
  const result = scoreLead(
    {
      segment: lead.segment, state: lead.state, city: lead.city, phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email,
      do_not_contact: lead.do_not_contact, data_updated_at: lead.data_updated_at,
      showed_interest: (lead.source as { key?: string } | null)?.key === "form" || (responses ?? 0) > 0 || (formSubmissions ?? 0) > 0,
      evidence: (evidence ?? []) as { confidence: "low" | "medium" | "high"; verified: boolean }[],
    },
    scoringConfigFrom(a.orgSettings),
  );
  await a.supabase.from("leads").update({ score: result.score, score_priority: result.priority, score_breakdown: result.breakdown, score_updated_at: new Date().toISOString() }).eq("id", leadId);
  await a.supabase.from("lead_scores").insert({ organization_id: a.orgId, lead_id: leadId, score: result.score, priority: result.priority, breakdown: result.breakdown });
  return result;
}

/** Executa o Analisador de Oportunidades; opcionalmente verifica o site (1 requisição pública). */
export async function analyzeLead(a: Actor, leadId: string, verifySite = false) {
  const { data: lead, error } = await a.supabase.from("leads").select("*, source:lead_sources(name)").eq("id", leadId).single();
  if (error || !lead) throw error ?? new Error("Lead não encontrado");
  const check = verifySite && lead.website ? await checkWebsite(lead.website) : null;
  const drafts = analyzeOpportunities(
    { segment: lead.segment, website: lead.website, instagram: lead.instagram, whatsapp: lead.whatsapp, phone: lead.phone, source_name: (lead.source as { name?: string } | null)?.name ?? null },
    check,
  );

  const { data: existing } = await a.supabase.from("lead_evidence").select("id, signal_key, verified").eq("lead_id", leadId);
  const keep = new Set(drafts.map((d) => d.signal_key));
  const stale = (existing ?? []).filter((e) => !keep.has(e.signal_key) && (!e.verified || check));
  if (stale.length) await a.supabase.from("lead_evidence").delete().in("id", stale.map((s) => s.id));

  if (drafts.length) {
    const { error: upErr } = await a.supabase.from("lead_evidence").upsert(
      drafts.map((d) => ({ ...d, organization_id: a.orgId, lead_id: leadId })),
      { onConflict: "lead_id,signal_key" },
    );
    if (upErr) throw upErr;
  }

  // Lead novo que foi analisado avança para "Analisado".
  const stages = await getStages(a.supabase, a.orgId);
  const current = stages.find((s) => s.id === lead.stage_id);
  if (current?.key === "new") {
    const analyzed = stages.find((s) => s.key === "analyzed");
    if (analyzed) {
      await a.supabase.from("leads").update({ stage_id: analyzed.id }).eq("id", leadId);
      await logActivity(a, leadId, "stage_change", "Etapa alterada: Novo lead → Analisado (análise de oportunidades)", { from: current.key, to: "analyzed" });
    }
  }
  await logActivity(a, leadId, "system", `Análise de oportunidades executada (${drafts.length} sinal(is)${check ? "; site verificado" : ""}).`, check ? { website_check: check } : {});
  const score = await refreshScore(a, leadId);
  return { drafts, check, score };
}

export interface NewLeadRow {
  company_name: string;
  contact_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  segment?: string | null;
  category?: string | null;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  source_ref?: string | null;
  source_url?: string | null;
  data_updated_at?: string | null;
  lawful_basis?: string | null;
  country?: string | null;
}

/** Insere um lead evitando duplicidade. Retorna o id e se já existia. */
export async function insertLead(a: Actor, row: NewLeadRow, source: { key: string; name: string; kind: string }, opts: { analyze?: boolean; notes?: string } = {}) {
  const keys = computeDedupeKeys({ ...row, source_key: source.key });
  if (keys.length) {
    const { data: dup } = await a.supabase.from("leads").select("id").eq("organization_id", a.orgId).overlaps("dedupe_keys", keys).limit(1);
    if (dup?.length) return { id: dup[0].id as string, duplicate: true as const };
  }
  const stages = await getStages(a.supabase, a.orgId);
  const sourceId = await ensureSource(a.supabase, a.orgId, source.key, source.name, source.kind);
  const { data, error } = await a.supabase
    .from("leads")
    .insert({
      ...row,
      country: row.country ?? "BR",
      organization_id: a.orgId,
      source_id: sourceId,
      stage_id: stages.find((s) => s.key === "new")?.id ?? null,
      owner_id: a.userId,
      created_by: a.userId,
      dedupe_keys: keys,
      data_updated_at: row.data_updated_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  await logActivity(a, data.id, "system", `Lead criado via ${source.name}.`, { source: source.key });
  if (opts.notes) await a.supabase.from("lead_notes").insert({ organization_id: a.orgId, lead_id: data.id, user_id: a.userId, body: opts.notes });
  if (opts.analyze !== false) await analyzeLead(a, data.id, false);
  else await refreshScore(a, data.id);
  return { id: data.id as string, duplicate: false as const };
}

export function providerLeadToRow(p: ProviderLead, segment?: string | null): NewLeadRow {
  return {
    company_name: p.companyName,
    phone: p.phone ?? null,
    whatsapp: p.whatsapp ?? null,
    website: p.website ?? null,
    instagram: p.instagram ?? null,
    category: p.category ?? null,
    segment: p.segment ?? segment ?? null,
    email: p.email ?? null,
    address: p.address ?? null,
    neighborhood: p.neighborhood ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    country: p.country ?? "BR",
    rating: p.rating ?? null,
    reviews_count: p.reviewsCount ?? null,
    source_ref: p.sourceRef,
    source_url: p.sourceUrl ?? null,
    data_updated_at: p.fetchedAt,
  };
}

/** Move o lead de etapa, registra histórico e aplica as regras de "Não contatar". */
export async function moveLeadToStage(a: Actor, leadId: string, stageId: string) {
  const stages = await getStages(a.supabase, a.orgId);
  const target = stages.find((s) => s.id === stageId);
  if (!target) throw new Error("Etapa inválida.");
  const { data: lead, error } = await a.supabase.from("leads").select("id, stage_id, phone, whatsapp, email, website, do_not_contact").eq("id", leadId).single();
  if (error || !lead) throw error ?? new Error("Lead não encontrado");
  const from = stages.find((s) => s.id === lead.stage_id);
  if (from?.id === target.id) return { changed: false as const };
  if (from?.is_suppressed && !(a.role === "owner" || a.role === "admin")) {
    throw new Error("Somente administradores podem retirar um lead da etapa “Não contatar”.");
  }

  const patch: Record<string, unknown> = { stage_id: target.id };
  if (target.is_suppressed) patch.do_not_contact = true;
  if (from?.is_suppressed && !target.is_suppressed) patch.do_not_contact = false;
  const { error: upErr } = await a.supabase.from("leads").update(patch).eq("id", leadId);
  if (upErr) throw upErr;

  await logActivity(a, leadId, "stage_change", `Etapa alterada: ${from?.name ?? "—"} → ${target.name}`, { from: from?.key, to: target.key });
  if (target.is_suppressed) {
    const entries: { organization_id: string; kind: string; value: string; reason: string; created_by: string | null }[] = [];
    for (const phone of new Set([normalizePhone(lead.whatsapp), normalizePhone(lead.phone)].filter((v): v is string => !!v))) {
      entries.push({ organization_id: a.orgId, kind: "phone", value: phone, reason: "Lead movido para Não contatar", created_by: a.userId });
    }
    if (lead.email) entries.push({ organization_id: a.orgId, kind: "email", value: String(lead.email).toLowerCase(), reason: "Lead movido para Não contatar", created_by: a.userId });
    if (entries.length) await a.supabase.from("suppression_list").upsert(entries, { onConflict: "organization_id,kind,value", ignoreDuplicates: true });
    await logActivity(a, leadId, "opt_out", "Lead marcado como não contatar; contatos adicionados à lista de supressão.");
  }
  await refreshScore(a, leadId);
  return { changed: true as const };
}

/** Inserção em lote (importação CSV): ~6 consultas por lote, com deduplicação, evidências e pontuação. */
export async function bulkInsertLeads(a: Actor, rows: NewLeadRow[], source: { key: string; name: string; kind: string }, skipDuplicates = true) {
  const keyed = rows.map((r) => ({ row: r, keys: computeDedupeKeys({ ...r, source_key: source.key }) }));
  const allKeys = [...new Set(keyed.flatMap((k) => k.keys))];
  const existing = new Set<string>();
  if (allKeys.length) {
    const { data } = await a.supabase.from("leads").select("dedupe_keys").eq("organization_id", a.orgId).overlaps("dedupe_keys", allKeys);
    for (const l of data ?? []) for (const k of l.dedupe_keys as string[]) existing.add(k);
  }
  const seen = new Set<string>();
  const accepted: typeof keyed = [];
  const duplicateIdx: number[] = [];
  keyed.forEach((k, i) => {
    const dup = k.keys.some((key) => existing.has(key) || seen.has(key));
    if (dup && skipDuplicates) return void duplicateIdx.push(i);
    k.keys.forEach((key) => seen.add(key));
    accepted.push(k);
  });
  if (accepted.length === 0) return { imported: 0, duplicates: duplicateIdx };

  const stages = await getStages(a.supabase, a.orgId);
  const stageNew = stages.find((s) => s.key === "new")?.id ?? null;
  const stageAnalyzed = stages.find((s) => s.key === "analyzed")?.id ?? stageNew;
  const sourceId = await ensureSource(a.supabase, a.orgId, source.key, source.name, source.kind);
  const config = scoringConfigFrom(a.orgSettings);

  const prepared = accepted.map(({ row, keys }) => {
    const drafts = analyzeOpportunities({ segment: row.segment ?? null, website: row.website ?? null, instagram: row.instagram ?? null, whatsapp: row.whatsapp ?? null, phone: row.phone ?? null, source_name: source.name });
    const score = scoreLead({ segment: row.segment ?? null, state: row.state ?? null, city: row.city ?? null, phone: row.phone ?? null, whatsapp: row.whatsapp ?? null, email: row.email ?? null, do_not_contact: false, data_updated_at: new Date().toISOString(), showed_interest: false, evidence: drafts.map((d) => ({ confidence: d.confidence, verified: d.verified })) }, config);
    const { notes, ...clean } = row as NewLeadRow & { notes?: string };
    return { notes, drafts, score, insert: { ...clean, country: row.country ?? "BR", organization_id: a.orgId, source_id: sourceId, stage_id: drafts.length ? stageAnalyzed : stageNew, owner_id: a.userId, created_by: a.userId, dedupe_keys: keys, data_updated_at: new Date().toISOString(), score: score.score, score_priority: score.priority, score_breakdown: score.breakdown, score_updated_at: new Date().toISOString() } };
  });

  const { data: inserted, error } = await a.supabase.from("leads").insert(prepared.map((p) => p.insert)).select("id");
  if (error) throw error;
  const ids = (inserted ?? []).map((r) => r.id as string);

  const evidence = ids.flatMap((id, i) => prepared[i].drafts.map((d) => ({ ...d, organization_id: a.orgId, lead_id: id })));
  const scores = ids.map((id, i) => ({ organization_id: a.orgId, lead_id: id, score: prepared[i].score.score, priority: prepared[i].score.priority, breakdown: prepared[i].score.breakdown }));
  const acts = ids.map((id) => ({ organization_id: a.orgId, lead_id: id, user_id: a.userId, type: "system", summary: `Lead criado via ${source.name}.`, metadata: { source: source.key } }));
  const notes = ids.flatMap((id, i) => (prepared[i].notes ? [{ organization_id: a.orgId, lead_id: id, user_id: a.userId, body: prepared[i].notes! }] : []));
  await Promise.all([
    evidence.length ? a.supabase.from("lead_evidence").insert(evidence) : null,
    a.supabase.from("lead_scores").insert(scores),
    a.supabase.from("lead_activities").insert(acts),
    notes.length ? a.supabase.from("lead_notes").insert(notes) : null,
  ]);
  return { imported: ids.length, duplicates: duplicateIdx };
}
