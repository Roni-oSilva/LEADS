import { z } from "zod";

export interface SequenceStep {
  day_offset: number;
  title: string;
}

/** "0|Primeiro contato" por linha → passos da sequência. */
export function parseSequence(text: string): SequenceStep[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [d, ...rest] = line.split("|");
      const hasOffset = rest.length > 0 && /^\d{1,3}$/.test(d.trim());
      return { day_offset: hasOffset ? Number(d.trim()) : 0, title: (hasOffset ? rest.join("|") : line).trim().slice(0, 160) };
    })
    .filter((s) => s.title)
    .slice(0, 12);
}

export const sequenceToText = (steps: SequenceStep[]) => steps.map((s) => `${s.day_offset}|${s.title}`).join("\n");

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da campanha").max(120),
    objective: z.string().trim().max(500).optional().transform((v) => v || null),
    target_segment: z.string().trim().optional().transform((v) => v || null),
    source_key: z.string().trim().optional().transform((v) => v || null),
    status: z.enum(["draft", "active", "paused", "finished"]).default("draft"),
    starts_at: z.string().optional().transform((v) => v || null),
    ends_at: z.string().optional().transform((v) => v || null),
    sequence: z.string().optional().transform((v) => parseSequence(v ?? "")),
  })
  .refine((v) => !v.starts_at || !v.ends_at || v.ends_at >= v.starts_at, { message: "A data de encerramento deve ser posterior ao início", path: ["ends_at"] });
