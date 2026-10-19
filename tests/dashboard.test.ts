import { describe, expect, it } from "vitest";
import { brDate, bucketKey, computeDashboard, weekStart, type DashLead } from "@/lib/dashboard/aggregate";

const mk = (id: string, over: Partial<DashLead> = {}): DashLead => ({
  id, created_at: "2026-10-10T15:00:00Z", segment: "restaurante", city: "Campinas", state: "SP", source_key: "google_places",
  owner_id: null, stage_key: "new", stage_position: 1, estimated_value: null, score_priority: "low", ...over,
});

describe("dashboard", () => {
  it("converte para data de Brasília (UTC-3)", () => {
    expect(brDate("2026-10-10T01:00:00Z")).toBe("2026-10-09");
    expect(weekStart("2026-10-14")).toBe("2026-10-12");
    expect(bucketKey("2026-10-14T12:00:00Z", "month")).toBe("2026-10");
  });

  it("calcula KPIs a partir dos registros reais, sem inventar números", () => {
    const leads = [
      mk("1"),
      mk("2", { stage_key: "qualified", stage_position: 3, estimated_value: 1000 }),
      mk("3", { stage_key: "meeting", stage_position: 6, estimated_value: 2000 }),
      mk("4", { stage_key: "won", stage_position: 8, estimated_value: 3000 }),
      mk("5", { stage_key: "lost", stage_position: 9, estimated_value: 500 }),
    ];
    const acts = [{ lead_id: "1", type: "whatsapp_started", created_at: "2026-10-11T12:00:00Z" }];
    const d = computeDashboard(leads, acts, [], [], { from: "2026-10-01", to: "2026-10-31" });
    expect(d.kpis.total).toBe(5);
    expect(d.kpis.qualified).toBe(3);
    expect(d.kpis.meetings).toBe(1);
    expect(d.kpis.won).toBe(1);
    expect(d.kpis.conversionRate).toBe(20);
    expect(d.kpis.pipelineValue).toBe(3000); // exclui ganho e perdido
    expect(d.kpis.contacted).toBe(3); // lead 1 (atividade) + etapas 6 e 8
    expect(d.contactsEvolution).toEqual([{ date: "2026-10-11", contacts: 1 }]);
    expect(d.funnel[0].count).toBe(4); // perdido fica fora do funil
  });

  it("aplica filtros de período e segmento", () => {
    const leads = [mk("1"), mk("2", { created_at: "2026-09-01T12:00:00Z" }), mk("3", { segment: "academia" })];
    const d = computeDashboard(leads, [], [], [], { from: "2026-10-01", to: "2026-10-31", segment: "restaurante" });
    expect(d.kpis.newInPeriod).toBe(1);
    expect(d.bySegment).toEqual([{ name: "restaurante", value: 1 }]);
  });

  it("calcula desempenho de campanha", () => {
    const leads = [mk("1", { stage_key: "won", stage_position: 8, estimated_value: 900 }), mk("2")];
    const acts = [
      { lead_id: "1", type: "whatsapp_started", created_at: "2026-10-11T12:00:00Z" },
      { lead_id: "1", type: "whatsapp_response", created_at: "2026-10-12T12:00:00Z" },
    ];
    const d = computeDashboard(leads, acts, [{ id: "c1", name: "Pizzarias", status: "active" }], [{ campaign_id: "c1", lead_id: "1" }, { campaign_id: "c1", lead_id: "2" }], {});
    expect(d.campaignPerformance[0]).toMatchObject({ leads: 2, contacted: 1, responses: 1, responseRate: 100, conversions: 1, value: 900 });
  });
});
