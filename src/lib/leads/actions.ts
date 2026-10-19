"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin, requireWrite, type ActionResult } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import { computeDedupeKeys } from "@/lib/dedupe";
import { leadInputSchema, type LeadInput } from "./schema";
import { analyzeLead, insertLead, logActivity, moveLeadToStage, providerLeadToRow, refreshScore } from "./service";
import type { ProviderLead } from "@/lib/providers/types";

function revalidate() {
  for (const p of ["/crm", "/funil", "/dashboard", "/oportunidades", "/encontrar-leads", "/tarefas", "/relatorios"]) revalidatePath(p);
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createLeadAction(input: LeadInput): Promise<ActionResult<{ id: string; duplicate: boolean }>> {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  return run(async () => {
    const ctx = await requireWrite();
    const { owner_id: _o, ...rest } = parsed.data;
    const r = await insertLead(ctx, { ...rest, company_name: rest.company_name }, { key: "manual", name: "Cadastro manual", kind: "manual" });
    if (!r.duplicate) await audit(ctx, "lead.create", "lead", r.id);
    revalidate();
    return r;
  });
}

export async function updateLeadAction(id: string, input: LeadInput): Promise<ActionResult> {
  const parsed = leadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  return run(async () => {
    const ctx = await requireWrite();
    const d = parsed.data;
    const keys = computeDedupeKeys({ company_name: d.company_name, city: d.city, phone: d.phone, whatsapp: d.whatsapp, email: d.email, website: d.website });
    const { error } = await ctx.supabase
      .from("leads")
      .update({ ...d, dedupe_keys: keys, data_updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) throw error;
    await logActivity(ctx, id, "system", "Dados do lead atualizados.");
    await refreshScore(ctx, id);
    await audit(ctx, "lead.update", "lead", id);
    revalidate();
    return undefined;
  });
}

export async function deleteLeadsAction(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireWrite();
    if (!ids.length) return undefined;
    const { error } = await ctx.supabase.from("leads").delete().in("id", ids).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "lead.delete", "lead", ids.join(","), { count: ids.length });
    revalidate();
    return undefined;
  });
}

export async function toggleFavoriteAction(id: string, favorite: boolean): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("leads").update({ favorite }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    revalidatePath("/crm");
    return undefined;
  });
}

export async function moveStageAction(id: string, stageId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireWrite();
    await moveLeadToStage(ctx, id, stageId);
    revalidate();
    return undefined;
  });
}

export async function addNoteAction(id: string, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Escreva a observação." };
  if (text.length > 5000) return { ok: false, error: "Observação muito longa (máx. 5000)." };
  return run(async () => {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("lead_notes").insert({ organization_id: ctx.orgId, lead_id: id, user_id: ctx.userId, body: text });
    if (error) throw error;
    await logActivity(ctx, id, "note", text.length > 140 ? `${text.slice(0, 140)}…` : text);
    revalidatePath(`/crm/${id}`);
    return undefined;
  });
}

export async function analyzeLeadAction(id: string, verifySite: boolean): Promise<ActionResult<{ signals: number; score: number }>> {
  return run(async () => {
    const ctx = await requireWrite();
    const r = await analyzeLead(ctx, id, verifySite);
    revalidate();
    revalidatePath(`/crm/${id}`);
    return { signals: r.drafts.length, score: r.score.score };
  });
}

export async function analyzeLeadsAction(ids: string[], verifySite: boolean): Promise<ActionResult<{ analyzed: number }>> {
  return run(async () => {
    const ctx = await requireWrite();
    const list = ids.slice(0, 25); // limite por chamada para proteger tempo de execução e o site verificado
    for (const id of list) await analyzeLead(ctx, id, verifySite);
    revalidate();
    return { analyzed: list.length };
  });
}

export async function saveProviderLeadsAction(items: ProviderLead[], segment: string | null): Promise<ActionResult<{ saved: number; duplicates: number; ids: string[] }>> {
  return run(async () => {
    const ctx = await requireWrite();
    let saved = 0, duplicates = 0;
    const ids: string[] = [];
    for (const item of items.slice(0, 100)) {
      const key = item.providerKey;
      const name = key === "google_places" ? "Google Places" : key === "openstreetmap" ? "OpenStreetMap" : key;
      const r = await insertLead(ctx, providerLeadToRow(item, segment), { key, name, kind: "provider" });
      ids.push(r.id);
      if (r.duplicate) duplicates++;
      else saved++;
    }
    await audit(ctx, "lead.save_from_provider", "lead", undefined, { saved, duplicates });
    revalidate();
    return { saved, duplicates, ids };
  });
}

export async function setFollowUpAction(id: string, nextAction: string, followUpAt: string | null): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase
      .from("leads")
      .update({ next_action: nextAction.trim() || null, follow_up_at: followUpAt || null })
      .eq("id", id)
      .eq("organization_id", ctx.orgId);
    if (error) throw error;
    if (followUpAt) {
      await ctx.supabase.from("tasks").insert({
        organization_id: ctx.orgId, lead_id: id, assignee_id: ctx.userId, created_by: ctx.userId,
        title: nextAction.trim() || "Retornar contato", type: "follow_up", due_at: followUpAt,
      });
    }
    await logActivity(ctx, id, "system", `Próxima ação definida${nextAction ? `: ${nextAction}` : ""}${followUpAt ? ` · retorno em ${new Date(followUpAt).toLocaleDateString("pt-BR")}` : ""}.`);
    revalidate();
    revalidatePath(`/crm/${id}`);
    return undefined;
  });
}

export async function setConsentAction(id: string, input: { basis: "legitimate_interest" | "consent" | "contract" | "other"; allow_whatsapp: boolean; allow_email: boolean; allow_phone: boolean; evidence?: string }): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("leads").update({ lawful_basis: input.basis }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await ctx.supabase.from("contact_preferences").upsert({ lead_id: id, organization_id: ctx.orgId, allow_whatsapp: input.allow_whatsapp, allow_email: input.allow_email, allow_phone: input.allow_phone }, { onConflict: "lead_id" });
    await ctx.supabase.from("consent_records").insert({ organization_id: ctx.orgId, lead_id: id, channel: "all", basis: input.basis, granted: true, evidence: input.evidence?.slice(0, 500) || null, created_by: ctx.userId });
    await logActivity(ctx, id, "system", `Base legal/preferências atualizadas (${input.basis}).`);
    await audit(ctx, "lead.consent", "lead", id);
    revalidatePath(`/crm/${id}`);
    return undefined;
  });
}

export async function removeFromSuppressionAction(suppressionId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("suppression_list").delete().eq("id", suppressionId).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "suppression.remove", "suppression", suppressionId);
    revalidatePath("/configuracoes");
    return undefined;
  });
}
