import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeWeights, priorityFor, scoreLead, type ScoringLead } from "@/lib/scoring";

const NOW = new Date("2026-10-19T12:00:00Z");
const base: ScoringLead = {
  segment: "restaurante", state: "SP", city: "Campinas", phone: "(19) 3333-4444", whatsapp: null, email: null,
  do_not_contact: false, data_updated_at: "2026-10-10T00:00:00Z", showed_interest: false, evidence: [],
};

describe("lead scoring", () => {
  it("classifica por faixas 80/50", () => {
    expect(priorityFor(80)).toBe("high");
    expect(priorityFor(79)).toBe("medium");
    expect(priorityFor(50)).toBe("medium");
    expect(priorityFor(49)).toBe("low");
  });

  it("é explicável: soma dos pontos do breakdown = score", () => {
    const r = scoreLead({ ...base, whatsapp: "19999998888", evidence: [{ confidence: "high", verified: true }] }, DEFAULT_CONFIG, NOW);
    expect(r.breakdown).toHaveLength(7);
    expect(r.breakdown.reduce((s, b) => s + b.points, 0)).toBe(r.score);
    expect(r.breakdown.every((b) => b.reason.length > 0)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("lead com todos os critérios fortes chega a alta prioridade", () => {
    const cfg = { ...DEFAULT_CONFIG, targetSegments: ["restaurante"], targetCities: ["Campinas"] };
    const r = scoreLead(
      { ...base, whatsapp: "19999998888", showed_interest: true, evidence: [{ confidence: "high", verified: true }, { confidence: "medium", verified: true }] },
      cfg, NOW,
    );
    expect(r.score).toBe(100);
    expect(r.priority).toBe("high");
  });

  it("não contatar zera a pontuação", () => {
    const r = scoreLead({ ...base, do_not_contact: true, whatsapp: "19999998888", showed_interest: true }, DEFAULT_CONFIG, NOW);
    expect(r.score).toBe(0);
    expect(r.priority).toBe("low");
  });

  it("dados antigos perdem pontos de recência", () => {
    const fresh = scoreLead(base, DEFAULT_CONFIG, NOW);
    const stale = scoreLead({ ...base, data_updated_at: "2025-01-01T00:00:00Z" }, DEFAULT_CONFIG, NOW);
    expect(stale.score).toBeLessThan(fresh.score);
  });

  it("normaliza pesos para somar exatamente 100", () => {
    const w = normalizeWeights({ service_fit: 7, need: 3, evidence: 1, geo: 1, channel: 1, interest: 1, recency: 1 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100);
    const zero = normalizeWeights({ service_fit: 0, need: 0, evidence: 0, geo: 0, channel: 0, interest: 0, recency: 0 });
    expect(Object.values(zero).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
