"use server";

import { revalidatePath } from "next/cache";
import { audit, requireWrite, type ActionResult } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import { campaignSchema, type SequenceStep } from "./schema";

const done = (id?: string) => { revalidatePath("/campanhas"); if (id) revalidatePath(`/campanhas/${id}`); };

export async function saveCampaignAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = campaignSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const ctx = await requireWrite();
    const row = { ...p.data, organization_id: ctx.orgId };
    if (id) {
      const { error } = await ctx.supabase.from("campaigns").update(row).eq("id", id).eq("organization_id", ctx.orgId);
      if (error) throw error;
      await audit(ctx, "campaign.update", "campaign", id);
      done(id);
      return { ok: true, data: { id } };
    }
    const { data, error } = await ctx.supabase.from("campaigns").insert({ ...row, created_by: ctx.userId }).select("id").single();
    if (error) throw error;
    await audit(ctx, "campaign.create", "campaign", data.id);
    done();
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("campaigns").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "campaign.delete", "campaign", id);
    done();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setCampaignStatusAction(id: string, status: string): Promise<ActionResult> {
  if (!["draft", "active", "paused", "finished"].includes(status)) return { ok: false, error: "Status inválido." };
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("campaigns").update({ status }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    done(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addLeadsToCampaignAction(campaignId: string, f: { segment?: string; state?: string; city?: string; minScore?: number; stageId?: string }): Promise<ActionResult<{ added: number }>> {
  try {
    const ctx = await requireWrite();
    let q = ctx.supabase.from("leads").select("id").eq("organization_id", ctx.orgId).eq("do_not_contact", false);
    if (f.segment) q = q.eq("segment", f.segment);
    if (f.state) q = q.eq("state", f.state);
    if (f.city) q = q.ilike("city", f.city.replace(/[%,()*\\]/g, ""));
    if (f.minScore) q = q.gte("score", f.minScore);
    if (f.stageId) q = q.eq("stage_id", f.stageId);
    const { data: leads, error } = await q.limit(500);
    if (error) throw error;
    if (!leads?.length) return { ok: true, data: { added: 0 } };
    const { error: insErr } = await ctx.supabase.from("campaign_leads").upsert(leads.map((l) => ({ campaign_id: campaignId, lead_id: l.id, organization_id: ctx.orgId })), { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
    if (insErr) throw insErr;
    await audit(ctx, "campaign.add_leads", "campaign", campaignId, { count: leads.length });
    done(campaignId);
    return { ok: true, data: { added: leads.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeLeadFromCampaignAction(campaignId: string, leadId: string): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("campaign_leads").delete().eq("campaign_id", campaignId).eq("lead_id", leadId).eq("organization_id", ctx.orgId);
    if (error) throw error;
    done(campaignId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Cria tarefas de retorno (não envia mensagens). Leads "não contatar" ou sem canal permitido são ignorados. */
export async function generateCampaignTasksAction(campaignId: string): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const ctx = await requireWrite();
    const { data: camp } = await ctx.supabase.from("campaigns").select("name, sequence, starts_at").eq("id", campaignId).eq("organization_id", ctx.orgId).single();
    const steps = ((camp?.sequence ?? []) as SequenceStep[]);
    if (!camp || steps.length === 0) return { ok: false, error: "Defina uma sequência de acompanhamento na campanha." };
    const { data: cls } = await ctx.supabase.from("campaign_leads").select("lead:leads(id, company_name, do_not_contact)").eq("campaign_id", campaignId).limit(1000);
    const leads = ((cls ?? []) as unknown as { lead: { id: string; company_name: string; do_not_contact: boolean } | null }[]).map((c) => c.lead).filter((l): l is NonNullable<typeof l> => !!l);
    const allowed = leads.filter((l) => !l.do_not_contact);
    const { data: prefs } = await ctx.supabase.from("contact_preferences").select("lead_id, allow_whatsapp, allow_email, allow_phone").in("lead_id", allowed.map((l) => l.id));
    const blocked = new Set((prefs ?? []).filter((p) => !p.allow_whatsapp && !p.allow_email && !p.allow_phone).map((p) => p.lead_id));
    const targets = allowed.filter((l) => !blocked.has(l.id));
    const { data: existing } = await ctx.supabase.from("tasks").select("lead_id, title").eq("campaign_id", campaignId);
    const have = new Set((existing ?? []).map((t) => `${t.lead_id}|${t.title}`));
    const base = camp.starts_at ? new Date(`${camp.starts_at}T12:00:00-03:00`) : new Date();
    const rows = targets.flatMap((l) => steps.map((s) => ({ l, s }))).filter(({ l, s }) => !have.has(`${l.id}|${s.title}`)).map(({ l, s }) => ({
      organization_id: ctx.orgId, lead_id: l.id, campaign_id: campaignId, assignee_id: ctx.userId, created_by: ctx.userId, title: s.title, type: "follow_up",
      due_at: new Date(Math.max(base.getTime(), Date.now()) + s.day_offset * 86_400_000).toISOString(),
    }));
    if (rows.length) {
      const { error } = await ctx.supabase.from("tasks").insert(rows);
      if (error) throw error;
    }
    await audit(ctx, "campaign.generate_tasks", "campaign", campaignId, { created: rows.length });
    revalidatePath("/tarefas");
    done(campaignId);
    return { ok: true, data: { created: rows.length, skipped: leads.length - targets.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
