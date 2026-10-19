"use server";

import { revalidatePath } from "next/cache";
import { audit, requireWrite, type ActionResult } from "@/lib/auth";
import { formatCnpj, mapBrasilApi, normalizeCnpj } from "@/lib/cnpj";
import { computeDedupeKeys } from "@/lib/dedupe";
import { logActivity, refreshScore } from "@/lib/leads/service";
import { errorMessage } from "@/lib/utils";

/**
 * Completa o lead com dados PÚBLICOS do CNPJ (BrasilAPI). Só preenche campos vazios; nunca sobrescreve.
 * Descarta o quadro societário. O resultado fica registrado na observação e no histórico.
 */
export async function enrichFromCnpjAction(leadId: string, rawCnpj: string): Promise<ActionResult<{ filled: string[]; status: string | null }>> {
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj) return { ok: false, error: "CNPJ inválido. Confira os 14 dígitos." };
  try {
    const ctx = await requireWrite();
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { headers: { Accept: "application/json", "User-Agent": "LeadFinderPro/1.0" }, signal: AbortSignal.timeout(12000) });
    if (res.status === 404) return { ok: false, error: "CNPJ não encontrado na base pública." };
    if (!res.ok) return { ok: false, error: `A consulta pública respondeu HTTP ${res.status}. Tente novamente em instantes.` };
    const data = mapBrasilApi((await res.json()) as Record<string, unknown>);
    if (!data) return { ok: false, error: "Resposta inesperada da consulta pública." };

    const { data: lead, error } = await ctx.supabase.from("leads").select("*").eq("id", leadId).eq("organization_id", ctx.orgId).single();
    if (error || !lead) throw error ?? new Error("Lead não encontrado");

    const patch: Record<string, unknown> = { cnpj };
    const filled: string[] = [];
    const fill = (col: string, value: string | null, label: string) => { if (value && !lead[col]) { patch[col] = value; filled.push(label); } };
    fill("phone", data.phone, "telefone");
    fill("email", data.email, "e-mail");
    fill("address", data.street, "endereço");
    fill("neighborhood", data.neighborhood, "bairro");
    fill("city", data.city, "cidade");
    fill("state", data.state, "estado");
    patch.data_updated_at = new Date().toISOString();
    patch.dedupe_keys = computeDedupeKeys({ company_name: lead.company_name, city: (patch.city as string) ?? lead.city, phone: (patch.phone as string) ?? lead.phone, whatsapp: lead.whatsapp, email: (patch.email as string) ?? lead.email, website: lead.website, source_key: undefined });
    const { error: upErr } = await ctx.supabase.from("leads").update(patch).eq("id", leadId);
    if (upErr) throw upErr;

    const note = [`Consulta pública do CNPJ ${formatCnpj(cnpj)} (BrasilAPI / Receita Federal):`, data.legalName && `Razão social: ${data.legalName}`, data.tradeName && `Nome fantasia: ${data.tradeName}`, data.status && `Situação cadastral: ${data.status}`, data.cnae && `Atividade principal: ${data.cnae}`, data.size && `Porte: ${data.size}`].filter(Boolean).join("\n");
    await ctx.supabase.from("lead_notes").insert({ organization_id: ctx.orgId, lead_id: leadId, user_id: ctx.userId, body: note });
    await logActivity(ctx, leadId, "system", `Dados completados pelo CNPJ (${filled.length ? filled.join(", ") : "nenhum campo vazio para preencher"}).`, { cnpj, source: "brasilapi" });
    await refreshScore(ctx, leadId);
    await audit(ctx, "lead.cnpj_enrich", "lead", leadId, { filled });
    revalidatePath(`/crm/${leadId}`);
    revalidatePath("/crm");
    return { ok: true, data: { filled, status: data.status } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
