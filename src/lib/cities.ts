/**
 * Municípios por estado (5.570 no total, base IBGE via pacote MIT `estados-cidades`, gerada em src/data/cidades/*.json).
 * Um arquivo por UF, carregado sob demanda (code-splitting) ao escolher o estado.
 */
export async function loadCities(uf: string): Promise<string[]> {
  if (!/^[A-Z]{2}$/.test(uf)) return [];
  try {
    return ((await import(`@/data/cidades/${uf}.json`)) as { default: string[] }).default;
  } catch {
    return [];
  }
}
