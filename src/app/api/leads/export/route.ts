import { NextResponse, type NextRequest } from "next/server";
import { audit, getContext } from "@/lib/auth";
import { EXPORT_FIELDS, toCsv } from "@/lib/csv/leads-csv";
import { applyLeadFilters, LEAD_SELECT, parseLeadQuery } from "@/lib/leads/query";

export const dynamic = "force-dynamic";
const MAX_ROWS = 10000;

async function handle(params: URLSearchParams, ids: string[] | null) {
  const ctx = await getContext(); // sessão obrigatória; o RLS limita à organização do usuário
  const wanted = (params.get("fields") ?? "").split(",").filter(Boolean);
  const fields = wanted.length ? EXPORT_FIELDS.filter((f) => wanted.includes(f.key)) : EXPORT_FIELDS;
  if (fields.length === 0) return NextResponse.json({ error: "Nenhum campo selecionado." }, { status: 400 });

  const base = ctx.supabase.from("leads").select(LEAD_SELECT);
  let query;
  if (ids) query = base.eq("organization_id", ctx.orgId).in("id", ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, MAX_ROWS));
  else query = applyLeadFilters(base, ctx, parseLeadQuery(Object.fromEntries(params.entries())));
  const { data, error } = await query.order("created_at", { ascending: false }).limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    stage: (l.stage as { name?: string } | null)?.name ?? "",
    source: (l.source as { name?: string } | null)?.name ?? "",
  }));
  await audit(ctx, "export.csv", "lead", undefined, { rows: rows.length, fields: fields.map((f) => f.key) });
  return new NextResponse(toCsv(rows, fields), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  return handle(req.nextUrl.searchParams, null);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("ids") ?? "[]"));
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return NextResponse.json({ error: "Seleção inválida." }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ error: "Nenhum lead selecionado." }, { status: 400 });
  const params = new URLSearchParams();
  const fields = form.get("fields");
  if (typeof fields === "string") params.set("fields", fields);
  return handle(params, ids);
}
