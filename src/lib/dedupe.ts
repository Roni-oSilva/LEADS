import { digitsOnly } from "./utils";

export interface DedupeInput {
  company_name?: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  source_ref?: string | null;
  source_key?: string | null;
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function websiteDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Telefone normalizado para comparação (remove DDI 55 quando presente). */
export function normalizePhone(value: string | null | undefined) {
  let d = digitsOnly(value);
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  return d.length >= 8 ? d : null;
}

/** Gera chaves de deduplicação; dois leads com qualquer chave em comum são considerados o mesmo. */
export function computeDedupeKeys(input: DedupeInput): string[] {
  const keys = new Set<string>();
  if (input.source_key && input.source_ref) keys.add(`ref:${input.source_key}:${input.source_ref}`);
  for (const p of [input.phone, input.whatsapp]) {
    const n = normalizePhone(p);
    if (n) keys.add(`tel:${n}`);
  }
  const domain = websiteDomain(input.website);
  if (domain && !/(instagram|facebook|linktr\.ee|wa\.me)/.test(domain)) keys.add(`web:${domain}`);
  if (input.email) keys.add(`mail:${input.email.trim().toLowerCase()}`);
  const name = normalizeText(input.company_name);
  const city = normalizeText(input.city);
  if (name && city) keys.add(`name:${name}|${city}`);
  return [...keys];
}
