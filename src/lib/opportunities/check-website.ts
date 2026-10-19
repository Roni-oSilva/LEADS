import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateIp, parsePublicUrl } from "../security/ssrf";
import type { WebsiteCheck } from "./analyze";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

async function assertPublicHost(hostname: string) {
  const records = await lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new Error("Endereço não permitido para verificação.");
  }
}

/**
 * Faz UMA requisição pública à página inicial para verificar disponibilidade e HTTPS.
 * Protegido contra SSRF (DNS resolvido e validado a cada redirecionamento).
 * Não executa scraping, não contorna proteções e identifica-se no User-Agent.
 */
export async function checkWebsite(rawUrl: string): Promise<WebsiteCheck> {
  const started = Date.now();
  let current = parsePublicUrl(rawUrl);
  const base = { url: rawUrl, checkedAt: new Date().toISOString(), status: null as number | null, responseMs: null as number | null };
  if (!current) return { ...base, ok: false, https: false, error: "URL inválida ou não permitida." };

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(current.hostname);
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "LeadFinderPro-Verifier/1.0 (verificação de disponibilidade)", Accept: "text/html" },
      });
      await res.body?.cancel();
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        const next = parsePublicUrl(new URL(res.headers.get("location")!, current).toString());
        if (!next) return { ...base, url: current.toString(), ok: false, https: false, status: res.status, error: "Redirecionamento para destino não permitido." };
        current = next;
        continue;
      }
      return {
        ...base,
        url: current.toString(),
        ok: res.status < 400,
        status: res.status,
        https: current.protocol === "https:",
        responseMs: Date.now() - started,
        error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
      };
    }
    return { ...base, url: current.toString(), ok: false, https: current.protocol === "https:", error: "Redirecionamentos em excesso." };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "TimeoutError" ? "Tempo esgotado (8s)." : e.cause instanceof Error ? e.cause.message : e.message) : "Falha de conexão.";
    return { ...base, url: current.toString(), ok: false, https: current.protocol === "https:", error: msg };
  }
}
