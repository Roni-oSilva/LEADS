import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getContext, isAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Formulários" };

export default async function FormsPage() {
  const ctx = await getContext();
  const [{ data: forms, error }, { data: subs }] = await Promise.all([
    ctx.supabase.from("forms").select("id, title, slug, kind, active, created_at").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }),
    ctx.supabase.from("form_submissions").select("form_id").eq("organization_id", ctx.orgId).limit(10000),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const s of subs ?? []) counts.set(s.form_id, (counts.get(s.form_id) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Formulários" description="Capture leads no seu site com formulários próprios, UTM, consentimento e código de incorporação." actions={isAdmin(ctx.role) ? <Link href="/formularios/novo" className={buttonVariants()}><Plus className="h-4 w-4" aria-hidden /> Novo formulário</Link> : undefined} />
      <Card className="overflow-hidden">
        {(forms ?? []).length === 0 ? <EmptyState icon={ClipboardList} title="Nenhum formulário criado" description="Crie um formulário de orçamento, diagnóstico gratuito ou demonstração e incorpore no seu site." /> : (
          <Table><THead><TR><TH>Formulário</TH><TH>Tipo</TH><TH>Status</TH><TH>Envios</TH><TH>Criado em</TH></TR></THead>
            <TBody>{(forms ?? []).map((f) => <TR key={f.id}><TD><Link href={`/formularios/${f.id}`} className="font-medium hover:text-primary">{f.title}</Link><p className="text-xs text-muted-foreground">/f/{f.slug}</p></TD><TD className="text-xs capitalize">{f.kind}</TD><TD><Badge variant={f.active ? "success" : "default"}>{f.active ? "Ativo" : "Inativo"}</Badge></TD><TD>{counts.get(f.id) ?? 0}</TD><TD className="text-xs">{formatDate(f.created_at)}</TD></TR>)}</TBody></Table>
        )}
      </Card>
    </>
  );
}
