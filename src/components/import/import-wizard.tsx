"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { autoMapColumns, IMPORT_FIELDS, mapRow, validateRows } from "@/lib/csv/leads-csv";
import { checkImportDuplicatesAction, finishImportAction, importChunkAction } from "@/lib/import/actions";

const MAX_ROWS = 5000;
const MAX_BYTES = 5 * 1024 * 1024;
const CHUNK = 100;

type Step = "upload" | "map" | "preview" | "done";

export function ImportWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dupIdx, setDupIdx] = useState<Set<number>>(new Set());
  const [checking, setChecking] = useState(false);
  const [skipDup, setSkipDup] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors: { line: number; message: string }[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => (step === "preview" || step === "done" ? validateRows(rows, mapping) : []), [rows, mapping, step]);
  const valid = validation.filter((v) => v.ok);
  const invalid = validation.filter((v) => !v.ok);
  const hasCompany = Object.values(mapping).includes("company_name");

  function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return setError("Selecione um arquivo .csv.");
    if (file.size > MAX_BYTES) return setError("Arquivo acima de 5 MB. Divida em partes menores.");
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hs = res.meta.fields?.filter(Boolean) ?? [];
        if (hs.length === 0 || res.data.length === 0) return setError("Não foi possível ler cabeçalho e linhas do CSV.");
        if (res.data.length > MAX_ROWS) return setError(`O arquivo tem ${res.data.length} linhas; o máximo por importação é ${MAX_ROWS}.`);
        setFilename(file.name); setHeaders(hs); setRows(res.data); setMapping(autoMapColumns(hs)); setStep("map");
      },
      error: (e) => setError(`Falha ao ler o arquivo: ${e.message}`),
    });
  }

  async function goPreview() {
    setChecking(true); setError(null);
    try {
      const v = validateRows(rows, mapping);
      const mapped = v.map((x, i) => ({ i, raw: mapRow(rows[i], mapping), ok: x.ok })).filter((x) => x.ok);
      const dups = new Set<number>();
      let seen: string[] = [];
      for (let s = 0; s < mapped.length; s += 400) {
        const chunk = mapped.slice(s, s + 400);
        const r = await checkImportDuplicatesAction(chunk.map((c) => c.raw), seen);
        if (!r.ok) throw new Error(r.error);
        r.data!.duplicates.forEach((d) => dups.add(chunk[d].i));
        seen = r.data!.keys.slice(-5000);
      }
      setDupIdx(dups); setConfirmed(false); setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao verificar duplicidades.");
    } finally { setChecking(false); }
  }

  async function runImport() {
    setRunning(true); setError(null); setProgress(0);
    const toSend = valid.map((v) => ({ line: v.line, raw: mapRow(rows[v.line - 2], mapping) }));
    let imported = 0, duplicates = 0;
    const errors = invalid.map((v) => ({ line: v.line, message: v.errors.join("; ") }));
    try {
      for (let s = 0; s < toSend.length; s += CHUNK) {
        const chunk = toSend.slice(s, s + CHUNK);
        const r = await importChunkAction(chunk.map((c) => c.raw), skipDup);
        if (!r.ok) throw new Error(r.error);
        imported += r.data!.imported; duplicates += r.data!.duplicates;
        r.data!.errors.forEach((e) => errors.push({ line: chunk[e.index].line, message: e.message }));
        setProgress(Math.round(((s + chunk.length) / toSend.length) * 100));
      }
      await finishImportAction({ filename, total: rows.length, imported, duplicates, errors, mapping });
      setResult({ imported, duplicates, errors, total: rows.length });
      setStep("done");
      toast.success(`${imported} lead(s) importado(s).`);
      router.refresh();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Falha na importação."} Lotes já concluídos permanecem gravados; reenviar o arquivo ignora duplicidades.`);
    } finally { setRunning(false); }
  }

  function downloadErrors() {
    const list = result?.errors ?? [];
    const csv = `﻿linha,erro\r\n${list.map((e) => `${e.line},"${e.message.replaceAll('"', '""')}"`).join("\r\n")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "erros-importacao.csv";
    a.click();
  }

  function reset() { setStep("upload"); setRows([]); setHeaders([]); setMapping({}); setResult(null); setError(null); if (inputRef.current) inputRef.current.value = ""; }

  return (
    <Card>
      <CardHeader><div><CardTitle>Importar CSV</CardTitle><CardDescription>Envie uma planilha, confira o mapeamento e a prévia, e confirme antes de gravar. Importe apenas dados que você tem direito de usar.</CardDescription></div></CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {step === "upload" && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card-2/40 px-6 py-10 text-center transition-colors hover:border-primary/60">
            <FileUp className="h-7 w-7 text-primary" aria-hidden />
            <span className="text-sm font-medium">Selecionar arquivo CSV</span>
            <span className="text-xs text-muted-foreground">Até 5 MB e {MAX_ROWS} linhas · primeira linha = cabeçalho · UTF-8, separador vírgula ou ponto e vírgula</span>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        )}

        {step === "map" && (
          <>
            <p className="text-sm"><strong>{filename}</strong> · {rows.length} linha(s)</p>
            <Table>
              <THead><TR><TH>Coluna do arquivo</TH><TH>Exemplo</TH><TH>Importar como</TH></TR></THead>
              <TBody>{headers.map((h) => (
                <TR key={h}>
                  <TD className="font-medium">{h}</TD>
                  <TD className="max-w-48 truncate text-xs text-muted-foreground">{rows[0]?.[h]}</TD>
                  <TD><Select aria-label={`Mapear ${h}`} className="h-8 w-56 text-xs" value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[h] = e.target.value; else delete n[h]; return n; })}>
                    <option value="">Ignorar coluna</option>
                    {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key} disabled={Object.entries(mapping).some(([k, v]) => v === f.key && k !== h)}>{f.label}{f.required ? " *" : ""}</option>)}
                  </Select></TD>
                </TR>
              ))}</TBody>
            </Table>
            {!hasCompany && <Alert variant="warning">Mapeie uma coluna para “Nome da empresa” (obrigatório).</Alert>}
            <div className="flex justify-between"><Button variant="ghost" onClick={reset}>Cancelar</Button><Button disabled={!hasCompany} loading={checking} onClick={goPreview}>Validar e pré-visualizar</Button></div>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {[["Linhas", rows.length, "default"], ["Válidas", valid.length, "success"], ["Duplicadas", dupIdx.size, "warning"], ["Com erro", invalid.length, "danger"]].map(([l, v, c]) => (
                <div key={String(l)} className="rounded-lg border border-border bg-card-2/50 p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums"><Badge variant={c as "default"} className="text-base">{v}</Badge></p></div>
              ))}
            </div>
            {invalid.length > 0 && (
              <details className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs"><summary className="cursor-pointer font-medium text-danger"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{invalid.length} linha(s) com erro (não serão importadas)</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{invalid.slice(0, 100).map((v) => <li key={v.line}>Linha {v.line}: {v.errors.join("; ")}</li>)}</ul></details>
            )}
            <p className="text-xs font-medium text-muted-foreground">Prévia das primeiras linhas válidas</p>
            <Table>
              <THead><TR><TH>Linha</TH><TH>Empresa</TH><TH>Telefone</TH><TH>E-mail</TH><TH>Cidade/UF</TH><TH>Situação</TH></TR></THead>
              <TBody>{valid.slice(0, 10).map((v) => (
                <TR key={v.line}><TD>{v.line}</TD><TD className="font-medium">{v.data!.company_name}</TD><TD className="text-xs">{v.data!.phone ?? "—"}</TD><TD className="text-xs">{v.data!.email ?? "—"}</TD><TD className="text-xs">{[v.data!.city, v.data!.state].filter(Boolean).join("/") || "—"}</TD>
                  <TD>{dupIdx.has(v.line - 2) ? <Badge variant="warning">Duplicado</Badge> : <Badge variant="success">Novo</Badge>}</TD></TR>
              ))}</TBody>
            </Table>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /> Ignorar duplicidades (recomendado)</label>
            <label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> <span>Confirmo que tenho base legítima para tratar estes contatos e que os dados vieram de fonte permitida.</span></label>
            {running && <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress}><div className="h-2 bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setStep("map")} disabled={running}>Voltar</Button>
              <Button disabled={!confirmed || valid.length === 0 || running} loading={running} onClick={runImport}>{running ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando {progress}%</> : `Importar ${skipDup ? valid.length - dupIdx.size : valid.length} lead(s)`}</Button></div>
          </>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <Alert variant="success" title="Importação concluída"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{result.imported} importado(s) · {result.duplicates} duplicado(s) ignorado(s) · {result.errors.length} erro(s) · {result.total} linha(s) no arquivo.</Alert>
            <div className="flex gap-2">{result.errors.length > 0 && <Button variant="secondary" size="sm" onClick={downloadErrors}><Download className="h-3.5 w-3.5" aria-hidden /> Baixar relatório de erros</Button>}<Button size="sm" onClick={reset}>Nova importação</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
