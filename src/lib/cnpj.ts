import { digitsOnly } from "./utils";

/** Valida CNPJ (14 dígitos + dígitos verificadores). Retorna os 14 dígitos ou null. */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return null;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]) ? d : null;
}

export function formatCnpj(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export interface CnpjData {
  cnpj: string;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
  cnae: string | null;
  size: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function phone(v: unknown) {
  const d = digitsOnly(typeof v === "string" ? v : "");
  if (d.length < 10) return null;
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/**
 * Mapeia a resposta da BrasilAPI (dados públicos da Receita Federal). Só campos da EMPRESA:
 * o quadro societário (QSA) é descartado de propósito (dados pessoais, desnecessários à prospecção).
 */
export function mapBrasilApi(j: Record<string, unknown>): CnpjData | null {
  const cnpj = normalizeCnpj(String(j.cnpj ?? ""));
  if (!cnpj) return null;
  const number = clean(j.numero);
  const street = [clean(j.logradouro), number && number !== "S/N" ? number : null].filter(Boolean).join(", ") || null;
  return {
    cnpj,
    legalName: clean(j.razao_social),
    tradeName: clean(j.nome_fantasia),
    status: clean(j.descricao_situacao_cadastral),
    cnae: clean(j.cnae_fiscal_descricao),
    size: clean(j.porte) ?? clean(j.descricao_porte),
    phone: phone(j.ddd_telefone_1),
    email: clean(j.email)?.toLowerCase() ?? null,
    street,
    neighborhood: clean(j.bairro),
    city: clean(j.municipio),
    state: clean(j.uf)?.toUpperCase() ?? null,
    zip: clean(j.cep),
  };
}
