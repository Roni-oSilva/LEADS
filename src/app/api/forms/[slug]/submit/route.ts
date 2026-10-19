import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildSubmissionSchema, pickUtm, type FormFieldDef } from "@/lib/forms/schema";
import { processSubmission, type FormRecord } from "@/lib/forms/submit";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
const MAX_BODY = 30_000;

const bodySchema = z.object({
  data: z.record(z.string(), z.unknown()),
  utm: z.record(z.string(), z.unknown()).optional(),
  ref: z.string().max(500).optional(),
  prefs: z.object({ whatsapp: z.boolean(), email: z.boolean(), phone: z.boolean() }).optional(),
  privacy: z.literal(true),
  hp: z.string().max(0).optional(), // honeypot: precisa estar vazio
  t: z.number(),                    // timestamp de renderização
});

const fail = (message: string, status: number) => NextResponse.json({ ok: false, error: message }, { status });

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  if (!isServiceRoleConfigured()) return fail("Serviço indisponível.", 503);
  const { slug } = await ctx.params;

  // Só aceita envios originados do próprio site/iframe de embed.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) return fail("Origem não permitida.", 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail("Requisição muito grande.", 413);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`${process.env.IP_HASH_SALT ?? "leadfinder"}:${ip}`).digest("hex").slice(0, 32);
  if (!(await rateLimit(`form:${slug}:${ipHash}`, 5, 600)) || !(await rateLimit(`form:${slug}`, 300, 3600))) return fail("Muitos envios. Tente novamente em alguns minutos.", 429);

  let json: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return fail("Requisição muito grande.", 413);
    json = JSON.parse(text);
  } catch {
    return fail("Requisição inválida.", 400);
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return fail("Confirme o aviso de privacidade e preencha o formulário corretamente.", 400);
  const age = Date.now() - body.data.t;
  if (age < 1500 || age > 86_400_000) return fail("Envio recusado. Recarregue a página e tente novamente.", 400);

  const db = createAdminClient();
  const { data: form } = await db.from("forms").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (!form) return fail("Formulário não encontrado.", 404);
  const { data: fieldRows } = await db.from("form_fields").select("name, label, type, required, options").eq("form_id", form.id).order("position");
  const fields: FormFieldDef[] = (fieldRows ?? []).map((f) => ({ name: f.name, label: f.label, type: f.type, required: f.required, options: (f.options ?? []) as string[] }));

  const parsed = buildSubmissionSchema(fields).safeParse(body.data.data);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);

  try {
    await processSubmission({
      form: form as FormRecord,
      fields,
      data: parsed.data as Record<string, unknown>,
      utm: pickUtm(body.data.utm),
      referrer: body.data.ref ?? req.headers.get("referer"),
      ipHash,
      prefs: body.data.prefs ?? { whatsapp: true, email: true, phone: true },
    });
  } catch (e) {
    console.error("falha ao processar formulário", e);
    return fail("Não foi possível registrar seu envio agora. Tente novamente.", 500);
  }
  return NextResponse.json({ ok: true, message: form.thank_you_message, redirect: form.thank_you_url ?? null });
}
