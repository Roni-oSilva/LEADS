import { SegmentOptions } from "@/components/ui/segment-options";
import { Download } from "lucide-react";
import { ExportFieldsScript } from "@/components/import/export-fields-script";
import { ImportWizard } from "@/components/import/import-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Select } from "@/components/ui/form-controls";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canWrite, getContext } from "@/lib/auth";
import { UF_LIST } from "@/lib/constants";
import { EXPORT_FIELDS, IMPORT_FIELDS } from "@/lib/csv/leads-csv";
import { getStages } from "@/lib/leads/service";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Importar e Exportar" };

export default async function ImportExportPage() {
  const ctx = await getContext();
  const [stages, { data: jobs }] = await Promise.all([
    getStages(ctx.supabase, ctx.orgId),
    ctx.supabase.from("import_jobs").select("id, filename, total_rows, imported_rows, duplicate_rows, error_rows, created_at").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <>
      <PageHeader title="Importar e Exportar" description="Traga leads de planilhas e exporte seus dados com os campos e filtros que quiser." />
      <div className="space-y-6">
        {canWrite(ctx.role) ? <ImportWizard /> : <Alert variant="info">Seu perfil é somente leitura: a importação está desativada.</Alert>}
        <Card>
          <CardHeader><div><CardTitle>Colunas reconhecidas na importação</CardTitle><CardDescription>Cabeçalhos com estes nomes (ou parecidos) são mapeados automaticamente. Você pode ajustar na etapa de mapeamento.</CardDescription></div></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{IMPORT_FIELDS.map((f) => f.label + (f.required ? " *" : "")).join(" · ")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Exportar CSV</CardTitle><CardDescription>Exporta somente leads da sua organização. Cada exportação é registrada na auditoria.</CardDescription></div></CardHeader>
          <CardContent>
            <form action="/api/leads/export" method="get" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-muted-foreground">Etapa<Select name="stage" className="mt-1"><option value="">Todas</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
                <label className="text-xs text-muted-foreground">Segmento<Select name="segment" className="mt-1"><option value="">Todos</option><SegmentOptions /></Select></label>
                <label className="text-xs text-muted-foreground">Estado<Select name="state" className="mt-1"><option value="">Todos</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select></label>
                <label className="text-xs text-muted-foreground">Prioridade<Select name="priority" className="mt-1"><option value="">Todas</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></Select></label>
              </div>
              <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Campos</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{EXPORT_FIELDS.map((f) => <label key={f.key} className="flex items-center gap-2 text-sm"><Checkbox data-fieldsel value={f.key} defaultChecked /> {f.label}</label>)}</div>
              </fieldset>
              <ExportSubmit />
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Histórico de importações</CardTitle></CardHeader>
          <CardContent className="px-0 pb-2">
            {(jobs ?? []).length === 0 ? <p className="px-5 pb-3 text-sm text-muted-foreground">Nenhuma importação realizada.</p> : (
              <Table><THead><TR><TH>Arquivo</TH><TH>Linhas</TH><TH>Importadas</TH><TH>Duplicadas</TH><TH>Erros</TH><TH>Data</TH></TR></THead>
                <TBody>{(jobs ?? []).map((j) => <TR key={j.id}><TD className="font-medium">{j.filename}</TD><TD>{j.total_rows}</TD><TD>{j.imported_rows}</TD><TD>{j.duplicate_rows}</TD><TD>{j.error_rows}</TD><TD className="text-xs">{formatDate(j.created_at, true)}</TD></TR>)}</TBody></Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ExportSubmit() {
  return (
    <>
      {/* Converte os checkboxes em "fields=a,b,c" antes do envio */}
      <ExportFieldsScript />
      <Button type="submit"><Download className="h-4 w-4" aria-hidden /> Exportar CSV</Button>
    </>
  );
}

