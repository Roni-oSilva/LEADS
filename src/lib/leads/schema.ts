import { z } from "zod";
import { UF_LIST } from "../constants";

const text = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable().optional();

export const leadInputSchema = z.object({
  company_name: z.string().trim().min(1, "Informe o nome da empresa").max(200),
  contact_name: text(120),
  phone: text(40),
  whatsapp: text(40),
  email: z.string().trim().toLowerCase().max(200).transform((v) => (v === "" ? null : v)).pipe(z.string().email("E-mail inválido").nullable()).optional(),
  website: text(300),
  instagram: text(200),
  segment: text(60),
  category: text(120),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (UF_LIST as readonly string[]).includes(v), "UF inválida")
    .nullable()
    .optional(),
  city: text(120),
  neighborhood: text(120),
  address: text(300),
  next_action: text(300),
  follow_up_at: z.string().trim().transform((v) => (v === "" ? null : v)).nullable().optional(),
  estimated_value: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().min(0, "Valor inválido").max(1e9).nullable()).optional(),
  owner_id: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
  lawful_basis: z.enum(["legitimate_interest", "consent", "contract", "other"]).nullable().optional().or(z.literal("").transform(() => null)),
});

export type LeadInput = z.input<typeof leadInputSchema>;
export type LeadData = z.output<typeof leadInputSchema>;
