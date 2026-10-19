import { z } from "zod";
import { SEGMENTS, UF_LIST } from "../constants";
import { normalizeText, websiteDomain } from "../dedupe";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: "company_name", label: "Nome da empresa", required: true, aliases: ["empresa", "nome", "razao social", "nome fantasia", "company", "name", "nome da empresa"] },
  { key: "contact_name", label: "Nome do contato", aliases: ["contato", "responsavel", "contact", "nome do contato"] },
  { key: "phone", label: "Telefone", aliases: ["telefone", "fone", "phone", "tel", "celular"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "zap", "wpp"] },
  { key: "email", label: "E-mail", aliases: ["email", "e mail", "e-mail", "mail"] },
  { key: "website", label: "Site", aliases: ["site", "website", "url", "pagina", "web"] },
  { key: "instagram", label: "Instagram", aliases: ["instagram", "insta", "ig"] },
  { key: "segment", label: "Segmento", aliases: ["segmento", "segment", "ramo", "nicho"] },
  { key: "category", label: "Categoria", aliases: ["categoria", "category", "tipo"] },
  { key: "state", label: "Estado (UF)", aliases: ["estado", "uf", "state"] },
  { key: "city", label: "Cidade", aliases: ["cidade", "city", "municipio"] },
  { key: "neighborhood", label: "Bairro", aliases: ["bairro", "neighborhood"] },
  { key: "address", label: "Endereço", aliases: ["endereco", "address", "logradouro"] },
  { key: "rating", label: "Avaliação", aliases: ["avaliacao", "nota", "rating"] },
  { key: "reviews_count", label: "Nº de avaliações", aliases: ["avaliacoes", "reviews", "qtd avaliacoes", "numero de avaliacoes"] },
  { key: "notes", label: "Observações", aliases: ["observacoes", "obs", "notas", "notes"] },
];

/** Sugere o mapeamento coluna do CSV → campo, por nome normalizado. */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const header of headers) {
    const h = normalizeText(header);
    const field = IMPORT_FIELDS.find((f) => !used.has(f.key) && (normalizeText(f.key) === h || f.aliases.some((a) => normalizeText(a) === h)));
    if (field) {
      mapping[header] = field.key;
      used.add(field.key);
    }
  }
  return mapping;
}

export function mapRow(row: Record<string, string>, mapping: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const v = row[header]?.toString().trim();
    if (v) out[field] = v;
  }
  return out;
}

const SEGMENT_VALUES = SEGMENTS.map((s) => s.value) as string[];

export function resolveSegment(raw: string | undefined) {
  if (!raw) return undefined;
  const n = normalizeText(raw);
  const byValue = SEGMENTS.find((s) => s.value === n.replaceAll(" ", "_"));
  if (byValue) return byValue.value;
  const byLabel = SEGMENTS.find((s) => normalizeText(s.label) === n);
  return byLabel?.value ?? raw.trim().slice(0, 60);
}

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const importRowSchema = z.object({
  company_name: z.string().trim().min(1, "Nome da empresa é obrigatório").max(200),
  contact_name: optionalText(120),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z.string().trim().toLowerCase().email("E-mail inválido").optional(),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : undefined))
    .refine((v) => !v || websiteDomain(v) !== null, "Site inválido"),
  instagram: optionalText(200),
  segment: z.string().optional().transform(resolveSegment),
  category: optionalText(120),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .refine((v) => !v || (UF_LIST as readonly string[]).includes(v), "UF inválida"),
  city: optionalText(120),
  neighborhood: optionalText(120),
  address: optionalText(300),
  rating: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0 && v <= 5), "Avaliação deve estar entre 0 e 5"),
  reviews_count: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v.replace(/\D/g, "")) : undefined))
    .refine((v) => v === undefined || Number.isInteger(v), "Nº de avaliações inválido"),
  notes: optionalText(2000),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export interface RowValidation {
  line: number;
  ok: boolean;
  data?: ImportRow;
  errors: string[];
}

export function validateRows(rows: Record<string, string>[], mapping: Record<string, string>): RowValidation[] {
  return rows.map((row, i) => {
    const parsed = importRowSchema.safeParse(mapRow(row, mapping));
    return parsed.success
      ? { line: i + 2, ok: true, data: parsed.data, errors: [] }
      : { line: i + 2, ok: false, errors: parsed.error.issues.map((e) => `${e.path.join(".") || "linha"}: ${e.message}`) };
  });
}

// ---------- Exportação ----------
export interface ExportField {
  key: string;
  label: string;
}

export const EXPORT_FIELDS: ExportField[] = [
  { key: "company_name", label: "Empresa" },
  { key: "contact_name", label: "Contato" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "E-mail" },
  { key: "website", label: "Site" },
  { key: "instagram", label: "Instagram" },
  { key: "segment", label: "Segmento" },
  { key: "category", label: "Categoria" },
  { key: "state", label: "UF" },
  { key: "city", label: "Cidade" },
  { key: "neighborhood", label: "Bairro" },
  { key: "address", label: "Endereço" },
  { key: "rating", label: "Avaliação" },
  { key: "reviews_count", label: "Nº avaliações" },
  { key: "stage", label: "Etapa" },
  { key: "score", label: "Pontuação" },
  { key: "next_action", label: "Próxima ação" },
  { key: "follow_up_at", label: "Data de retorno" },
  { key: "source", label: "Fonte" },
  { key: "discovered_at", label: "Data de descoberta" },
];

/** Escapa um valor de CSV e neutraliza injeção de fórmulas (=, +, -, @). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], fields: ExportField[]): string {
  const header = fields.map((f) => csvCell(f.label)).join(",");
  const lines = rows.map((r) => fields.map((f) => csvCell(r[f.key])).join(","));
  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}
