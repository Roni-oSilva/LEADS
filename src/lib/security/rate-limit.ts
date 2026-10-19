import "server-only";
import { createAdminClient } from "../supabase/admin";

/**
 * Rate limiting persistente (tabela `rate_limits` + função atômica `rate_limit_hit`).
 * Retorna true quando a chamada é permitida. Em caso de falha do backend, nega (fail-closed)
 * para endpoints públicos de escrita.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("rate limit indisponível", e);
    return false;
  }
}
