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

const fieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Nome interno inválido (use letras minúsculas, números e _)"),
  label: z.string().trim().min(1, "Todo campo precisa de um rótulo").max(100),
  type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const formSchema = z.object({
  title: z.string().trim().min(2, "Informe o título").max(160),
  description: z.string().trim().max(600).optional().transform((v) => v || null),
  kind: z.enum(["quote", "demo", "material", "newsletter", "diagnostic", "webinar", "contact"]),
  service_interest: z.string().trim().optional().transform((v) => v || null),
  thank_you_message: z.string().trim().min(2, "Informe a mensagem de agradecimento").max(500),
  thank_you_url: z.string().trim().optional().transform((v) => v || null).refine((v) => !v || /^https?:\/\//i.test(v), "A página de agradecimento deve começar com http(s)://"),
  campaign_id: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
  campaign_origin: z.string().trim().max(120).optional().transform((v) => v || null),
  privacy_notice: z.string().trim().min(10, "Informe o aviso de privacidade").max(600),
  collect_comm_preferences: z.boolean(),
  active: z.boolean(),
  fields: z.array(fieldSchema).min(1, "Adicione ao menos um campo").max(20),
});
export type FormInput = z.input<typeof formSchema>;

