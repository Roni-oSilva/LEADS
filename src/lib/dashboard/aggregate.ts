export interface DashLead {
  id: string;
  created_at: string;
  segment: string | null;
  city: string | null;
  state: string | null;
  source_key: string | null;
  owner_id: string | null;
  stage_key: string | null;
  stage_position: number | null;
  estimated_value: number | null;
  score_priority: string;
}
export interface DashActivity {
  lead_id: string;
  type: string;
  created_at: string;
}
export interface DashCampaign {
  id: string;
  name: string;
  status: string;
}
export interface DashFilters {
  from?: string; // YYYY-MM-DD
  to?: string;
  segment?: string;
  state?: string;
  city?: string;
  owner?: string;
  source?: string;
}

export const CONTACT_ACTIVITY_TYPES = ["contact_done", "whatsapp_started", "call", "email", "whatsapp_response"];
const ACTIVE_EXCLUDED = ["lost", "do_not_contact", "won"];

/** Brasil não tem horário de verão desde 2019: UTC-3 fixo. */
export function brDate(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type Granularity = "day" | "week" | "month";

export function bucketKey(iso: string, g: Granularity): string {
  const day = brDate(iso);
  if (g === "day") return day;
  if (g === "week") return weekStart(day);
  return day.slice(0, 7);
}

export function filterLeads(leads: DashLead[], f: DashFilters): DashLead[] {
  return leads.filter((l) => {
    const day = brDate(l.created_at);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.segment && l.segment !== f.segment) return false;
    if (f.state && l.state !== f.state) return false;
    if (f.city && l.city !== f.city) return false;
    if (f.owner && l.owner_id !== f.owner) return false;
    if (f.source && l.source_key !== f.source) return false;
    return true;
  });
}

function countBy<T>(items: T[], key: (t: T) => string | null | undefined, empty = "Não informado") {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || empty;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export interface Kpis {
  total: number;
  newInPeriod: number;
  qualified: number;
  contacted: number;
  meetings: number;
  proposals: number;
  won: number;
  conversionRate: number;
  pipelineValue: number;
}

export function computeDashboard(
  allLeads: DashLead[],
  activities: DashActivity[],
  campaigns: DashCampaign[],
  campaignLeads: { campaign_id: string; lead_id: string }[],
  filters: DashFilters,
  granularity: Granularity = "day",
) {
  const leads = filterLeads(allLeads, { ...filters, from: undefined, to: undefined });
  const inPeriod = filterLeads(allLeads, filters);
  const ids = new Set(leads.map((l) => l.id));
  const acts = activities.filter((a) => ids.has(a.lead_id));
  const contactedByActivity = new Set(acts.filter((a) => CONTACT_ACTIVITY_TYPES.includes(a.type)).map((a) => a.lead_id));
  const pos = (l: DashLead) => l.stage_position ?? 1;
  const live = (l: DashLead) => !["lost", "do_not_contact"].includes(l.stage_key ?? "");

  const total = leads.length;
  const won = leads.filter((l) => l.stage_key === "won").length;
  const kpis: Kpis = {
    total,
    newInPeriod: inPeriod.length,
    qualified: leads.filter((l) => live(l) && pos(l) >= 3).length,
    contacted: leads.filter((l) => contactedByActivity.has(l.id) || (live(l) && pos(l) >= 4)).length,
    meetings: leads.filter((l) => l.stage_key === "meeting").length,
    proposals: leads.filter((l) => l.stage_key === "proposal").length,
    won,
    conversionRate: total ? (won / total) * 100 : 0,
    pipelineValue: leads.filter((l) => !ACTIVE_EXCLUDED.includes(l.stage_key ?? "")).reduce((s, l) => s + (l.estimated_value ?? 0), 0),
  };

  const seriesMap = new Map<string, number>();
  for (const l of inPeriod) seriesMap.set(bucketKey(l.created_at, granularity), (seriesMap.get(bucketKey(l.created_at, granularity)) ?? 0) + 1);
  const captured = [...seriesMap.entries()].map(([date, leads]) => ({ date, leads })).sort((a, b) => a.date.localeCompare(b.date));

  const contactMap = new Map<string, number>();
  for (const a of acts) {
    if (!CONTACT_ACTIVITY_TYPES.includes(a.type)) continue;
    const day = brDate(a.created_at);
    if (filters.from && day < filters.from) continue;
    if (filters.to && day > filters.to) continue;
    const k = bucketKey(a.created_at, granularity);
    contactMap.set(k, (contactMap.get(k) ?? 0) + 1);
  }
  const contactsEvolution = [...contactMap.entries()].map(([date, contacts]) => ({ date, contacts })).sort((a, b) => a.date.localeCompare(b.date));

  // Funil cumulativo: leads que chegaram ao menos até a etapa (aproximação pela etapa atual; perdidos/não contatar ficam fora).
  const funnelDefs = [
    { key: "new", name: "Novo lead", position: 1 },
    { key: "analyzed", name: "Analisado", position: 2 },
    { key: "qualified", name: "Qualificado", position: 3 },
    { key: "first_contact", name: "Primeiro contato", position: 4 },
    { key: "negotiating", name: "Em negociação", position: 5 },
    { key: "meeting", name: "Reunião agendada", position: 6 },
    { key: "proposal", name: "Proposta enviada", position: 7 },
    { key: "won", name: "Cliente conquistado", position: 8 },
  ];
  const liveLeads = leads.filter(live);
  let prev = 0;
  const funnel = funnelDefs.map((s, i) => {
    const count = liveLeads.filter((l) => pos(l) >= s.position).length;
    const rate = i === 0 ? 100 : prev ? (count / prev) * 100 : 0;
    prev = count;
    return { name: s.name, count, rate };
  });

  const campaignPerformance = campaigns.map((c) => {
    const lids = new Set(campaignLeads.filter((cl) => cl.campaign_id === c.id).map((cl) => cl.lead_id));
    const cl = allLeads.filter((l) => lids.has(l.id));
    const responded = new Set(activities.filter((a) => a.type === "whatsapp_response" && lids.has(a.lead_id)).map((a) => a.lead_id));
    const contacted = cl.filter((l) => contactedByActivity.has(l.id) || activities.some((a) => a.lead_id === l.id && CONTACT_ACTIVITY_TYPES.includes(a.type))).length;
    const meetings = cl.filter((l) => ["meeting", "proposal", "won"].includes(l.stage_key ?? "")).length;
    const conversions = cl.filter((l) => l.stage_key === "won").length;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      leads: cl.length,
      contacted,
      responses: responded.size,
      responseRate: contacted ? (responded.size / contacted) * 100 : 0,
      meetings,
      conversions,
      value: cl.filter((l) => l.stage_key === "won").reduce((s, l) => s + (l.estimated_value ?? 0), 0),
    };
  });

  return {
    kpis,
    captured,
    contactsEvolution,
    bySegment: countBy(inPeriod, (l) => l.segment),
    byCity: countBy(inPeriod, (l) => (l.city ? `${l.city}${l.state ? `/${l.state}` : ""}` : null)).slice(0, 10),
    byState: countBy(inPeriod, (l) => l.state).slice(0, 10),
    bySource: countBy(inPeriod, (l) => l.source_key),
    funnel,
    campaignPerformance,
  };
}

export function defaultRange(days = 30, now = new Date()) {
  const to = brDate(now.toISOString());
  const from = brDate(new Date(now.getTime() - (days - 1) * 86_400_000).toISOString());
  return { from, to };
}
