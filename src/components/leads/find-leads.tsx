"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookmarkPlus, Download, ExternalLink, Eye, Globe, MapPin, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { Instagram } from "@/components/ui/icons";
import { Alert, EmptyState, ScoreBadge, Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { SEGMENTS, UF_LIST, serviceLabel } from "@/lib/constants";
import { analyzeOpportunities } from "@/lib/opportunities/analyze";
import { scoreLead, type ScoringConfig } from "@/lib/scoring";
import { formatDate } from "@/lib/utils";
import { saveProviderLeadsAction, toggleFavoriteAction } from "@/lib/leads/actions";
import { searchLeadsAction } from "@/lib/providers/search-action";
import type { ResultRow, SearchInput } from "@/lib/providers/search-types";

export interface ProviderInfo {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  missing: string[];
  instructions: string;
}

const PAGE_SIZE = 10;

function preview(r: ResultRow, segment: string | undefined, config: ScoringConfig) {
  const evidence = analyzeOpportunities({ segment: segment ?? null, website: r.website ?? null, instagram: r.instagram ?? null, whatsapp: r.whatsapp ?? null, phone: r.phone ?? null, source_name: r.providerKey === "google_places" ? "Google Places" : "Fonte" });
  const score = scoreLead({ segment: segment ?? null, state: r.state ?? null, city: r.city ?? null, phone: r.phone ?? null, whatsapp: r.whatsapp ?? null, email: null, do_not_contact: false, data_updated_at: r.fetchedAt, showed_interest: false, evidence: evidence.map((e) => ({ confidence: e.confidence, verified: e.verified })) }, config);
  return { evidence, score };
}

export function FindLeads({ providers, config, canWrite, template }: { providers: ProviderInfo[]; config: ScoringConfig; canWrite: boolean; template: string }) {
  const [filters, setFilters] = useState<SearchInput>({ provider: providers.find((p) => p.configured)?.key ?? "internal", country: "BR" });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<{ provider: string; missing: string[]; instructions: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ResultRow | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  const set = <K extends keyof SearchInput>(k: K, v: SearchInput[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const current = providers.find((p) => p.key === filters.provider);
  const unconfigured = filters.provider !== "internal" && current && !current.configured;

  function run(append: boolean) {
    startSearch(async () => {
      setError(null);
      setNotConfigured(null);
      const r = await searchLeadsAction({ ...filters, pageToken: append ? next : null });
      setSearched(true);
      if (!r.ok) {
        setError(r.error);
        if (r.notConfigured) setNotConfigured(r.notConfigured);
        return;
      }
      const incoming = r.data!.results;
      setResults((prev) => {
        if (!append) return incoming;
        const seen = new Set(prev.map((p) => p.sourceRef));
        return [...prev, ...incoming.filter((i) => !seen.has(i.sourceRef))];
      });
      setNext(r.data!.nextPageToken);
      setNote(r.data!.note);
      if (!append) { setPage(1); setSelected(new Set()); }
    });
  }

  const pageRows = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const selectedRows = useMemo(() => results.filter((r) => selected.has(r.sourceRef)), [results, selected]);
  const unsavedSelected = selectedRows.filter((r) => !r.savedLeadId);
  const savedSelected = selectedRows.filter((r) => r.savedLeadId);

  function save(rows: ResultRow[], favorite = false) {
    startSave(async () => {
      const r = await saveProviderLeadsAction(rows.filter((x) => x.providerKey !== "internal"), filters.segment || null);
      if (!r.ok) return void toast.error(r.error);
      const { saved, duplicates, ids } = r.data!;
      if (favorite) await Promise.all(ids.map((id) => toggleFavoriteAction(id, true)));
      toast.success(`${saved} lead(s) salvo(s)${duplicates ? ` · ${duplicates} já existiam (duplicidade evitada)` : ""}.`);
      // Reflete o estado salvo na tabela sem nova pesquisa à API.
      setResults((prev) => prev.map((p) => { const i = rows.findIndex((x) => x.sourceRef === p.sourceRef); return i >= 0 ? { ...p, savedLeadId: ids[i] } : p; }));
      setSelected(new Set());
      setDetail(null);
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); run(false); }} className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fonte de dados" className="lg:col-span-2">
            <Select value={filters.provider} onChange={(e) => set("provider", e.target.value)}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.name}{p.configured ? "" : " — não conectada"}</option>)}
              <option value="internal">Minha base (leads salvos)</option>
            </Select>
          </Field>
          <Field label="Nome da empresa"><Input value={filters.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Pizzaria Bella" /></Field>
          <Field label="Segmento">
            <Select value={filters.segment ?? ""} onChange={(e) => set("segment", e.target.value)}><option value="">Qualquer</option>{SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
          </Field>
          <Field label="País"><Select value={filters.country} onChange={(e) => set("country", e.target.value)}><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="US">Estados Unidos</option></Select></Field>
          <Field label="Estado"><Select value={filters.state ?? ""} onChange={(e) => set("state", e.target.value)}><option value="">Todos</option>{UF_LIST.map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label="Cidade"><Input value={filters.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Campinas" /></Field>
          <Field label="Bairro"><Input value={filters.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
          <Field label="Categoria comercial"><Input value={filters.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="Ex.: pizzaria delivery" /></Field>
          <Field label="Site"><Select value={filters.site ?? ""} onChange={(e) => set("site", e.target.value as SearchInput["site"])}><option value="">Indiferente</option><option value="yes">Possui site</option><option value="no">Site não identificado</option></Select></Field>
          <Field label="Instagram"><Select value={filters.insta ?? ""} onChange={(e) => set("insta", e.target.value as SearchInput["insta"])}><option value="">Indiferente</option><option value="yes">Possui Instagram</option><option value="no">Não identificado</option></Select></Field>
          <Field label="WhatsApp/telefone público"><Select value={filters.wa ?? ""} onChange={(e) => set("wa", e.target.value as SearchInput["wa"])}><option value="">Indiferente</option><option value="yes">Com contato público</option></Select></Field>
          <Field label="Avaliação mínima"><Select value={String(filters.minRating ?? "")} onChange={(e) => set("minRating", e.target.value ? Number(e.target.value) : undefined)}><option value="">Qualquer</option>{[3, 3.5, 4, 4.5].map((n) => <option key={n} value={n}>{n}+</option>)}</Select></Field>
          <Field label="Mín. de avaliações"><Input type="number" min={0} value={filters.minReviews ?? ""} onChange={(e) => set("minReviews", e.target.value ? Number(e.target.value) : undefined)} /></Field>
          {filters.provider === "internal" && <Field label="Dados atualizados desde"><Input type="date" value={filters.updatedSince ?? ""} onChange={(e) => set("updatedSince", e.target.value)} /></Field>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" loading={searching} disabled={!!unconfigured}><Search className="h-4 w-4" aria-hidden /> Pesquisar</Button>
          <p className="text-xs text-muted-foreground">{current ? current.description : "Pesquisa na sua própria base de leads salvos."}</p>
        </div>
      </form>

      {unconfigured && current && (
        <Alert variant="warning" title={`${current.name} ainda não está conectada`}>
          {current.instructions} Variáveis necessárias: <code>{current.missing.join(", ")}</code>. Nenhuma pesquisa é simulada. Enquanto isso, você pode usar <button className="underline" onClick={() => set("provider", "internal")}>Minha base</button> ou <Link className="underline" href="/importar-exportar">importar um CSV</Link>. <Link className="underline" href="/integracoes">Ver integrações</Link>.
        </Alert>
      )}
      {error && !notConfigured && <Alert variant="danger" title="Não foi possível pesquisar">{error}</Alert>}
      {notConfigured && <Alert variant="warning" title={error ?? "Fonte não configurada"}>{notConfigured.instructions}</Alert>}
      {note && results.length > 0 && <Alert variant="info">{note}</Alert>}

      {searching && results.length === 0 && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}

      {!searching && searched && !error && results.length === 0 && <div className="rounded-xl border border-border bg-card"><EmptyState icon={Search} title="Nenhuma empresa encontrada" description="Tente ampliar a localização, remover filtros de presença digital ou mudar o segmento." /></div>}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-medium">{results.length} resultado(s)</p>
            {selected.size > 0 && <span className="text-xs text-muted-foreground">· {selected.size} selecionado(s)</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canWrite && <Button size="sm" loading={saving} disabled={unsavedSelected.length === 0} onClick={() => save(unsavedSelected)}><BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Salvar selecionados ({unsavedSelected.length})</Button>}
              <form action="/api/leads/export" method="post" target="_blank">
                <input type="hidden" name="ids" value={JSON.stringify(savedSelected.map((r) => r.savedLeadId))} />
                <Button type="submit" size="sm" variant="secondary" disabled={savedSelected.length === 0} title="Somente leads salvos podem ser exportados"><Download className="h-3.5 w-3.5" aria-hidden /> Exportar CSV ({savedSelected.length})</Button>
              </form>
            </div>
          </div>
          <Table>
            <THead>
              <TR>
                <TH className="w-10"><Checkbox aria-label="Selecionar página" checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.sourceRef))} onChange={(e) => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (e.target.checked ? n.add(r.sourceRef) : n.delete(r.sourceRef))); return n; })} /></TH>
                <TH>Empresa</TH><TH>Segmento</TH><TH>Cidade/UF</TH><TH>Telefone</TH><TH>Presença digital</TH><TH>Avaliação</TH><TH>Pontuação</TH><TH>Status</TH><TH>Descoberta</TH><TH className="text-right">Ações</TH>
              </TR>
            </THead>
            <TBody>
              {pageRows.map((r) => {
                const p = preview(r, filters.segment, config);
                const phone = r.whatsapp || r.phone;
                return (
                  <TR key={r.sourceRef}>
                    <TD><Checkbox aria-label={`Selecionar ${r.companyName}`} checked={selected.has(r.sourceRef)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.sourceRef)) n.delete(r.sourceRef); else n.add(r.sourceRef); return n; })} /></TD>
                    <TD><button className="text-left font-medium hover:text-primary" onClick={() => setDetail(r)}>{r.companyName}</button>{r.businessStatus && r.businessStatus !== "OPERATIONAL" && <Badge variant="warning" className="ml-2">{r.businessStatus === "CLOSED_PERMANENTLY" ? "Fechada" : "Fechada temp."}</Badge>}<p className="max-w-56 truncate text-xs text-muted-foreground">{r.address}</p></TD>
                    <TD className="text-xs text-muted-foreground">{r.category || "—"}</TD>
                    <TD className="whitespace-nowrap text-xs">{[r.city, r.state].filter(Boolean).join("/") || "—"}</TD>
                    <TD className="whitespace-nowrap text-xs">{phone || "—"}</TD>
                    <TD><div className="flex items-center gap-2 text-muted-foreground">
                      {r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" aria-label="Abrir site" className="hover:text-primary"><Globe className="h-4 w-4" /></a> : <span title="Site não identificado" className="opacity-30"><Globe className="h-4 w-4" /></span>}
                      {r.instagram ? <a href={r.instagram} target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram" className="hover:text-primary"><Instagram className="h-4 w-4" /></a> : <span title="Instagram não identificado" className="opacity-30"><Instagram className="h-4 w-4" /></span>}
                    </div></TD>
                    <TD className="whitespace-nowrap text-xs">{r.rating ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" aria-hidden />{r.rating.toFixed(1)} <span className="text-muted-foreground">({r.reviewsCount ?? 0})</span></span> : "—"}</TD>
                    <TD>{r.savedLeadId && r.score !== null && r.score !== undefined ? <ScoreBadge score={r.score} priority={r.scorePriority ?? "low"} /> : <span title="Pontuação estimada antes de salvar (critérios padrão da organização)" className="inline-flex items-center gap-1"><ScoreBadge score={p.score.score} priority={p.score.priority} /><span className="text-[10px] text-muted-foreground">est.</span></span>}</TD>
                    <TD>{r.savedLeadId ? <Badge variant="primary">{r.stageName ?? "Salvo"}</Badge> : <Badge>Não salvo</Badge>}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.updatedAt ?? r.fetchedAt)}</TD>
                    <TD><div className="flex items-center justify-end gap-0.5">
                      <button aria-label="Ver detalhes" onClick={() => setDetail(r)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
                      {canWrite && !r.savedLeadId && <button aria-label="Salvar nos meus leads" onClick={() => save([r])} disabled={saving} className="rounded-md p-1.5 text-muted-foreground hover:bg-primary-soft hover:text-primary"><BookmarkPlus className="h-4 w-4" /></button>}
                      {canWrite && <button aria-label="Adicionar aos favoritos" onClick={() => (r.savedLeadId ? toggleFavoriteAction(r.savedLeadId, true).then((x) => (x.ok ? toast.success("Adicionado aos favoritos.") : toast.error(x.error))) : save([r], true))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-warning"><Star className="h-4 w-4" /></button>}
                      <WhatsAppButton leadId={r.savedLeadId ?? undefined} company={r.companyName} phone={phone ?? null} template={template} blockedReason={r.doNotContact ? "Lead marcado como não contatar" : null} />
                    </div></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Página {page} de {pages}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              {next && <Button size="sm" loading={searching} onClick={() => run(true)}>Carregar mais resultados</Button>}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.companyName ?? ""} description={detail?.category ?? undefined} className="max-w-xl">
        {detail && (() => {
          const p = preview(detail, filters.segment, config);
          return (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                {([["Endereço", detail.address], ["Cidade/UF", [detail.city, detail.state].filter(Boolean).join("/")], ["Telefone", detail.whatsapp || detail.phone], ["Site", detail.website], ["Instagram", detail.instagram], ["Avaliação", detail.rating ? `${detail.rating.toFixed(1)} (${detail.reviewsCount ?? 0} avaliações)` : null], ["Coletado em", formatDate(detail.fetchedAt, true)], ["Fonte", detail.providerKey === "google_places" ? "Google Places" : detail.providerKey === "internal" ? "Minha base" : detail.providerKey]] as [string, string | null][]).map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words">{v || "—"}</dd></div>
                ))}
              </dl>
              {detail.sourceUrl && <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><MapPin className="h-3 w-3" /> Ver na fonte <ExternalLink className="h-3 w-3" /></a>}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Oportunidades (prévia, não verificadas)</p>
                {p.evidence.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum sinal identificado nos dados disponíveis.</p> : (
                  <ul className="space-y-2">{p.evidence.map((e) => <li key={e.signal_key} className="rounded-lg border border-border bg-card-2/50 p-2.5 text-xs"><p className="font-medium">{e.title} <span className="text-muted-foreground">· {serviceLabel(e.service)}</span></p><p className="mt-1 text-muted-foreground">{e.evidence}</p></li>)}</ul>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {detail.savedLeadId ? <Link href={`/crm/${detail.savedLeadId}`} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">Abrir no CRM</Link> : canWrite && (
                  <>
                    <Button variant="secondary" loading={saving} onClick={() => save([detail], true)}><Star className="h-4 w-4" aria-hidden /> Salvar e favoritar</Button>
                    <Button loading={saving} onClick={() => save([detail])}><BookmarkPlus className="h-4 w-4" aria-hidden /> Salvar nos meus leads</Button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Dialog>
    </div>
  );
}
