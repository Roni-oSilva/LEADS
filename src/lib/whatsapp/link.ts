import { PORTFOLIO_URL, serviceLabel } from "../constants";
import { digitsOnly } from "../utils";

export const DEFAULT_WHATSAPP_TEMPLATE = `Olá, tudo bem? Conheci a {{empresa}} e gostaria de apresentar uma ideia para melhorar a presença digital e facilitar o atendimento aos clientes.
Trabalho com desenvolvimento de sites e sistemas personalizados para empresas{{servico_frase}}.
Você teria interesse em conhecer algumas possibilidades para o seu negócio?
Conheça também: {{portfolio}}`;

export interface TemplateVars {
  empresa: string;
  servico?: string | null;
  contato?: string | null;
  portfolio?: string;
}

export function renderTemplate(template: string, vars: TemplateVars) {
  const service = vars.servico ? serviceLabel(vars.servico) : "";
  return template
    .replaceAll("{{empresa}}", vars.empresa)
    .replaceAll("{{contato}}", vars.contato ?? "")
    .replaceAll("{{servico}}", service)
    .replaceAll("{{servico_frase}}", service ? `, como ${service.toLowerCase()}` : "")
    .replaceAll("{{portfolio}}", vars.portfolio ?? PORTFOLIO_URL);
}

/** Normaliza para o formato E.164 sem "+", assumindo Brasil quando não há DDI. Retorna null se inválido. */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (!d.startsWith("55")) return d.length >= 10 && d.length <= 15 ? d : null;
  // 55 + DDD(2) + 8 ou 9 dígitos
  return d.length === 12 || d.length === 13 ? d : null;
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const n = normalizeWhatsAppNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/** Celulares brasileiros têm 9 dígitos após o DDD; fixos não costumam ter WhatsApp. */
export function looksLikeMobile(raw: string | null | undefined) {
  const n = normalizeWhatsAppNumber(raw);
  return !!n && n.startsWith("55") && n.length === 13 && n[4] === "9";
}
