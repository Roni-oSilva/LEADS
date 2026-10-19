import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";

export type Role = "owner" | "admin" | "member" | "viewer";

export interface Ctx {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  orgId: string;
  orgName: string;
  orgSettings: Record<string, unknown>;
  plan: string;
  role: Role;
  fullName: string;
}

/** Usuário autenticado + organização ativa. Redireciona quando não autenticado. */
export const getContext = cache(async (): Promise<Ctx> => {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, plan, settings)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const m = memberships?.[0] as unknown as { role: Role; organization: { id: string; name: string; plan: string; settings: Record<string, unknown> } } | undefined;
  if (!m?.organization) redirect("/setup?reason=no-organization");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();

  return {
    supabase,
    userId: auth.user.id,
    email: auth.user.email ?? "",
    orgId: m.organization.id,
    orgName: m.organization.name,
    orgSettings: m.organization.settings ?? {},
    plan: m.organization.plan,
    role: m.role,
    fullName: profile?.full_name ?? auth.user.email ?? "",
  };
});

export const canWrite = (role: Role) => role !== "viewer";
export const isAdmin = (role: Role) => role === "owner" || role === "admin";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export async function requireWrite() {
  const ctx = await getContext();
  if (!canWrite(ctx.role)) throw new Error("Seu perfil tem acesso somente leitura.");
  return ctx;
}

export async function requireAdmin() {
  const ctx = await getContext();
  if (!isAdmin(ctx.role)) throw new Error("Apenas administradores podem executar esta ação.");
  return ctx;
}

export async function audit(ctx: Pick<Ctx, "supabase" | "orgId" | "userId">, action: string, entity?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await ctx.supabase.from("audit_logs").insert({ organization_id: ctx.orgId, user_id: ctx.userId, action, entity, entity_id: entityId, metadata });
}
