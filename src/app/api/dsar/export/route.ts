import { NextResponse, type NextRequest } from "next/server";
import { audit, getContext, isAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/dedupe";

export const dynamic = "force-dynamic";

/** Exporta (JSON) todos os dados de um titular a partir de e-mail ou telefone. Somente administradores. */
export async function GET(req: NextRequest) {
  const ctx = await getContext();
  if (!isAdmin(ctx.role)) return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const isEmail = /^\S+@\S+\.\S+$/.test(q);
  const phone = isEmail ? null : normalizePhone(q);
  if (!isEmail && !phone) return NextResponse.json({ error: "Informe um e-mail ou telefone válido." }, { status: 400 });

  const db = ctx.supabase;
  const { data: leads } = await db.from("leads").select("*").eq("organization_id", ctx.orgId).contains("dedupe_keys", [isEmail ? `mail:${q}` : `tel:${phone}`]);
  const ids = (leads ?? []).map((l) => l.id);
  const byLead = async (table: string) => (ids.length ? (await db.from(table).select("*").in("lead_id", ids)).data ?? [] : []);
  const payload = {
    exported_at: new Date().toISOString(),
    subject: q,
    leads,
    notes: await byLead("lead_notes"),
    activities: await byLead("lead_activities"),
    consent_records: await byLead("consent_records"),
    contact_preferences: await byLead("contact_preferences"),
    form_submissions: await byLead("form_submissions"),
  };
  await audit(ctx, "dsar.export", "lead", q, { leads: ids.length });
  return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dados-titular.json"`, "Cache-Control": "no-store" } });
}
