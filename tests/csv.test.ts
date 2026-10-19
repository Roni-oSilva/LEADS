import { describe, expect, it } from "vitest";
import { autoMapColumns, csvCell, EXPORT_FIELDS, toCsv, validateRows } from "@/lib/csv/leads-csv";

describe("importação CSV", () => {
  it("mapeia colunas automaticamente por nome/alias", () => {
    const m = autoMapColumns(["Empresa", "Telefone", "E-mail", "UF", "Cidade", "Coluna Estranha"]);
    expect(m).toMatchObject({ Empresa: "company_name", Telefone: "phone", "E-mail": "email", UF: "state", Cidade: "city" });
    expect(m["Coluna Estranha"]).toBeUndefined();
  });
  it("valida linhas e reporta erros com número da linha", () => {
    const mapping = { Empresa: "company_name", Email: "email", UF: "state", Nota: "rating", Site: "website" };
    const res = validateRows(
      [
        { Empresa: "Bella", Email: "A@B.com", UF: "sp", Nota: "4,5", Site: "bella.com" },
        { Empresa: "", Email: "x", UF: "ZZ", Nota: "9", Site: "" },
      ],
      mapping,
    );
    expect(res[0].ok).toBe(true);
    expect(res[0].data).toMatchObject({ email: "a@b.com", state: "SP", rating: 4.5, website: "https://bella.com" });
    expect(res[1].ok).toBe(false);
    expect(res[1].line).toBe(3);
    expect(res[1].errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("exportação CSV", () => {
  it("escapa aspas, vírgulas e neutraliza injeção de fórmula", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
  it("gera cabeçalho com BOM e CRLF", () => {
    const out = toCsv([{ company_name: "A", city: "B" }], EXPORT_FIELDS.filter((f) => ["company_name", "city"].includes(f.key)));
    expect(out.startsWith("﻿Empresa,Cidade\r\nA,B")).toBe(true);
  });
});

import { parsePastedLeads } from "@/lib/csv/paste";
import { formatCnpj, mapBrasilApi, normalizeCnpj } from "@/lib/cnpj";

describe("lista colada", () => {
  it("reconhece telefone, e-mail, site, instagram e cidade/UF em qualquer ordem", () => {
    const { rows, ignored } = parsePastedLeads("Auto Center Silva; Campinas/SP; (19) 99999-8888; silva@auto.com; autosilva.com.br; @autosilva\n\n(11) 99999-0000\nBorracharia do Zé;MG;31 3333-4444", { segment: "borracharia_pneus" });
    expect(ignored).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ company_name: "Auto Center Silva", city: "Campinas", state: "SP", phone: "(19) 99999-8888", email: "silva@auto.com", website: "autosilva.com.br", instagram: "https://instagram.com/autosilva", segment: "borracharia_pneus" });
    expect(rows[1]).toMatchObject({ company_name: "Borracharia do Zé", state: "MG", phone: "31 3333-4444" });
  });
  it("aplica estado/cidade padrão somente quando a linha não informa", () => {
    const { rows } = parsePastedLeads("Loja A; Santos/SP\nLoja B", { state: "RJ", city: "Niterói" });
    expect(rows[0]).toMatchObject({ city: "Santos", state: "SP" });
    expect(rows[1]).toMatchObject({ city: "Niterói", state: "RJ" });
  });
});

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCnpj("11.222.333/0001-82")).toBeNull();
    expect(normalizeCnpj("00000000000000")).toBeNull();
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("mapeia a BrasilAPI sem levar o quadro societário", () => {
    const d = mapBrasilApi({ cnpj: "11222333000181", razao_social: "ACME LTDA", nome_fantasia: "Acme", descricao_situacao_cadastral: "ATIVA", cnae_fiscal_descricao: "Comércio varejista", ddd_telefone_1: "1933334444", email: "CONTATO@ACME.COM", logradouro: "RUA A", numero: "10", bairro: "CENTRO", municipio: "CAMPINAS", uf: "sp", qsa: [{ nome_socio: "Fulano" }] })!;
    expect(d).toMatchObject({ legalName: "ACME LTDA", phone: "(19) 3333-4444", email: "contato@acme.com", street: "RUA A, 10", state: "SP" });
    expect(JSON.stringify(d)).not.toContain("Fulano");
    expect(mapBrasilApi({ cnpj: "123" })).toBeNull();
  });
});
