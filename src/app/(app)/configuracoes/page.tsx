import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DsarActions, EraseForm, InviteDelete, InviteForm, MemberRow, OrgForm, ProfileForm, ScoringForm, SuppressionForm, SuppressionRemove, WhatsAppTemplateForm } from "@/components/settings/settings-forms";
import { getContext, isAdmin, canWrite } from "@/lib/auth";
import { scoringConfigFrom } from "@/lib/leads/service";
import { appUrl, isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { formatDate } from "@/lib/utils";
import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/whatsapp/link";

export const metadata = { title: "Configurações" };
const ROLE: Record<string, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro", viewer: "Somente leitura" };
const DSAR: Record<string, string> = { access: "Acesso", correction: "Correção", deletion: "Eliminação", opposition: "Oposição", portability: "Portabilidade", other: "Outro" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return <Card id={id} className="scroll-mt-6"><CardHeader><div><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div></CardHeader><CardContent>{children}</CardContent></Card>;
}

export default async function SettingsPage() {
  const ctx = await getContext();
  const admin = isAdmin(ctx.role);
  const db = ctx.supabase;
  const [{ data: profile }, { data: members }, { data: invites }, { data: suppression }, { data: dsar }, { data: audit }, { data: org }] = await Promise.all([
    db.from("profiles").select("full_name, phone, preferences").eq("id", ctx.userId).single(),
    db.from("organization_members").select("user_id, role, created_at, profile:profiles(full_name, email)").eq("organization_id", ctx.orgId).order("created_at"),
    admin ? db.from("organization_invites").select("id, email, role, accepted_at, created_at").eq("organization_id", ctx.orgId).is("accepted_at", null) : Promise.resolve({ data: [] }),
    db.from("suppression_list").select("id, kind, value, reason, created_at").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(50),
    admin ? db.from("dsar_requests").select("*").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
    admin ? db.from("audit_logs").select("id, action, entity, entity_id, created_at, user_id").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(25) : Promise.resolve({ data: [] }),
    db.from("organizations").select("slug, plan").eq("id", ctx.orgId).single(),
  ]);
  const cfg = scoringConfigFrom(ctx.orgSettings);
  const prefs = (profile?.preferences ?? {}) as Record<string, boolean>;
  type M = { user_id: string; role: string; profile: { full_name: string | null; email: string | null } | null };
  const list = (members ?? []) as unknown as M[];
  const nameOf = (id: string | null) => list.find((m) => m.user_id === id)?.profile?.full_name ?? list.find((m) => m.user_id === id)?.profile?.email ?? "Sistema";
  const nav = [["perfil", "Perfil"], ["organizacao", "Organização"], ["pontuacao", "Pontuação"], ["whatsapp", "WhatsApp"], ["equipe", "Equipe"], ["privacidade", "Privacidade"], ["plano", "Plano"], ["sistema", "Sistema"]];

  return (
    <>
      <PageHeader title="Configurações" description="Conta, organização, critérios de pontuação, equipe e privacidade." />
      {!admin && <Alert variant="info" className="mb-4">Algumas seções são somente leitura para o seu perfil ({ROLE[ctx.role]}).</Alert>}
      <nav aria-label="Seções" className="mb-6 flex flex-wrap gap-2">{nav.map(([id, l]) => <a key={id} href={`#${id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{l}</a>)}</nav>
      <div className="space-y-6">
        <Section id="perfil" title="Perfil do usuário"><ProfileForm initial={{ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", email: ctx.email, notify_followups: prefs.notify_followups ?? true, notify_form_submissions: prefs.notify_form_submissions ?? true, notify_weekly_summary: prefs.notify_weekly_summary ?? false }} /></Section>
        <Section id="organizacao" title="Dados da organização"><OrgForm name={ctx.orgName} disabled={!admin} /><p className="mt-3 text-xs text-muted-foreground">Identificador (slug): <code>{org?.slug}</code></p></Section>
        <Section id="pontuacao" title="Critérios de pontuação" description="Pesos, segmentos e regiões-alvo usados no cálculo de 0 a 100 (alta ≥ 80, média 50–79, baixa < 50)."><ScoringForm weights={cfg.weights} targetSegments={cfg.targetSegments} targetStates={cfg.targetStates} targetCities={cfg.targetCities} disabled={!admin} /></Section>
        <Section id="whatsapp" title="Mensagem comercial (WhatsApp)" description="Modelo padrão usado ao iniciar conversas. Sempre editável antes do contato."><WhatsAppTemplateForm template={(ctx.orgSettings.whatsapp_template as string) || DEFAULT_WHATSAPP_TEMPLATE} disabled={!admin} /></Section>
        <Section id="equipe" title="Equipe e permissões" description="Proprietário e administradores gerenciam tudo; membros editam leads; leitura apenas visualiza.">
          <Table><THead><TR><TH>Nome</TH><TH>E-mail</TH><TH>Perfil</TH><TH>Ação</TH></TR></THead>
            <TBody>{list.map((m) => <TR key={m.user_id}><TD className="font-medium">{m.profile?.full_name ?? "—"}</TD><TD className="text-xs">{m.profile?.email}</TD><TD><Badge variant={m.role === "owner" ? "primary" : "default"}>{ROLE[m.role]}</Badge></TD><TD><MemberRow userId={m.user_id} role={m.role} isSelf={m.user_id === ctx.userId} disabled={!admin} /></TD></TR>)}</TBody></Table>
          {admin && (
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <InviteForm />
              <p className="text-xs text-muted-foreground">O convidado deve criar a conta em <code>{appUrl()}/signup</code> usando exatamente este e-mail e confirmar o endereço; ele entrará automaticamente nesta organização. Mantenha a confirmação de e-mail ativada no Supabase Auth.</p>
              {(invites ?? []).length > 0 && <ul className="space-y-1 text-sm">{(invites ?? []).map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><span>{i.email} · <Badge>{ROLE[i.role]}</Badge> <span className="text-xs text-muted-foreground">pendente</span></span><InviteDelete id={i.id} /></li>)}</ul>}
            </div>
          )}
        </Section>
        <Section id="privacidade" title="Privacidade e direitos dos titulares (LGPD)" description="Lista de supressão, pedidos de titulares, eliminação e exportação de dados.">
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium">Lista de supressão (não contatar)</h3>
              {canWrite(ctx.role) && <SuppressionForm disabled={false} />}
              <div className="mt-3">{(suppression ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> : <Table><THead><TR><TH>Tipo</TH><TH>Valor</TH><TH>Motivo</TH><TH>Data</TH><TH /></TR></THead><TBody>{(suppression ?? []).map((s) => <TR key={s.id}><TD><Badge>{s.kind}</Badge></TD><TD className="text-xs">{s.value}</TD><TD className="text-xs text-muted-foreground">{s.reason}</TD><TD className="text-xs">{formatDate(s.created_at)}</TD><TD><SuppressionRemove id={s.id} disabled={!admin} /></TD></TR>)}</TBody></Table>}</div>
            </div>
            {admin && (
              <>
                <div className="border-t border-border pt-5"><h3 className="mb-1 text-sm font-medium">Atender solicitação de titular</h3><p className="mb-3 text-xs text-muted-foreground">Exclua ou exporte os dados vinculados a um e-mail/telefone. A exclusão é definitiva e inclui o contato na lista de supressão.</p><EraseForm /></div>
                <div className="border-t border-border pt-5">
                  <h3 className="mb-1 text-sm font-medium">Solicitações recebidas</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Link público para titulares: <code>{appUrl()}/privacidade/solicitacao?org={org?.slug}</code></p>
                  {(dsar ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p> : <ul className="space-y-3">{(dsar ?? []).map((d) => <li key={d.id} className="rounded-lg border border-border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge variant="primary">{DSAR[d.kind]}</Badge><Badge variant={d.status === "done" ? "success" : d.status === "rejected" ? "danger" : "warning"}>{d.status}</Badge><span className="font-medium">{d.requester_name}</span><span className="text-xs text-muted-foreground">{d.requester_email} · {formatDate(d.created_at, true)}</span></div>{d.details && <p className="mt-1 text-xs text-muted-foreground">{d.details}</p>}{d.resolution && <p className="mt-1 text-xs">Resolução: {d.resolution}</p>}<div className="mt-2"><DsarActions id={d.id} status={d.status} /></div></li>)}</ul>}
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground"><Link href="/privacidade" className="text-primary hover:underline">Ver política de privacidade</Link></p>
          </div>
        </Section>
        <Section id="plano" title="Plano e assinatura"><div className="flex flex-wrap items-center gap-3"><Badge variant="primary" className="text-sm uppercase">{org?.plan}</Badge><p className="text-sm text-muted-foreground">A estrutura de planos (coluna <code>organizations.plan</code>) já existe. A cobrança (ex.: Stripe) ainda não está integrada.</p></div></Section>
        <Section id="sistema" title="Sistema, segurança e auditoria">
          <ul className="mb-4 space-y-1.5 text-sm"><li>Supabase: <Badge variant={isSupabaseConfigured() ? "success" : "danger"}>{isSupabaseConfigured() ? "configurado" : "ausente"}</Badge></li><li>Chave de serviço (servidor): <Badge variant={isServiceRoleConfigured() ? "success" : "warning"}>{isServiceRoleConfigured() ? "configurada" : "ausente"}</Badge></li></ul>
          <p className="mb-4 text-xs text-muted-foreground">Teste conexões e veja logs em <Link href="/integracoes" className="text-primary hover:underline">Integrações</Link>. Estratégia de backup: veja <code>docs/DATABASE.md</code>.</p>
          {admin && (
            <><h3 className="mb-2 text-sm font-medium">Registro de operações administrativas</h3>
              {(audit ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Sem registros.</p> : <Table><THead><TR><TH>Data</TH><TH>Usuário</TH><TH>Ação</TH><TH>Entidade</TH></TR></THead><TBody>{(audit ?? []).map((a) => <TR key={a.id}><TD className="whitespace-nowrap text-xs">{formatDate(a.created_at, true)}</TD><TD className="text-xs">{nameOf(a.user_id)}</TD><TD className="text-xs"><code>{a.action}</code></TD><TD className="max-w-48 truncate text-xs text-muted-foreground">{a.entity} {a.entity_id}</TD></TR>)}</TBody></Table>}</>
          )}
        </Section>
      </div>
    </>
  );
}
