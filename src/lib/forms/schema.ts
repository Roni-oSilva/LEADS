import { z } from "zod";

export interface FormFieldDef {
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox";
  required: boolean;
  options?: string[];
}

/** Campos mínimos criados em todo formulário novo — evita pedir dados desnecessários. */
export const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  { name: "nome", label: "Nome", type: "text", required: true },
  { name: "empresa", label: "Empresa", type: "text", required: false },
  { name: "email", label: "E-mail", type: "email", required: false },
  { name: "telefone", label: "WhatsApp / Telefone", type: "phone", required: false },
];

/** Constrói o schema Zod de validação (servidor) a partir da definição do formulário. */
export function buildSubmissionSchema(fields: FormFieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    let base: z.ZodType;
    switch (f.type) {
      case "email":
        base = z.string().trim().toLowerCase().email("E-mail inválido").max(200);
        break;
      case "phone":
        base = z.string().trim().regex(/^[0-9()+\-.\s]{8,20}$/, "Telefone inválido");
        break;
      case "checkbox":
        base = z.boolean();
        break;
      case "select":
        base = z.string().refine((v) => (f.options ?? []).includes(v), "Opção inválida");
        break;
      case "textarea":
        base = z.string().trim().max(2000);
        break;
      default:
        base = z.string().trim().max(200);
    }
    if (f.required) {
      base = f.type === "checkbox" ? (base as z.ZodBoolean).refine((v) => v === true, "Campo obrigatório") : base.refine((v) => typeof v === "string" ? v.length > 0 : true, "Campo obrigatório");
      shape[f.name] = base;
    } else {
      shape[f.name] = z.preprocess((v) => (v === "" || v === null ? undefined : v), base.optional());
    }
  }
  return z.object(shape).strict();
}

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function pickUtm(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof input !== "object" || !input) return out;
  for (const k of UTM_KEYS) {
    const v = (input as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 150);
  }
  return out;
}
