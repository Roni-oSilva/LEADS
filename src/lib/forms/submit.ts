import "server-only";
import { createAdminClient } from "../supabase/admin";
import { normalizePhone } from "../dedupe";
import { computeDedupeKeys } from "../dedupe";
import { insertLead, logActivity, refreshScore, type Actor } from "../leads/service";
import type { FormFieldDef } from "./schema";

export interface FormRecord {
  id: string;
  organization_id: string;
  slug: string;
  kind: string;
  title: string;
  description: string | null;
  service_interest: string | null;
  thank_you_message: string;
  thank_you_url: string | null;
  campaign_id: string | null;
  campaign_origin: string | null;
  privacy_notice: string;
  collect_comm_preferences: boolean;
  active: boolean;
}

export interface SubmissionInput {
  form: FormRecord;
  data: Record<string, unknown>;
  utm: Record<string, string>;
  referrer: string | null;
  ipHash: string | null;
  prefs: { whatsapp: boolean; email: boolean; phone: boolean };
  fields: FormFieldDef[];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Cria/atualiza o lead a partir de um envio público. Usa service_role e filtra SEMPRE pela organização do formulário. */
export async function processSubmission(input: SubmissionInput) {
  const db = createAdminClient();
  const { form } = input;
  const { data: org } = await db.from("organizations").select("settings").eq("id", form.organization_id).single();
  const actor: Actor = { supabase: db, orgId: form.organization_id, userId: null, role: "member", orgSettings: (org?.settings ?? {}) as Record<string, unknown> };

  const nome = str(input.data.nome);
  const empresa = str(input.data.empresa);
  const email = str(input.data.email)?.toLowerCase() ?? null;
  const telefone = str(input.data.telefone) ?? str(input.data.whatsapp);
  const company = empresa ?? nome ?? email ?? "Contato via formulário";
  const wantsWhatsApp = input.prefs.whatsapp && !!normalizePhone(telefone);

  // Campos personalizados viram observação (os demais já alimentam o lead).
  const known = new Set(["nome", "empresa", "email", "telefone", "whatsapp"]);
  const extras = input.fields.filter((f) => !known.has(f.name) && input.data[f.name] !== undefined && input.data[f.name] !== "").map((f) => `${f.label}: ${String(input.data[f.name])}`);

  const existingKeys = computeDedupeKeys({ company_name: company, phone: telefone, email });
  let leadId: string | null = null;
  let created = false;
  const keysWithoutName = existingKeys.filter((k) => !k.startsWith("name:"));
  if (keysWithoutName.length) {
    const { data: dup } = await db.from("leads").select("id").eq("organization_id", form.organization_id).overlaps("dedupe_keys", keysWithoutName).limit(1);
    leadId = dup?.[0]?.id ?? null;
  }
  if (!leadId) {
    const r = await insertLead(
      actor,
      { company_name: company, contact_name: nome, email, phone: telefone, whatsapp: wantsWhatsApp ? telefone : null, lawful_basis: form.kind === "newsletter" ? "consent" : "contract" },
      { key: "form", name: "Formulários do site", kind: "form" },
      { analyze: true, notes: extras.length ? `Dados do formulário “${form.title}”:\n${extras.join("\n")}` : undefined },
    );
    leadId = r.id;
    created = !r.duplicate;
  } else if (extras.length) {
    await db.from("lead_notes").insert({ organization_id: form.organization_id, lead_id: leadId, body: `Novo envio do formulário “${form.title}”:\n${extras.join("\n")}` });
  }

  const origin = input.utm.utm_source || input.utm.utm_campaign ? ` · UTM: ${Object.entries(input.utm).map(([k, v]) => `${k.replace("utm_", "")}=${v}`).join(", ")}` : "";
  await logActivity(actor, leadId, "system", `Formulário “${form.title}” enviado${created ? " (novo lead)" : " (lead existente)"}${origin}.`, { kind: "form_submission", form_id: form.id, utm: input.utm, service_interest: form.service_interest });

  const { data: lead } = await db.from("leads").select("do_not_contact").eq("id", leadId).single();
  await db.from("leads").update({ lawful_basis: form.kind === "newsletter" ? "consent" : "contract", ...(form.service_interest ? { next_action: `Responder: ${form.title}` } : {}) }).eq("id", leadId);
  await db.from("contact_preferences").upsert({ lead_id: leadId, organization_id: form.organization_id, allow_whatsapp: input.prefs.whatsapp, allow_email: input.prefs.email, allow_phone: input.prefs.phone }, { onConflict: "lead_id" });
  await db.from("consent_records").insert({
    organization_id: form.organization_id, lead_id: leadId, channel: "all", basis: form.kind === "newsletter" ? "consent" : "contract", granted: true,
    evidence: `Aviso de privacidade aceito no formulário “${form.title}” (${form.slug}) em ${new Date().toISOString()}: ${form.privacy_notice}`.slice(0, 500),
  });
  if (!lead?.do_not_contact) {
    await db.from("tasks").insert({ organization_id: form.organization_id, lead_id: leadId, campaign_id: form.campaign_id, title: `Responder solicitação: ${form.title}`, type: "follow_up", due_at: new Date(Date.now() + 86_400_000).toISOString() });
  } else {
    await logActivity(actor, leadId, "system", "Este lead está marcado como não contatar; revise manualmente antes de responder.");
  }
  if (form.campaign_id) await db.from("campaign_leads").upsert({ campaign_id: form.campaign_id, lead_id: leadId, organization_id: form.organization_id }, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
  await db.from("form_submissions").insert({ organization_id: form.organization_id, form_id: form.id, lead_id: leadId, data: input.data, utm: { ...input.utm, ...(form.campaign_origin ? { campaign_origin: form.campaign_origin } : {}) }, referrer: input.referrer?.slice(0, 300) ?? null, ip_hash: input.ipHash });
  await refreshScore(actor, leadId);
  return { leadId, created };
}
