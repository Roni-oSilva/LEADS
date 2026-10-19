"use server";

import { revalidatePath } from "next/cache";
import { audit, requireAdmin, type ActionResult } from "@/lib/auth";
import { getProvider } from "@/lib/providers/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { errorMessage } from "@/lib/utils";

/** Teste de conexão. Nunca devolve chaves ao navegador — somente o resultado. */
export async function testIntegrationAction(key: string): Promise<ActionResult<{ status: "ok" | "error" | "not_configured"; message: string }>> {
  try {
    const ctx = await requireAdmin();
    let status: "ok" | "error" | "not_configured" = "error";
    let message = "";

    if (key === "supabase") {
      const { error } = await ctx.supabase.from("organizations").select("id", { head: true, count: "exact" }).eq("id", ctx.orgId);
      status = error ? "error" : "ok"; message = error ? error.message : "Banco de dados e autenticação respondendo.";
    } else if (key === "service_role") {
      if (!isServiceRoleConfigured()) { status = "not_configured"; message = "SUPABASE_SERVICE_ROLE_KEY não configurada: formulários públicos e rate limit ficam indisponíveis."; }
      else {
        const { error } = await createAdminClient().rpc("rate_limit_hit", { p_key: "healthcheck", p_window_seconds: 60, p_max: 1000 });
        status = error ? "error" : "ok"; message = error ? error.message : "Chave de serviço válida e função de rate limit disponível.";
      }
    } else if (key === "whatsapp_business") {
      const id = process.env.WHATSAPP_PHONE_NUMBER_ID, token = process.env.WHATSAPP_ACCESS_TOKEN;
      if (!id || !token) { status = "not_configured"; message = "WhatsApp Business Platform não configurada. O sistema usa links wa.me (conversa iniciada manualmente)."; }
      else {
        const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(id)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        status = res.ok ? "ok" : "error"; message = res.ok ? "Credenciais aceitas pela WhatsApp Business Platform." : `A API respondeu HTTP ${res.status}. Verifique o token e o ID do número.`;
      }
    } else {
      const provider = getProvider(key);
      if (!provider) return { ok: false, error: "Integração desconhecida." };
      const s = provider.status();
      if (!s.configured) { status = "not_configured"; message = s.instructions; }
      else { const r = await provider.test(); status = r.ok ? "ok" : "error"; message = r.message; }
    }

    await ctx.supabase.from("integrations").upsert({ organization_id: ctx.orgId, provider: key, last_tested_at: new Date().toISOString(), last_status: status, last_error: status === "ok" ? null : message.slice(0, 300) }, { onConflict: "organization_id,provider" });
    await ctx.supabase.from("integration_logs").insert({ organization_id: ctx.orgId, provider: key, action: "test_connection", status, message: message.slice(0, 300) });
    await audit(ctx, "integration.test", "integration", key, { status });
    revalidatePath("/integracoes");
    return { ok: true, data: { status, message } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
