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
