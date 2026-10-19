import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe, MapPin, Phone, Mail, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram } from "@/components/ui/icons";
import { Alert, EmptyState, ScoreBadge } from "@/components/ui/misc";
import { AnalyzeButtons, ContactLog, DeleteLeadButton, EditLeadButton, FollowUpForm, NoteForm, PrivacyForm, StageSelect } from "@/components/crm/detail-panels";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { canWrite, getContext } from "@/lib/auth";
import { ACTIVITY_LABEL, PRIORITY_LABEL, segmentLabel, serviceLabel } from "@/lib/constants";
import { SCORE_DISCLAIMER, type BreakdownItem } from "@/lib/scoring";
import { getStages } from "@/lib/leads/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/whatsapp/link";
import type { Evidence } from "@/lib/types";

export const metadata = { title: "Lead" };

const CONF = { high: ["Alta", "success"], medium: ["Média", "warning"], low: ["Baixa", "default"] } as const;

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = ctx.supabase;
  const { data: lead } = await db.from("leads").select("*, source:lead_sources(key, name)").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!lead) notFound();

  const [stages, evRes, notesRes, actsRes, prefRes, membersRes, supRes, tasksRes] = await Promise.all([
    getStages(db, ctx.orgId),
    db.from("lead_evidence").select("*").eq("lead_id", id).order("checked_at", { ascending: false }),
    db.from("lead_notes").select("id, body, created_at, user_id").eq("lead_id", id).order("created_at", { ascending: false }).limit(30),
    db.from("lead_activities").select("id, type, summary, created_at, user_id").eq("lead_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("contact_preferences").select("allow_whatsapp, allow_email, allow_phone").eq("lead_id", id).maybeSingle(),
    db.from("organization_members").select("user_id, profile:profiles(full_name, email)").eq("organization_id", ctx.orgId),
    db.from("suppression_list").select("kind, value").eq("organization_id", ctx.orgId),
    db.from("tasks").select("id, title, due_at, done_at").eq("lead_id", id).order("due_at", { ascending: true, nullsFirst: false }).limit(10),
  ]);
  const members = ((membersRes.data ?? []) as unknown as { user_id: string; profile: { full_name: string | null; email: string | null } | null }[]).map((m) => ({ id: m.user_id, name: m.profile?.full_name || m.profile?.email || "Usuário" }));
  const nameOf = (uid: string | null) => members.find((m) => m.id === uid)?.name ?? "Sistema";
  const evidence = (evRes.data ?? []) as Evidence[];
  const breakdown = (lead.score_breakdown ?? []) as BreakdownItem[];
  const prefs = prefRes.data ?? { allow_whatsapp: true, allow_email: true, allow_phone: true };
  const digits = (lead.whatsapp || lead.phone || "").replace(/\D/g, "");
  const suppressed = (supRes.data ?? []).some((s) => (s.kind === "phone" && s.value === digits) || (s.kind === "email" && lead.email && s.value === String(lead.email).toLowerCase()));
  const blocked = lead.do_not_contact ? "Lead marcado como não contatar" : suppressed ? "Contato na lista de supressão" : !prefs.allow_whatsapp ? "Contato desativou o WhatsApp" : null;
  const write = canWrite(ctx.role);
  const template = (ctx.orgSettings.whatsapp_template as string) || DEFAULT_WHATSAPP_TEMPLATE;
  const topService = evidence.find((e) => e.service)?.service ?? null;
  const stage = stages.find((s) => s.id === lead.stage_id);
  const sourceName = (lead.source as { name?: string } | null)?.name ?? "—";

  const info: [string, React.ReactNode][] = [
    ["Contato", lead.contact_name || "—"],
    ["Telefone", lead.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span> : "—"],
    ["WhatsApp", lead.whatsapp || "—"],
    ["E-mail", lead.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span> : "—"],
    ["Site", lead.website ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={lead.website} target="_blank" rel="noopener noreferrer"><Globe className="h-3 w-3" />{lead.website.replace(/^https?:\/\//, "")}</a> : "Não identificado"],
    ["Instagram", lead.instagram ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"><Instagram className="h-3 w-3" />{lead.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@")}</a> : "Não identificado"],
    ["Segmento", segmentLabel(lead.segment)],
    ["Localização", <span key="l" className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[lead.neighborhood, lead.city, lead.state].filter(Boolean).join(", ") || "—"}</span>],
    ["Endereço", lead.address || "—"],
    ["Avaliação pública", lead.rating ? <span key="r" className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{Number(lead.rating).toFixed(1)} ({lead.reviews_count ?? 0})</span> : "—"],
    ["Fonte do dado", lead.source_url ? <a className="text-primary hover:underline" href={lead.source_url} target="_blank" rel="noopener noreferrer">{sourceName} <ExternalLink className="inline h-3 w-3" /></a> : sourceName],
    ["Descoberto em", formatDate(lead.discovered_at, true)],
    ["Dados atualizados em", formatDate(lead.data_updated_at)],
    ["Responsável", nameOf(lead.owner_id)],
    ["Valor estimado", lead.estimated_value ? formatCurrency(Number(lead.estimated_value)) : "—"],
  ];

  return (
    <>
      <Link href="/crm" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Voltar ao CRM</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{lead.company_name}</h1>
            <ScoreBadge score={lead.score} priority={lead.score_priority} />
            {lead.do_not_contact && <Badge variant="danger">Não contatar</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{PRIORITY_LABEL[lead.score_priority as keyof typeof PRIORITY_LABEL]} · {stage?.name ?? "Sem etapa"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageSelect leadId={id} stageId={lead.stage_id} stages={stages} disabled={!write} />
          <WhatsAppButton variant="button" leadId={id} company={lead.company_name} contact={lead.contact_name} phone={lead.whatsapp || lead.phone} template={template} suggestedService={topService} blockedReason={blocked} />
          {write && (
            <>
              <EditLeadButton leadId={id} members={members} initial={{ company_name: lead.company_name, contact_name: lead.contact_name, phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email, website: lead.website, instagram: lead.instagram, segment: lead.segment, category: lead.category, state: lead.state, city: lead.city, neighborhood: lead.neighborhood, address: lead.address, owner_id: lead.owner_id, estimated_value: lead.estimated_value }} />
              <DeleteLeadButton leadId={id} />
            </>
          )}
        </div>
      </div>
      {blocked && <Alert variant="danger" className="mb-4" title="Contato bloqueado">{blocked}. Os botões de contato estão desativados para respeitar a preferência registrada.</Alert>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
            <CardContent><dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{info.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm">{v}</dd></div>)}</dl></CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Pontuação explicável</CardTitle><CardDescription>{SCORE_DISCLAIMER}</CardDescription></div><ScoreBadge score={lead.score} priority={lead.score_priority} /></CardHeader>
            <CardContent>
              {breakdown.length === 0 ? <p className="text-sm text-muted-foreground">Pontuação ainda não calculada. Execute a análise de oportunidades.</p> : (
                <ul className="space-y-3">
                  {breakdown.map((b) => (
                    <li key={b.key}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="font-medium">{b.label}</span><span className="tabular-nums text-muted-foreground">{b.points}/{b.weight}</span></div>
                      <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${b.weight ? (b.points / b.weight) * 100 : 0}%` }} /></div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{b.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div><CardTitle>Oportunidades identificadas</CardTitle><CardDescription>Sinais baseados em dados públicos. “Não identificado” não significa “não existe”.</CardDescription></div>{write && <AnalyzeButtons leadId={id} hasWebsite={!!lead.website} />}</CardHeader>
            <CardContent>
              {evidence.length === 0 ? <EmptyState title="Nenhum sinal registrado" description="Clique em “Analisar oportunidades” para gerar sinais para este lead." /> : (
                <ul className="space-y-3">
                  {evidence.map((e) => (
                    <li key={e.id} className="rounded-lg border border-border bg-card-2/50 p-3">
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{e.title}</p><Badge variant={CONF[e.confidence][1]}>Confiança {CONF[e.confidence][0].toLowerCase()}</Badge><Badge variant={e.verified ? "success" : "default"}>{e.verified ? "Verificado" : "Não verificado"}</Badge></div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{e.evidence}</p>
                      <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                        <div><dt className="inline font-medium text-foreground/70">Fonte: </dt><dd className="inline">{e.source}</dd></div>
                        <div><dt className="inline font-medium text-foreground/70">Verificado em: </dt><dd className="inline">{formatDate(e.checked_at, true)}</dd></div>
                        <div><dt className="inline font-medium text-foreground/70">Serviço: </dt><dd className="inline">{serviceLabel(e.service)}</dd></div>
                        <div className="sm:col-span-2"><dt className="inline font-medium text-foreground/70">Próxima ação: </dt><dd className="inline">{e.recommended_action}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de atividades</CardTitle></CardHeader>
            <CardContent>
              {(actsRes.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem atividades.</p> : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {(actsRes.data ?? []).map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm">{a.summary}</p>
                      <p className="text-[11px] text-muted-foreground">{ACTIVITY_LABEL[a.type] ?? a.type} · {nameOf(a.user_id)} · {formatDate(a.created_at, true)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Registrar contato</CardTitle></CardHeader><CardContent><ContactLog leadId={id} disabled={!write || !!blocked} /><p className="mt-3 text-[11px] text-muted-foreground">Estes botões registram ações feitas por você. O sistema não envia mensagens automaticamente.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Próxima ação e retorno</CardTitle></CardHeader><CardContent><FollowUpForm leadId={id} nextAction={lead.next_action} followUpAt={lead.follow_up_at} disabled={!write} />
            {(tasksRes.data ?? []).length > 0 && <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs">{(tasksRes.data ?? []).map((t) => <li key={t.id} className={t.done_at ? "text-muted-foreground line-through" : ""}>{t.title} · {formatDate(t.due_at)}</li>)}</ul>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Observações</CardTitle></CardHeader><CardContent className="space-y-4"><NoteForm leadId={id} disabled={!write} />
            {(notesRes.data ?? []).map((n) => <div key={n.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{nameOf(n.user_id)} · {formatDate(n.created_at, true)}</p></div>)}
          </CardContent></Card>
          <Card><CardHeader><div><CardTitle>Privacidade e consentimento</CardTitle><CardDescription>Base legal, canais autorizados e oposição a contato.</CardDescription></div></CardHeader><CardContent><PrivacyForm leadId={id} basis={lead.lawful_basis} prefs={prefs} disabled={!write} /></CardContent></Card>
        </div>
      </div>
    </>
  );
}
