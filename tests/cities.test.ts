import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { UF_LIST } from "@/lib/constants";

describe("base de municípios", () => {
  const dir = "src/data/cidades";
  it("tem um arquivo por estado e 5.570 municípios no total", () => {
    expect(readdirSync(dir).sort()).toEqual([...UF_LIST].sort().map((u) => `${u}.json`));
    const total = UF_LIST.reduce((s, u) => s + (JSON.parse(readFileSync(`${dir}/${u}.json`, "utf8")) as string[]).length, 0);
    expect(total).toBe(5570);
  });
  it("contém capitais conhecidas", () => {
    const has = (uf: string, c: string) => (JSON.parse(readFileSync(`${dir}/${uf}.json`, "utf8")) as string[]).includes(c);
    expect(has("SP", "Campinas")).toBe(true);
    expect(has("MG", "Belo Horizonte")).toBe(true);
    expect(has("PA", "Belém")).toBe(true);
  });
});
