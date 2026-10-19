import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service_role — IGNORA o RLS. Use apenas em rotas públicas controladas
 * (formulários, DSAR) e sempre filtrando manualmente por organização.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
