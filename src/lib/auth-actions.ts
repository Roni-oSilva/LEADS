"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/auth-schemas";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/env";
import type { ActionResult } from "@/lib/auth";

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos";

async function rateLimited(scope: string, max: number, windowSeconds: number) {
  // Limite por IP no nível da aplicação (além dos limites nativos do Supabase Auth).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const { rateLimit } = await import("@/lib/security/rate-limit");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return !(await rateLimit(`${scope}:${ip}`, max, windowSeconds));
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (await rateLimited("login", 10, 300)) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message === "Email not confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos." };
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signupAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (await rateLimited("signup", 5, 3600)) return { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=/dashboard`,
      data: { full_name: parsed.data.fullName, organization_name: parsed.data.organizationName },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session) redirect("/dashboard");
  return { ok: true, data: { needsConfirmation: true } };
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (await rateLimited("forgot", 5, 3600)) return { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${appUrl()}/auth/callback?next=/reset-password` });
  // Resposta neutra: não revela se o e-mail existe.
  return { ok: true, message: "Se o e-mail estiver cadastrado, enviaremos um link de recuperação." };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
