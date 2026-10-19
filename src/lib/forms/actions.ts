"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { formSchema } from "@/lib/forms/schema";
import { audit, requireAdmin, type ActionResult } from "@/lib/auth";
import { errorMessage, slugify } from "@/lib/utils";

export async function saveFormAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const p = formSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos" };
  const names = p.data.fields.map((f) => f.name);
  if (new Set(names).size !== names.length) return { ok: false, error: "Há campos com o mesmo nome interno." };
  if (p.data.fields.some((f) => f.type === "select" && f.options.length === 0)) return { ok: false, error: "Campos de seleção precisam de ao menos uma opção." };
  try {
    const ctx = await requireAdmin();
    const { fields, ...meta } = p.data;
    let formId = id;
    let slug = "";
    if (id) {
      const { data, error } = await ctx.supabase.from("forms").update(meta).eq("id", id).eq("organization_id", ctx.orgId).select("slug").single();
      if (error) throw error;
      slug = data.slug;
      await ctx.supabase.from("form_fields").delete().eq("form_id", id);
    } else {
      slug = `${slugify(meta.title).slice(0, 48) || "formulario"}-${randomBytes(2).toString("hex")}`;
      const { data, error } = await ctx.supabase.from("forms").insert({ ...meta, slug, organization_id: ctx.orgId }).select("id").single();
      if (error) throw error;
      formId = data.id;
    }
    const { error: fErr } = await ctx.supabase.from("form_fields").insert(fields.map((f, i) => ({ ...f, form_id: formId, organization_id: ctx.orgId, position: i })));
    if (fErr) throw fErr;
    await audit(ctx, id ? "form.update" : "form.create", "form", formId!);
    revalidatePath("/formularios");
    return { ok: true, data: { id: formId!, slug } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteFormAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireAdmin();
    const { error } = await ctx.supabase.from("forms").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    await audit(ctx, "form.delete", "form", id);
    revalidatePath("/formularios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
