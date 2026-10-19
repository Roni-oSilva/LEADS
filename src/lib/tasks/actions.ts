"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWrite, type ActionResult } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Informe o título").max(200),
  type: z.enum(["follow_up", "call", "whatsapp", "email", "meeting", "proposal", "other"]).default("follow_up"),
  due: z.string().trim().optional().transform((v) => (v ? v : null)),
  lead_id: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
});

export async function createTaskAction(input: unknown): Promise<ActionResult> {
  const p = taskSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("tasks").insert({
      organization_id: ctx.orgId, lead_id: p.data.lead_id ?? null, assignee_id: ctx.userId, created_by: ctx.userId, title: p.data.title, type: p.data.type,
      due_at: p.data.due ? new Date(`${p.data.due}T12:00:00-03:00`).toISOString() : null,
    });
    if (error) throw error;
    revalidatePath("/tarefas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function toggleTaskAction(id: string, done: boolean): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    revalidatePath("/tarefas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireWrite();
    const { error } = await ctx.supabase.from("tasks").delete().eq("id", id).eq("organization_id", ctx.orgId);
    if (error) throw error;
    revalidatePath("/tarefas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
