import "server-only";
import type { Ctx } from "../auth";
import type { DashActivity, DashCampaign, DashLead } from "./aggregate";
import { CONTACT_ACTIVITY_TYPES } from "./aggregate";

const LIMIT = 10000;

/** Carrega os registros brutos da organização (RLS aplicado). Agregações são feitas em lib/dashboard/aggregate. */
export async function loadDashboardData(ctx: Ctx) {
  const db = ctx.supabase;
  const [leadsRes, actsRes, campRes, clRes, membersRes] = await Promise.all([
    db
      .from("leads")
      .select("id, created_at, segment, city, state, owner_id, estimated_value, score_priority, source:lead_sources(key), stage:pipeline_stages(key, position)")
      .eq("organization_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    db
      .from("lead_activities")
      .select("lead_id, type, created_at")
      .eq("organization_id", ctx.orgId)
      .in("type", CONTACT_ACTIVITY_TYPES)
      .order("created_at", { ascending: false })
      .limit(LIMIT * 2),
    db.from("campaigns").select("id, name, status").eq("organization_id", ctx.orgId),
    db.from("campaign_leads").select("campaign_id, lead_id").eq("organization_id", ctx.orgId),
    db.from("organization_members").select("user_id, role, profile:profiles(full_name, email)").eq("organization_id", ctx.orgId),
  ]);
  const error = leadsRes.error ?? actsRes.error ?? campRes.error ?? clRes.error;
  if (error) throw error;

  type Row = { id: string; created_at: string; segment: string | null; city: string | null; state: string | null; owner_id: string | null; estimated_value: number | null; score_priority: string; source: { key: string } | null; stage: { key: string; position: number } | null };
  const leads: DashLead[] = ((leadsRes.data ?? []) as unknown as Row[]).map((l) => ({
    id: l.id, created_at: l.created_at, segment: l.segment, city: l.city, state: l.state, owner_id: l.owner_id,
    estimated_value: l.estimated_value === null ? null : Number(l.estimated_value), score_priority: l.score_priority,
    source_key: l.source?.key ?? null, stage_key: l.stage?.key ?? null, stage_position: l.stage?.position ?? null,
  }));
  const members = ((membersRes.data ?? []) as unknown as { user_id: string; profile: { full_name: string | null; email: string | null } | null }[]).map((m) => ({
    id: m.user_id, name: m.profile?.full_name || m.profile?.email || "Usuário",
  }));
  return {
    leads,
    activities: (actsRes.data ?? []) as DashActivity[],
    campaigns: (campRes.data ?? []) as DashCampaign[],
    campaignLeads: (clRes.data ?? []) as { campaign_id: string; lead_id: string }[],
    members,
    truncated: (leadsRes.data?.length ?? 0) >= LIMIT,
  };
}
