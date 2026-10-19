"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BookmarkPlus, ChevronDown, Download, ExternalLink, Eye, Globe, Mail, Phone, Search, SlidersHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { Instagram } from "@/components/ui/icons";
import { Alert, EmptyState, ScoreBadge, Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { CityPicker } from "./city-picker";
import { NichePicker } from "./niche-picker";
import { UF_LIST, UF_NAMES, serviceLabel } from "@/lib/constants";
import { loadCities } from "@/lib/cities";
import { analyzeOpportunities } from "@/lib/opportunities/analyze";
import { scoreLead, type ScoringConfig } from "@/lib/scoring";
import { segmentLabel } from "@/lib/segments";
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

function preview(r: ResultRow, fallbackSegment: string | undefined, config: ScoringConfig) {
  const segment = r.segment ?? fallbackSegment ?? null;
  const evidence = analyzeOpportunities({ segment, website: r.website ?? null, instagram: r.instagram ?? null, whatsapp: r.whatsapp ?? null, phone: r.phone ?? null, source_name: r.providerKey === "google_places" ? "Google Places" : r.providerKey === "openstreetmap" ? "OpenStreetMap" : "Fonte" });
  const score = scoreLead({ segment, state: r.state ?? null, city: r.city ?? null, phone: r.phone ?? null, whatsapp: r.whatsapp ?? null, email: r.email ?? null, do_not_contact: false, data_updated_at: r.fetchedAt, showed_interest: false, evidence: evidence.map((e) => ({ confidence: e.confidence, verified: e.verified })) }, config);
  return { evidence, score };
}

function Presence({ r }: { r: ResultRow }) {
  const base = "h-4 w-4";
  const off = "opacity-25";
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" aria-label="Abrir site" className="hover:text-primary"><Globe className={base} /></a> : <span title="Site não identificado" className={off}><Globe className={base} /></span>}
      {r.instagram ? <a href={r.instagram} target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram" className="hover:text-primary"><Instagram className={base} /></a> : <span title="Instagram não identificado" className={off}><Instagram className={base} /></span>}
      {r.email ? <a href={`mailto:${r.email}`} aria-label="Enviar e-mail" title={r.email} className="hover:text-primary"><Mail className={base} /></a> : <span title="E-mail não identificado" className={off}><Mail className={base} /></span>}
    </div>
  );
}

export function FindLeads({ providers, config, canWrite, template }: { providers: ProviderInfo[]; config: ScoringConfig; canWrite: boolean; template: string }) {
  const [filters, setFilters] = useState<SearchInput>({ provider: providers.find((p) => p.configured)?.key ?? "internal", country: "BR", segments: [], cities: [] });
  const [results, setResults] = useState<ResultRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<{ provider: string; missing: string[]; instructions: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ResultRow | null>(null);
  const [cityList, setCityList] = useState<{ uf: string; list: string[] }>({ uf: "", list: [] });
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  const set = <K extends keyof SearchInput>(k: K, v: SearchInput[K]) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    const uf = filters.state;
    if (uf) loadCities(uf).then((list) => alive && setCityList({ uf, list }));
    return () => { alive = false; };
  }, [filters.state]);
  const cities = cityList.uf === filters.state ? cityList.list : [];

  const current = providers.find((p) => p.key === filters.provider);
  const unconfigured = filters.provider !== "internal" && current && !current.configured;
  const needsCity = filters.provider === "openstreetmap";
  const missingCity = needsCity && (filters.cities?.length ?? 0) === 0;
  const activeRefine = [filters.site, filters.insta, filters.wa, filters.email, filters.minRating, filters.minReviews, filters.updatedSince].filter(Boolean).length;

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
  const stats = useMemo(() => ({
    phone: results.filter((r) => r.phone || r.whatsapp).length,
    email: results.filter((r) => r.email).length,
    site: results.filter((r) => r.website).length,
    insta: results.filter((r) => r.instagram).length,
  }), [results]);

  function save(rows: ResultRow[], favorite = false) {
    startSave(async () => {
      const r = await saveProviderLeadsAction(rows.filter((x) => x.providerKey !== "internal"), filters.segments?.[0] ?? null);
      if (!r.ok) return void toast.error(r.error);
      const { saved, duplicates, ids } = r.data!;
      if (favorite) await Promise.all(ids.map((id) => toggleFavoriteAction(id, true)));
      toast.success(`${saved} lead(s) salvo(s)${duplicates ? ` · ${duplicates} já existiam (duplicidade evitada)` : ""}.`);
      setResults((prev) => prev.map((p) => { const i = rows.findIndex((x) => x.sourceRef === p.sourceRef); return i >= 0 ? { ...p, savedLeadId: ids[i] } : p; }));
      setSelected(new Set());
      setDetail(null);
    });
  }

  const toggleRow = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const rowActions = (r: ResultRow) => {
    const phone = r.whatsapp || r.phone;
    return (
      <>
        <button aria-label="Ver detalhes" onClick={() => setDetail(r)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
        {canWrite && !r.savedLeadId && <button aria-label="Salvar nos meus leads" onClick={() => save([r])} disabled={saving} className="rounded-md p-2 text-muted-foreground hover:bg-primary-soft hover:text-primary"><BookmarkPlus className="h-4 w-4" /></button>}
        {canWrite && <button aria-label="Adicionar aos favoritos" onClick={() => (r.savedLeadId ? toggleFavoriteAction(r.savedLeadId, true).then((x) => (x.ok ? toast.success("Adicionado aos favoritos.") : toast.error(x.error))) : save([r], true))} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-warning"><Star className="h-4 w-4" /></button>}
        <WhatsAppButton leadId={r.savedLeadId ?? undefined} company={r.companyName} phone={phone ?? null} template={template} blockedReason={r.doNotContact ? "Lead marcado como não contatar" : null} />
      </>
    );
  };

  const scoreCell = (r: ResultRow) => {
    const p = preview(r, filters.segments?.[0], config);
    return r.savedLeadId && r.score !== null && r.score !== undefined
      ? <ScoreBadge score={r.score} priority={r.scorePriority ?? "low"} />
      : <span title="Pontuação estimada antes de salvar" className="inline-flex items-center gap-1"><ScoreBadge score={p.score.score} priority={p.score.priority} /><span className="text-[10px] text-muted-foreground">est.</span></span>;
  };

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); run(false); }} className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fonte de dados">
            <Select value={filters.provider} onChange={(e) => set("provider", e.target.value)}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.name}{p.configured ? "" : " — não conectada"}</option>)}
              <option value="internal">Minha base (leads salvos)</option>
            </Select>
          </Field>
          <Field label="Nome da empresa (opcional)"><Input value={filters.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Auto Center" /></Field>
        </div>

        <NichePicker value={filters.segments ?? []} onChange={(v) => set("segments", v)} />

        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <Field label="Estado">
            <Select value={filters.state ?? ""} onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value, cities: [] }))}>
              <option value="">{needsCity ? "Selecione o estado…" : "Todos"}</option>
              {UF_LIST.map((u) => <option key={u} value={u}>{u} — {UF_NAMES[u]}</option>)}
            </Select>
          </Field>
          <CityPicker cities={cities} value={filters.cities ?? []} onChange={(v) => set("cities", v)} disabled={!filters.state} />
        </div>

        <details className="group rounded-lg border border-border bg-card-2/30">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden /> Refinar resultados {activeRefine > 0 && <Badge variant="primary">{activeRefine}</Badge>}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Site"><Select value={filters.site ?? ""} onChange={(e) => set("site", e.target.value as SearchInput["site"])}><option value="">Indiferente</option><option value="yes">Possui site</option><option value="no">Site não identificado</option></Select></Field>
            <Field label="Instagram"><Select value={filters.insta ?? ""} onChange={(e) => set("insta", e.target.value as SearchInput["insta"])}><option value="">Indiferente</option><option value="yes">Possui Instagram</option><option value="no">Não identificado</option></Select></Field>
            <Field label="Telefone/WhatsApp"><Select value={filters.wa ?? ""} onChange={(e) => set("wa", e.target.value as SearchInput["wa"])}><option value="">Indiferente</option><option value="yes">Somente com contato</option></Select></Field>
            <Field label="E-mail"><Select value={filters.email ?? ""} onChange={(e) => set("email", e.target.value as SearchInput["email"])}><option value="">Indiferente</option><option value="yes">Somente com e-mail</option></Select></Field>
            <Field label="Avaliação mínima"><Select value={String(filters.minRating ?? "")} onChange={(e) => set("minRating", e.target.value ? Number(e.target.value) : undefined)}><option value="">Qualquer</option>{[3, 3.5, 4, 4.5].map((n) => <option key={n} value={n}>{n}+</option>)}</Select></Field>
            <Field label="Mín. de avaliações"><Input type="number" min={0} value={filters.minReviews ?? ""} onChange={(e) => set("minReviews", e.target.value ? Number(e.target.value) : undefined)} /></Field>
            {filters.provider === "internal" && <Field label="Dados atualizados desde"><Input type="date" value={filters.updatedSince ?? ""} onChange={(e) => set("updatedSince", e.target.value)} /></Field>}
          </div>
        </details>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" className="w-full sm:w-auto" loading={searching} disabled={!!unconfigured || missingCity}><Search className="h-4 w-4" aria-hidden /> Pesquisar</Button>
          <p className="text-xs text-muted-foreground">
            {missingCity ? "Escolha o estado e ao menos uma cidade para pesquisar no OpenStreetMap." : searching && (filters.cities?.length ?? 0) > 1 ? "Pesquisando cidade por cidade — pode levar alguns segundos…" : current ? current.description : "Pesquisa na sua própria base de leads salvos."}
          </p>
        </div>
      </form>

      {unconfigured && current && (
        <Alert variant="warning" title={`${current.name} ainda não está conectada`}>
          {current.instructions} Variáveis: <code>{current.missing.join(", ")}</code>. Nenhuma pesquisa é simulada. Use <button className="underline" onClick={() => set("provider", providers.find((p) => p.configured)?.key ?? "internal")}>outra fonte</button> ou <Link className="underline" href="/importar-exportar">importe um CSV</Link>. <Link className="underline" href="/integracoes">Ver integrações</Link>.
        </Alert>
      )}
      {error && !notConfigured && <Alert variant="danger" title="Não foi possível pesquisar">{error}</Alert>}
      {notConfigured && <Alert variant="warning" title={error ?? "Fonte não configurada"}>{notConfigured.instructions}</Alert>}
      {note && results.length > 0 && <Alert variant="info">{note}</Alert>}

      {searching && results.length === 0 && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>}
      {!searching && searched && !error && results.length === 0 && <div className="rounded-xl border border-border bg-card"><EmptyState icon={Search} title="Nenhuma empresa encontrada" description="O OpenStreetMap é colaborativo e pode ter poucas empresas em algumas cidades/nichos. Tente outro nicho, mais cidades, ou remova filtros em “Refinar resultados”." /></div>}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-medium">{results.length} resultado(s)</p>
              <p className="text-xs text-muted-foreground">{stats.phone} com telefone · {stats.email} com e-mail · {stats.site} com site · {stats.insta} com Instagram</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox aria-label="Selecionar página" checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.sourceRef))} onChange={(e) => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (e.target.checked ? n.add(r.sourceRef) : n.delete(r.sourceRef))); return n; })} /> Selecionar página{selected.size > 0 && ` · ${selected.size} marcado(s)`}</label>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {canWrite && <Button size="sm" loading={saving} disabled={unsavedSelected.length === 0} onClick={() => save(unsavedSelected)}><BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Salvar ({unsavedSelected.length})</Button>}
                {canWrite && <Button size="sm" variant="secondary" loading={saving} disabled={results.every((r) => r.savedLeadId || r.providerKey === "internal")} onClick={() => save(results.filter((r) => !r.savedLeadId && r.providerKey !== "internal").slice(0, 100))}>Salvar todos (até 100)</Button>}
                <form action="/api/leads/export" method="post" target="_blank">
                  <input type="hidden" name="ids" value={JSON.stringify(savedSelected.map((r) => r.savedLeadId))} />
                  <Button type="submit" size="sm" variant="secondary" disabled={savedSelected.length === 0} title="Somente leads salvos podem ser exportados"><Download className="h-3.5 w-3.5" aria-hidden /> CSV ({savedSelected.length})</Button>
                </form>
              </div>
            </div>
          </div>

          {/* Tabela (telas médias e grandes) */}
          <div className="hidden md:block">
            <Table>
              <THead><TR><TH className="w-10" /><TH>Empresa</TH><TH>Nicho</TH><TH>Cidade/UF</TH><TH>Telefone</TH><TH>Contatos</TH><TH>Avaliação</TH><TH>Pontuação</TH><TH>Status</TH><TH className="text-right">Ações</TH></TR></THead>
              <TBody>
                {pageRows.map((r) => (
                  <TR key={r.sourceRef}>
                    <TD><Checkbox aria-label={`Selecionar ${r.companyName}`} checked={selected.has(r.sourceRef)} onChange={() => toggleRow(r.sourceRef)} /></TD>
                    <TD><button className="text-left font-medium hover:text-primary" onClick={() => setDetail(r)}>{r.companyName}</button>{r.businessStatus && r.businessStatus !== "OPERATIONAL" && <Badge variant="warning" className="ml-2">{r.businessStatus === "CLOSED_PERMANENTLY" ? "Fechada" : "Fechada temp."}</Badge>}<p className="max-w-56 truncate text-xs text-muted-foreground">{r.address}</p></TD>
                    <TD className="max-w-36 text-xs text-muted-foreground">{r.segment ? segmentLabel(r.segment) : r.category || "—"}</TD>
                    <TD className="whitespace-nowrap text-xs">{[r.city, r.state].filter(Boolean).join("/") || "—"}</TD>
                    <TD className="whitespace-nowrap text-xs">{r.whatsapp || r.phone || "—"}</TD>
                    <TD><Presence r={r} /></TD>
                    <TD className="whitespace-nowrap text-xs">{r.rating ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" aria-hidden />{r.rating.toFixed(1)} <span className="text-muted-foreground">({r.reviewsCount ?? 0})</span></span> : "—"}</TD>
                    <TD>{scoreCell(r)}</TD>
                    <TD>{r.savedLeadId ? <Badge variant="primary">{r.stageName ?? "Salvo"}</Badge> : <Badge>Não salvo</Badge>}</TD>
                    <TD><div className="flex items-center justify-end">{rowActions(r)}</div></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Cartões (celular) */}
          <ul className="divide-y divide-border md:hidden">
            {pageRows.map((r) => (
              <li key={r.sourceRef} className="space-y-2.5 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox className="mt-1" aria-label={`Selecionar ${r.companyName}`} checked={selected.has(r.sourceRef)} onChange={() => toggleRow(r.sourceRef)} />
                  <div className="min-w-0 flex-1">
                    <button className="text-left font-medium leading-tight" onClick={() => setDetail(r)}>{r.companyName}</button>
                    <p className="mt-0.5 text-xs text-muted-foreground">{[r.segment ? segmentLabel(r.segment) : r.category, [r.city, r.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</p>
                    {r.address && <p className="truncate text-xs text-muted-foreground">{r.address}</p>}
                  </div>
                  {scoreCell(r)}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-xs">
                  {(r.whatsapp || r.phone) ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" aria-hidden />{r.whatsapp || r.phone}</span> : <span className="text-muted-foreground">Sem telefone</span>}
                  <Presence r={r} />
                  {r.savedLeadId ? <Badge variant="primary">{r.stageName ?? "Salvo"}</Badge> : <Badge>Não salvo</Badge>}
                </div>
                <div className="-ml-1 flex items-center pl-7">{rowActions(r)}</div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Página {page} de {pages}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              {next && <Button size="sm" loading={searching} onClick={() => run(true)}>Carregar mais</Button>}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.companyName ?? ""} description={detail?.segment ? segmentLabel(detail.segment) : detail?.category ?? undefined} className="max-w-xl">
        {detail && (() => {
          const p = preview(detail, filters.segments?.[0], config);
          return (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                {([["Endereço", detail.address], ["Cidade/UF", [detail.city, detail.state].filter(Boolean).join("/")], ["Telefone", detail.phone], ["WhatsApp", detail.whatsapp], ["E-mail", detail.email], ["Site", detail.website], ["Instagram", detail.instagram], ["Avaliação", detail.rating ? `${detail.rating.toFixed(1)} (${detail.reviewsCount ?? 0} avaliações)` : null], ["Coletado em", formatDate(detail.fetchedAt, true)], ["Fonte", detail.providerKey === "google_places" ? "Google Places" : detail.providerKey === "openstreetmap" ? "OpenStreetMap" : detail.providerKey === "internal" ? "Minha base" : detail.providerKey]] as [string, string | null | undefined][]).map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words">{v || "—"}</dd></div>
                ))}
              </dl>
              {detail.sourceUrl && <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver na fonte <ExternalLink className="h-3 w-3" /></a>}
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
