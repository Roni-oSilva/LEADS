"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin, requireWrite, type ActionResult, type Ctx } from "@/lib/auth";
import { normalizePhone } from "@/lib/dedupe";
import { errorMessage } from "@/lib/utils";
import { logActivity, moveLeadToStage, getStages, refreshScore } from "@/lib/leads/service";

async function isBlocked(ctx: Ctx, leadId: string, channel: "whatsapp" | "email" | "phone") {
  const { data: lead } = await ctx.supabase.from("leads").select("do_not_contact, phone, whatsapp, email").eq("id", leadId).single();
  if (!lead) return "Lead não encontrado.";
  if (lead.do_not_contact) return "Este lead pediu para não ser contatado.";
  const { data: pref } = await ctx.supabase.from("contact_preferences").select("allow_whatsapp, allow_email, allow_phone").eq("lead_id", leadId).maybeSingle();
  if (pref && pref[`allow_${channel}` as "allow_whatsapp"] === false) return "O contato desativou este canal de comunicação.";
  const phones = [normalizePhone(lead.whatsapp), normalizePhone(lead.phone)].filter((v): v is string => !!v);
  const email = lead.email ? String(lead.email).toLowerCase() : null;
  const { data: sup } = await ctx.supabase.from("suppression_list").select("kind, value").eq("organization_id", ctx.orgId).in("value", [...phones, ...(email ? [email] : [])]);
  if ((sup ?? []).some((s) => (s.kind === "phone" && phones.includes(s.value)) || (s.kind === "email" && s.value === email))) return "Este contato está na lista de supressão (não contatar).";
  return null;
}

/** Registra que o USUÁRIO abriu a conversa. Não afirma envio nem entrega — o link wa.me apenas abre o WhatsApp. */
export async function registerWhatsAppStartedAction(leadId: string, message: string): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const blocked = await isBlocked(ctx, leadId, "whatsapp");
    if (blocked) return { ok: false, error: blocked };
    await logActivity(ctx, leadId, "whatsapp_started", "Conversa no WhatsApp iniciada pelo usuário (link oficial wa.me). Envio e entrega não são confirmados.", { message: message.slice(0, 1000), initiated_by: "user", delivery: "unconfirmed" });
    revalidatePath(`/crm/${leadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function registerContactAction(leadId: string, type: "contact_done" | "whatsapp_response" | "call" | "email" | "meeting" | "proposal", summary?: string): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const labels = { contact_done: "Contato realizado", whatsapp_response: "Resposta recebida do lead", call: "Ligação realizada", email: "E-mail enviado", meeting: "Reunião realizada/agendada", proposal: "Proposta enviada" } as const;
    if (type === "call" || type === "email" || type === "contact_done") {
      const blocked = await isBlocked(ctx, leadId, type === "email" ? "email" : type === "call" ? "phone" : "whatsapp");
      if (blocked) return { ok: false, error: blocked };
    }
    await logActivity(ctx, leadId, type, summary?.trim() ? `${labels[type]}: ${summary.trim().slice(0, 500)}` : labels[type]);

    // Avanços automáticos de etapa (apenas para frente, nunca para trás).
    const stages = await getStages(ctx.supabase, ctx.orgId);
    const { data: lead } = await ctx.supabase.from("leads").select("stage_id").eq("id", leadId).single();
    const cur = stages.find((s) => s.id === lead?.stage_id);
    const advanceTo = type === "contact_done" || type === "call" || type === "email" ? "first_contact" : type === "whatsapp_response" ? "negotiating" : type === "meeting" ? "meeting" : type === "proposal" ? "proposal" : null;
    const target = stages.find((s) => s.key === advanceTo);
    if (cur && target && !cur.is_lost && !cur.is_suppressed && !cur.is_won && cur.position < target.position) await moveLeadToStage(ctx, leadId, target.id);
    if (type === "whatsapp_response") await refreshScore(ctx, leadId);
    revalidatePath(`/crm/${leadId}`);
    revalidatePath("/funil");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function saveWhatsAppTemplateAction(template: string): Promise<ActionResult> {
  const t = template.trim();
  if (t.length < 10 || t.length > 1500) return { ok: false, error: "O modelo deve ter entre 10 e 1500 caracteres." };
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("organizations").update({ settings: { ...ctx.orgSettings, whatsapp_template: t } }).eq("id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "settings.whatsapp_template");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
