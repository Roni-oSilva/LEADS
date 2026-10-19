"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, getContext, requireAdmin, type ActionResult } from "@/lib/auth";
import { CRITERIA, normalizeWeights } from "@/lib/scoring";
import { errorMessage } from "@/lib/utils";
import { normalizePhone } from "@/lib/dedupe";
import { refreshScore } from "@/lib/leads/service";

const ok = (path = "/configuracoes") => { revalidatePath(path); revalidatePath("/", "layout"); };

export async function updateProfileAction(input: { full_name: string; phone: string; notify_followups: boolean; notify_form_submissions: boolean; notify_weekly_summary: boolean }): Promise<ActionResult> {
  const p = z.object({ full_name: z.string().trim().min(2, "Informe seu nome").max(100), phone: z.string().trim().max(30), notify_followups: z.boolean(), notify_form_submissions: z.boolean(), notify_weekly_summary: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const ctx = await getContext();
    const { error } = await ctx.supabase.from("profiles").update({ full_name: p.data.full_name, phone: p.data.phone || null, preferences: { notify_followups: p.data.notify_followups, notify_form_submissions: p.data.notify_form_submissions, notify_weekly_summary: p.data.notify_weekly_summary } }).eq("id", ctx.userId);
    if (error) throw error;
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateOrgAction(name: string): Promise<ActionResult> {
  const n = name.trim();
  if (n.length < 2 || n.length > 120) return { ok: false, error: "O nome deve ter entre 2 e 120 caracteres." };
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("organizations").update({ name: n }).eq("id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "org.update", "organization", ctx.orgId);
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function saveScoringAction(input: { weights: Record<string, number>; targetSegments: string[]; targetStates: string[]; targetCities: string[]; recalc: boolean }): Promise<ActionResult<{ recalculated: number }>> {
  try {
    const ctx = await requireAdmin();
    const raw = Object.fromEntries(CRITERIA.map((c) => [c.key, Math.max(0, Math.min(100, Number(input.weights[c.key]) || 0))]));
    const scoring = {
      weights: normalizeWeights(raw),
      targetSegments: input.targetSegments.slice(0, 20),
      targetStates: input.targetStates.map((s) => s.toUpperCase()).slice(0, 27),
      targetCities: input.targetCities.map((c) => c.trim()).filter(Boolean).slice(0, 50),
    };
    const settings = { ...ctx.orgSettings, scoring };
    const { error } = await ctx.supabase.from("organizations").update({ settings }).eq("id", ctx.orgId);
    if (error) throw error;
    let recalculated = 0;
    if (input.recalc) {
      const { data: leads } = await ctx.supabase.from("leads").select("id").eq("organization_id", ctx.orgId).limit(300);
      for (const l of leads ?? []) { await refreshScore({ ...ctx, orgSettings: settings }, l.id); recalculated++; }
    }
    await audit(ctx, "settings.scoring", "organization", ctx.orgId, { recalculated });
    ok(); revalidatePath("/crm");
    return { ok: true, data: { recalculated } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function changeMemberRoleAction(userId: string, role: string): Promise<ActionResult> {
  if (!["admin", "member", "viewer"].includes(role)) return { ok: false, error: "Perfil inválido." };
  try {
    const ctx = await requireAdmin();
    if (userId === ctx.userId) return { ok: false, error: "Você não pode alterar o próprio perfil." };
    const { error } = await ctx.supabase.from("organization_members").update({ role }).eq("organization_id", ctx.orgId).eq("user_id", userId);
    if (error) throw error;
    await audit(ctx, "member.role", "member", userId, { role });
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    if (userId === ctx.userId) return { ok: false, error: "Você não pode remover a si mesmo." };
    const { error } = await ctx.supabase.from("organization_members").delete().eq("organization_id", ctx.orgId).eq("user_id", userId);
    if (error) throw error;
    await audit(ctx, "member.remove", "member", userId);
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function createInviteAction(email: string, role: string): Promise<ActionResult> {
  const p = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido"), role: z.enum(["admin", "member", "viewer"]) }).safeParse({ email, role });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("organization_invites").upsert({ organization_id: ctx.orgId, email: p.data.email, role: p.data.role, invited_by: ctx.userId, accepted_at: null }, { onConflict: "organization_id,email" });
    if (error) throw error;
    await audit(ctx, "member.invite", "invite", p.data.email, { role: p.data.role });
    ok();
    return { ok: true, message: "Convite registrado. Peça para a pessoa criar a conta com este e-mail." };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteInviteAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("organization_invites").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addSuppressionAction(kind: "email" | "phone" | "domain", value: string, reason: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    if (ctx.role === "viewer") throw new Error("Seu perfil tem acesso somente leitura.");
    let v = value.trim().toLowerCase();
    if (kind === "phone") v = normalizePhone(v) ?? "";
    if (kind === "email" && !/^\S+@\S+\.\S+$/.test(v)) throw new Error("E-mail inválido.");
    if (!v) throw new Error("Valor inválido.");
    const { error } = await ctx.supabase.from("suppression_list").upsert({ organization_id: ctx.orgId, kind, value: v, reason: reason.trim().slice(0, 200) || "Registrado manualmente", created_by: ctx.userId }, { onConflict: "organization_id,kind,value", ignoreDuplicates: true });
    if (error) throw error;
    await audit(ctx, "suppression.add", "suppression", v);
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function resolveDsarAction(id: string, status: "in_progress" | "done" | "rejected", resolution: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("dsar_requests").update({ status, resolution: resolution.trim().slice(0, 1000) || null, resolved_at: status === "in_progress" ? null : new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "dsar.resolve", "dsar", id, { status });
    ok();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Atende pedido de eliminação: apaga os leads do titular (e dados relacionados em cascata) e o inclui na lista de supressão. */
export async function eraseSubjectDataAction(identifier: string): Promise<ActionResult<{ deleted: number }>> {
  try {
    const ctx = await requireAdmin();
    const id = identifier.trim().toLowerCase();
    const isEmail = /^\S+@\S+\.\S+$/.test(id);
    const phone = isEmail ? null : normalizePhone(id);
    if (!isEmail && !phone) throw new Error("Informe um e-mail ou telefone válido.");
    const key = isEmail ? `mail:${id}` : `tel:${phone}`;
    const { data: leads, error } = await ctx.supabase.from("leads").select("id").eq("organization_id", ctx.orgId).contains("dedupe_keys", [key]);
    if (error) throw error;
    const ids = (leads ?? []).map((l) => l.id);
    if (ids.length) {
      const { error: delErr } = await ctx.supabase.from("leads").delete().in("id", ids).eq("organization_id", ctx.orgId);
      if (delErr) throw delErr;
    }
    await ctx.supabase.from("suppression_list").upsert({ organization_id: ctx.orgId, kind: isEmail ? "email" : "phone", value: isEmail ? id : phone!, reason: "Solicitação de eliminação (LGPD)", created_by: ctx.userId }, { onConflict: "organization_id,kind,value", ignoreDuplicates: true });
    await audit(ctx, "dsar.erase", "lead", key, { deleted: ids.length });
    ok(); revalidatePath("/crm");
    return { ok: true, data: { deleted: ids.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
