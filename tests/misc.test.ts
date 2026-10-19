import { describe, expect, it } from "vitest";
import { isPrivateIp, parsePublicUrl } from "@/lib/security/ssrf";
import { analyzeOpportunities } from "@/lib/opportunities/analyze";
import { buildSubmissionSchema, DEFAULT_FORM_FIELDS, pickUtm } from "@/lib/forms/schema";
import { mapPlace } from "@/lib/providers/google-places";

describe("ssrf", () => {
  it("bloqueia IPs e hosts internos", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(parsePublicUrl("http://localhost:3000")).toBeNull();
    expect(parsePublicUrl("http://169.254.169.254/latest")).toBeNull();
    expect(parsePublicUrl("ftp://exemplo.com")).toBeNull();
    expect(parsePublicUrl("exemplo.com.br")?.protocol).toBe("https:");
  });
});

describe("analisador de oportunidades", () => {
  const lead = { segment: "restaurante", website: null, instagram: null, whatsapp: null, phone: null, source_name: "Google Places" };
  it("ausência de site vira 'não identificado' com confiança baixa e não verificado", () => {
    const ops = analyzeOpportunities(lead);
    const s = ops.find((o) => o.signal_key === "no_website")!;
    expect(s.confidence).toBe("low");
    expect(s.verified).toBe(false);
    expect(s.evidence).toMatch(/não comprova/);
    expect(ops.some((o) => o.signal_key === "no_digital_menu")).toBe(true);
  });
  it("site indisponível verificado gera evidência com alta rastreabilidade", () => {
    const ops = analyzeOpportunities({ ...lead, website: "https://x.com" }, { url: "https://x.com", checkedAt: "2026-10-19T10:00:00Z", ok: false, status: null, https: true, responseMs: null, error: "Tempo esgotado" });
    const s = ops.find((o) => o.signal_key === "site_unreachable")!;
    expect(s.verified).toBe(true);
    expect(s.checked_at).toBe("2026-10-19T10:00:00Z");
    expect(ops.some((o) => o.signal_key === "no_website")).toBe(false);
  });
  it("site sem HTTPS é detectado", () => {
    const ops = analyzeOpportunities({ ...lead, website: "http://x.com" }, { url: "http://x.com", checkedAt: "2026-10-19T10:00:00Z", ok: true, status: 200, https: false, responseMs: 300 });
    expect(ops.map((o) => o.signal_key)).toContain("site_no_https");
  });
});

describe("formulários", () => {
  const schema = buildSubmissionSchema(DEFAULT_FORM_FIELDS);
  it("valida obrigatórios, formato e rejeita campos desconhecidos", () => {
    expect(schema.safeParse({ nome: "Ana", email: "ana@x.com" }).success).toBe(true);
    expect(schema.safeParse({ nome: "" }).success).toBe(false);
    expect(schema.safeParse({ nome: "Ana", email: "ruim" }).success).toBe(false);
    expect(schema.safeParse({ nome: "Ana", hack: "1" }).success).toBe(false);
  });
  it("aceita opcional vazio", () => {
    expect(schema.safeParse({ nome: "Ana", email: "" }).success).toBe(true);
  });
  it("captura somente parâmetros UTM", () => {
    expect(pickUtm({ utm_source: "g", foo: "x", utm_campaign: " c " })).toEqual({ utm_source: "g", utm_campaign: "c" });
  });
});

describe("google places mapper", () => {
  it("mapeia campos e separa Instagram do site", () => {
    const l = mapPlace({
      id: "abc", displayName: { text: "Bella" }, nationalPhoneNumber: "(19) 3333-4444", websiteUri: "https://instagram.com/bella",
      rating: 4.6, userRatingCount: 120, formattedAddress: "Rua X, 1",
      addressComponents: [
        { longText: "Campinas", types: ["administrative_area_level_2"] },
        { longText: "São Paulo", shortText: "SP", types: ["administrative_area_level_1"] },
        { longText: "Brasil", shortText: "BR", types: ["country"] },
      ],
    }, "2026-10-19T00:00:00Z");
    expect(l).toMatchObject({ sourceRef: "abc", companyName: "Bella", city: "Campinas", state: "SP", country: "BR", website: null, instagram: "https://instagram.com/bella", reviewsCount: 120 });
  });
});
