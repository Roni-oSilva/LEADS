"use server";

import { revalidatePath } from "next/cache";
import { audit, requireWrite, type ActionResult } from "@/lib/auth";
import { importRowSchema } from "@/lib/csv/leads-csv";
import { computeDedupeKeys } from "@/lib/dedupe";
import { bulkInsertLeads, type NewLeadRow } from "@/lib/leads/service";
import { errorMessage } from "@/lib/utils";

const MAX_CHUNK = 150;

/** Retorna os índices (do lote enviado) que já existem na base ou se repetem dentro do arquivo. */
export async function checkImportDuplicatesAction(rows: Record<string, string>[], alreadySeen: string[] = []): Promise<ActionResult<{ duplicates: number[]; keys: string[] }>> {
  try {
    const ctx = await requireWrite();
    if (rows.length > 500) return { ok: false, error: "Lote grande demais." };
    const parsed = rows.map((r) => importRowSchema.safeParse(r));
    const keyed = parsed.map((p) => (p.success ? computeDedupeKeys({ ...p.data, source_key: "csv_import" }) : []));
    const all = [...new Set(keyed.flat())];
    const existing = new Set<string>(alreadySeen);
    if (all.length) {
      const { data } = await ctx.supabase.from("leads").select("dedupe_keys").eq("organization_id", ctx.orgId).overlaps("dedupe_keys", all);
      for (const l of data ?? []) for (const k of l.dedupe_keys as string[]) existing.add(k);
    }
    const duplicates: number[] = [];
    const seenKeys: string[] = [];
    keyed.forEach((keys, i) => {
      if (keys.some((k) => existing.has(k))) duplicates.push(i);
      else { keys.forEach((k) => existing.add(k)); seenKeys.push(...keys); }
    });
    return { ok: true, data: { duplicates, keys: seenKeys } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function importChunkAction(rows: Record<string, string>[], skipDuplicates: boolean): Promise<ActionResult<{ imported: number; duplicates: number; errors: { index: number; message: string }[] }>> {
  try {
    const ctx = await requireWrite();
    if (rows.length > MAX_CHUNK) return { ok: false, error: `Lote máximo de ${MAX_CHUNK} linhas.` };
    const errors: { index: number; message: string }[] = [];
    const valid: { index: number; row: NewLeadRow }[] = [];
    rows.forEach((raw, index) => {
      const p = importRowSchema.safeParse(raw); // revalida no servidor: nunca confie no cliente
      if (!p.success) errors.push({ index, message: p.error.issues.map((i) => i.message).join("; ") });
      else valid.push({ index, row: { ...p.data, rating: p.data.rating ?? null, reviews_count: p.data.reviews_count ?? null } as NewLeadRow });
    });
    const res = await bulkInsertLeads(ctx, valid.map((v) => v.row), { key: "csv_import", name: "Importação CSV", kind: "import" }, skipDuplicates);
    return { ok: true, data: { imported: res.imported, duplicates: res.duplicates.length, errors } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function finishImportAction(summary: { filename: string; total: number; imported: number; duplicates: number; errors: { line: number; message: string }[]; mapping: Record<string, string> }): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("import_jobs").insert({
      organization_id: ctx.orgId, user_id: ctx.userId, filename: summary.filename.slice(0, 200), status: "completed",
      total_rows: summary.total, imported_rows: summary.imported, duplicate_rows: summary.duplicates, error_rows: summary.errors.length,
      mapping: summary.mapping, error_report: summary.errors.slice(0, 500),
    });
    if (error) throw error;
    await audit(ctx, "import.csv", "import_job", undefined, { imported: summary.imported, duplicates: summary.duplicates, errors: summary.errors.length });
    for (const p of ["/crm", "/dashboard", "/funil", "/importar-exportar", "/oportunidades"]) revalidatePath(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
