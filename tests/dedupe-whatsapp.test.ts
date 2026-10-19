import { describe, expect, it } from "vitest";
import { computeDedupeKeys, normalizePhone, websiteDomain } from "@/lib/dedupe";
import { buildWhatsAppLink, DEFAULT_WHATSAPP_TEMPLATE, looksLikeMobile, normalizeWhatsAppNumber, renderTemplate } from "@/lib/whatsapp/link";

describe("dedupe", () => {
  it("normaliza telefone ignorando DDI e máscara", () => {
    expect(normalizePhone("+55 (19) 99999-8888")).toBe("19999998888");
    expect(normalizePhone("19 99999-8888")).toBe("19999998888");
    expect(normalizePhone("123")).toBeNull();
  });
  it("extrai domínio sem www", () => {
    expect(websiteDomain("https://www.Exemplo.com.br/contato")).toBe("exemplo.com.br");
    expect(websiteDomain("exemplo.com")).toBe("exemplo.com");
  });
  it("gera chaves que se sobrepõem para o mesmo negócio", () => {
    const a = computeDedupeKeys({ company_name: "Pizzaria Bella", city: "Campinas", phone: "(19) 3333-4444" });
    const b = computeDedupeKeys({ company_name: "PIZZARIA  BELLA", city: "campinas", website: "bella.com" });
    expect(a.some((k) => b.includes(k))).toBe(true);
  });
  it("redes sociais não geram chave de domínio", () => {
    expect(computeDedupeKeys({ company_name: "X", website: "https://instagram.com/x" }).some((k) => k.startsWith("web:"))).toBe(false);
  });
});

describe("whatsapp", () => {
  it("normaliza números brasileiros", () => {
    expect(normalizeWhatsAppNumber("(19) 99999-8888")).toBe("5519999998888");
    expect(normalizeWhatsAppNumber("+55 19 3333-4444")).toBe("551933334444");
    expect(normalizeWhatsAppNumber("abc")).toBeNull();
    expect(normalizeWhatsAppNumber("123")).toBeNull();
  });
  it("monta link oficial wa.me com a mensagem codificada", () => {
    const link = buildWhatsAppLink("19999998888", "Olá & tudo bem?")!;
    expect(link.startsWith("https://wa.me/5519999998888?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("Olá & tudo bem?");
    expect(buildWhatsAppLink("x", "m")).toBeNull();
  });
  it("renderiza o modelo com empresa, serviço e portfólio", () => {
    const m = renderTemplate(DEFAULT_WHATSAPP_TEMPLATE, { empresa: "Pizzaria Bella", servico: "cardapio_digital" });
    expect(m).toContain("Pizzaria Bella");
    expect(m).toContain("cardápio digital");
    expect(m).toContain("https://cvx-redirecionador.vercel.app");
    expect(m).not.toContain("{{");
  });
  it("detecta celular", () => {
    expect(looksLikeMobile("19999998888")).toBe(true);
    expect(looksLikeMobile("1933334444")).toBe(false);
  });
});
