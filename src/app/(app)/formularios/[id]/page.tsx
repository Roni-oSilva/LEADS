import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormBuilder, NEW_FORM, type BuilderInitial } from "@/components/forms/form-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getContext, isAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/supabase/env";
import { formatDate } from "@/lib/utils";
import type { FormFieldDef } from "@/lib/forms/schema";

export const metadata = { title: "Formulário" };

export default async function FormDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!isAdmin(ctx.role)) return <Alert variant="warning" title="Acesso restrito">Somente administradores podem configurar formulários.</Alert>;
  const { data: campaigns } = await ctx.supabase.from("campaigns").select("id, name").eq("organization_id", ctx.orgId);

  let initial: BuilderInitial = NEW_FORM;
  let submissions: { id: string; data: Record<string, unknown>; utm: Record<string, string>; created_at: string; lead_id: string | null }[] = [];
  if (id !== "novo") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const { data: form } = await ctx.supabase.from("forms").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
    if (!form) notFound();
    const [{ data: fields }, { data: subs }] = await Promise.all([
      ctx.supabase.from("form_fields").select("name, label, type, required, options").eq("form_id", id).order("position"),
      ctx.supabase.from("form_submissions").select("id, data, utm, created_at, lead_id").eq("form_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    submissions = (subs ?? []) as typeof submissions;
    initial = {
      id, slug: form.slug, title: form.title, description: form.description ?? "", kind: form.kind, service_interest: form.service_interest ?? "", thank_you_message: form.thank_you_message,
      thank_you_url: form.thank_you_url ?? "", campaign_id: form.campaign_id ?? "", campaign_origin: form.campaign_origin ?? "", privacy_notice: form.privacy_notice,
      collect_comm_preferences: form.collect_comm_preferences, active: form.active, fields: (fields ?? []).map((f) => ({ ...f, options: (f.options ?? []) as string[] })) as FormFieldDef[],
    };
  }
  return (
    <>
      <Link href="/formularios" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Formulários</Link>
      <PageHeader title={id === "novo" ? "Novo formulário" : initial.title} />
      <FormBuilder initial={initial} campaigns={campaigns ?? []} appUrl={appUrl()} />
      {submissions.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <CardHeader><CardTitle>Últimos envios</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <Table><THead><TR><TH>Data</TH><TH>Dados</TH><TH>UTM</TH><TH>Lead</TH></TR></THead>
              <TBody>{submissions.map((s) => <TR key={s.id}><TD className="whitespace-nowrap text-xs">{formatDate(s.created_at, true)}</TD><TD className="max-w-sm truncate text-xs text-muted-foreground">{Object.entries(s.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</TD><TD className="text-xs text-muted-foreground">{Object.entries(s.utm ?? {}).map(([k, v]) => `${k.replace("utm_", "")}=${v}`).join(" ") || "—"}</TD><TD>{s.lead_id ? <Link className="text-xs text-primary hover:underline" href={`/crm/${s.lead_id}`}>Abrir</Link> : "—"}</TD></TR>)}</TBody></Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
