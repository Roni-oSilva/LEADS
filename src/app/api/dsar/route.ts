import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const schema = z.object({
  org: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  kind: z.enum(["access", "correction", "deletion", "opposition", "portability", "other"]),
  details: z.string().trim().max(1500).optional(),
  hp: z.string().max(0).optional(),
  t: z.number(),
});

export async function POST(req: NextRequest) {
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: false, error: "Serviço indisponível." }, { status: 503 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ ok: false, error: "Origem não permitida." }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const h = createHash("sha256").update(`${process.env.IP_HASH_SALT ?? "leadfinder"}:${ip}`).digest("hex").slice(0, 32);
  if (!(await rateLimit(`dsar:${h}`, 3, 3600))) return NextResponse.json({ ok: false, error: "Muitas solicitações. Tente mais tarde." }, { status: 429 });

  const text = await req.text();
  if (text.length > 10_000) return NextResponse.json({ ok: false, error: "Requisição muito grande." }, { status: 413 });
  let body: z.infer<typeof schema>;
  try {
    const p = schema.safeParse(JSON.parse(text));
    if (!p.success) return NextResponse.json({ ok: false, error: "Preencha todos os campos corretamente." }, { status: 400 });
    body = p.data;
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }
  const age = Date.now() - body.t;
  if (age < 1500 || age > 86_400_000) return NextResponse.json({ ok: false, error: "Recarregue a página e tente novamente." }, { status: 400 });

  const db = createAdminClient();
  const { data: org } = await db.from("organizations").select("id").eq("slug", body.org).maybeSingle();
  if (!org) return NextResponse.json({ ok: false, error: "Organização não encontrada." }, { status: 404 });
  const { error } = await db.from("dsar_requests").insert({ organization_id: org.id, requester_name: body.name, requester_email: body.email, kind: body.kind, details: body.details || null });
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível registrar agora." }, { status: 500 });
  // Pedido de oposição: já impede novos contatos para este e-mail enquanto a solicitação é analisada.
  if (body.kind === "opposition") await db.from("suppression_list").upsert({ organization_id: org.id, kind: "email", value: body.email, reason: "Oposição solicitada pelo titular" }, { onConflict: "organization_id,kind,value", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
