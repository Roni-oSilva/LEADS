import { digitsOnly } from "../utils";
import { UF_LIST } from "../constants";

export interface PasteDefaults {
  segment?: string;
  state?: string;
  city?: string;
}

const isPhone = (t: string) => /^[+()\d][\d\s().+-]{7,}$/.test(t) && digitsOnly(t).length >= 8 && digitsOnly(t).length <= 15;
const isEmail = (t: string) => /^\S+@\S+\.\S+$/.test(t);
const isInstagram = (t: string) => /^@[\w.]{2,30}$/.test(t) || /instagram\.com\//i.test(t);
const isSite = (t: string) => /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t) && !isEmail(t);
const cityUf = (t: string) => /^(.+?)\s*[/-]\s*([A-Za-z]{2})$/.exec(t);

/**
 * Converte uma lista colada (uma empresa por linha) em linhas do formato de importação.
 * Colunas separadas por ";" ou TAB (ou " | "). A 1ª coluna é o nome; as demais são reconhecidas pelo formato
 * (telefone, e-mail, site, @instagram, "Cidade/UF"), em qualquer ordem.
 */
export function parsePastedLeads(text: string, defaults: PasteDefaults = {}): { rows: Record<string, string>[]; ignored: number } {
  const rows: Record<string, string>[] = [];
  let ignored = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/\t|;|\s\|\s/).map((p) => p.trim()).filter(Boolean);
    const name = parts[0];
    if (!name || isPhone(name) || isEmail(name)) { ignored++; continue; }
    const row: Record<string, string> = { company_name: name };
    for (const t of parts.slice(1)) {
      const cu = cityUf(t);
      if (isEmail(t)) row.email ??= t;
      else if (isInstagram(t)) row.instagram ??= t.startsWith("@") ? `https://instagram.com/${t.slice(1)}` : t;
      else if (isPhone(t)) {
        if (!row.phone) row.phone = t;
        else row.whatsapp ??= t;
      } else if (cu && (UF_LIST as readonly string[]).includes(cu[2].toUpperCase())) { row.city ??= cu[1].trim(); row.state ??= cu[2].toUpperCase(); }
      else if (isSite(t)) row.website ??= t;
      else if ((UF_LIST as readonly string[]).includes(t.toUpperCase()) && t.length === 2) row.state ??= t.toUpperCase();
      else row.city ??= t;
    }
    if (defaults.segment) row.segment = defaults.segment;
    if (defaults.state) row.state ??= defaults.state;
    if (defaults.city) row.city ??= defaults.city;
    rows.push(row);
  }
  return { rows, ignored };
}
