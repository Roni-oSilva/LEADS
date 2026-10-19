import "server-only";
import { notFound } from "next/navigation";
import { createAdminClient } from "../supabase/admin";
import { isServiceRoleConfigured } from "../supabase/env";
import type { FormFieldDef } from "./schema";

/** Carrega um formulário ativo para renderização pública (service_role, somente leitura e por slug). */
export async function loadPublicForm(slug: string) {
  if (!isServiceRoleConfigured() || !/^[a-z0-9-]{3,60}$/.test(slug)) notFound();
  const db = createAdminClient();
  const { data: form } = await db.from("forms").select("id, slug, title, description, privacy_notice, collect_comm_preferences, active").eq("slug", slug).eq("active", true).maybeSingle();
  if (!form) notFound();
  const { data: rows } = await db.from("form_fields").select("name, label, type, required, options").eq("form_id", form.id).order("position");
  const fields: FormFieldDef[] = (rows ?? []).map((f) => ({ name: f.name, label: f.label, type: f.type, required: f.required, options: (f.options ?? []) as string[] }));
  return { form, fields };
}
