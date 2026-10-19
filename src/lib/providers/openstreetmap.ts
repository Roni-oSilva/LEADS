import "server-only";
import { SEGMENTS, UF_NAMES } from "../constants";
import { ProviderRequestError, type LeadProvider, type ProviderLead, type SearchParams } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "LeadFinderPro/1.0 (prospecção B2B; contato do operador na política de privacidade)";
const MAX_RESULTS = 100;

/** Filtros de tags OSM por segmento (Overpass QL). */
export const SEGMENT_FILTERS: Record<string, string[]> = {
  restaurante: ['["amenity"~"^(restaurant|fast_food|cafe)$"]', '["cuisine"="pizza"]'],
  clinica_odontologica: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  oficina_mecanica: ['["shop"="car_repair"]'],
  salao_beleza: ['["shop"~"^(hairdresser|beauty)$"]'],
  nail_designer: ['["shop"="beauty"]["beauty"~"nails"]', '["shop"="beauty"]["name"~"unha|nail|manicure",i]'],
  loja_roupas: ['["shop"~"^(clothes|boutique|fashion)$"]'],
  sublimacao: ['["shop"~"^(gift|copyshop|printing)$"]', '["craft"="printer"]'],
  grafica: ['["shop"~"^(copyshop|printing)$"]', '["craft"="printer"]'],
  academia: ['["leisure"="fitness_centre"]'],
  imobiliaria: ['["office"="estate_agent"]'],
  prestador_servicos: ['["office"~"^(company|consulting|lawyer|accountant|insurance|it|architect)$"]', '["craft"]'],
  pme: ['["shop"]', '["office"]'],
};

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const tag = (t: Record<string, string>, ...keys: string[]) => keys.map((k) => t[k]?.trim()).find(Boolean) ?? null;

/** Normaliza o valor de Instagram do OSM (usuário ou URL) em URL. */
function instagramUrl(v: string | null) {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^@/, "")}`;
}

export function mapElement(el: OsmElement, ctx: { city?: string | null; state?: string | null; country?: string | null }, fetchedAt = new Date().toISOString()): ProviderLead | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  if (!name) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const address = [street, t["addr:suburb"] ?? t["addr:neighbourhood"], t["addr:city"] ?? ctx.city].filter(Boolean).join(" - ") || null;
  const website = tag(t, "website", "contact:website", "url");
  const insta = instagramUrl(tag(t, "contact:instagram", "instagram"));
  const siteIsSocial = !!website && /(instagram|facebook)\.com/i.test(website);
  return {
    sourceRef: `osm:${el.type}/${el.id}`,
    providerKey: "openstreetmap",
    companyName: name,
    category: tag(t, "shop", "amenity", "office", "craft", "leisure"),
    phone: tag(t, "phone", "contact:phone"),
    whatsapp: tag(t, "contact:whatsapp"),
    website: siteIsSocial ? null : website,
    instagram: insta ?? (siteIsSocial && /instagram\.com/i.test(website!) ? website : null),
    address,
    neighborhood: t["addr:suburb"] ?? t["addr:neighbourhood"] ?? null,
    city: t["addr:city"] ?? ctx.city ?? null,
    state: ctx.state ?? null,
    country: ctx.country ?? "BR",
    rating: null,
    reviewsCount: null,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    fetchedAt,
  };
}

/** Monta a consulta Overpass QL para uma área e um segmento (ou termo livre). */
export function buildOverpassQuery(areaId: number, segment: string | undefined, name?: string) {
  const filters = SEGMENT_FILTERS[segment ?? ""] ?? ['["shop"]', '["office"]', '["amenity"]'];
  const nameFilter = name ? `["name"~"${name.replace(/["\\]/g, "").slice(0, 60)}",i]` : '["name"]';
  const blocks = filters.map((f) => `nwr(area.a)${f}${nameFilter};`).join("\n  ");
  return `[out:json][timeout:25];\narea(${areaId})->.a;\n(\n  ${blocks}\n);\nout center tags ${MAX_RESULTS};`;
}

export function areaIdFor(osmType: string, osmId: number) {
  return osmType === "relation" ? 3_600_000_000 + osmId : osmType === "way" ? 2_400_000_000 + osmId : null;
}

async function resolveArea(p: SearchParams) {
  const params = new URLSearchParams({ format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "pt-BR", city: p.city!, country: p.country === "BR" || !p.country ? "Brasil" : p.country });
  if (p.state) params.set("state", UF_NAMES[p.state] ?? p.state);
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new ProviderRequestError("OpenStreetMap", `Nominatim respondeu HTTP ${res.status}.`, res.status);
  const rows = (await res.json()) as { osm_type: string; osm_id: number; address?: Record<string, string> }[];
  const hit = rows.map((r) => ({ r, id: areaIdFor(r.osm_type, r.osm_id) })).find((x) => x.id !== null);
  if (!hit) throw new ProviderRequestError("OpenStreetMap", `Não encontrei a cidade “${p.city}”${p.state ? `/${p.state}` : ""} no OpenStreetMap. Confira o nome.`);
  const a = hit.r.address ?? {};
  return { areaId: hit.id!, city: a.city ?? a.town ?? a.municipality ?? p.city!, state: p.state ?? null, country: (a.country_code ?? "br").toUpperCase() };
}

export const openStreetMap: LeadProvider = {
  key: "openstreetmap",
  name: "OpenStreetMap (gratuito)",
  description: "Estabelecimentos mapeados pela comunidade OpenStreetMap, por cidade e segmento. Não exige chave de API. Cobertura de telefone/site varia por região.",
  termsNote:
    "Dados © colaboradores do OpenStreetMap, licença ODbL (uso comercial permitido com atribuição). Os dados são colaborativos: podem estar incompletos ou desatualizados — confirme antes de abordar. Respeite os limites de uso dos serviços públicos (Nominatim/Overpass).",
  status: () => ({ configured: true }),
  async search(params) {
    if (!params.city?.trim()) throw new ProviderRequestError(this.name, "Informe a cidade para pesquisar no OpenStreetMap.");
    const area = await resolveArea(params);
    const q = buildOverpassQuery(area.areaId, params.segment, params.query?.trim() || undefined);
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: q }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new ProviderRequestError(this.name, res.status === 429 || res.status === 504 ? "O serviço Overpass está ocupado. Tente novamente em instantes." : `Overpass respondeu HTTP ${res.status}.`, res.status);
    const data = (await res.json()) as { elements?: OsmElement[] };
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const leads = (data.elements ?? [])
      .map((e) => mapElement(e, area, fetchedAt))
      .filter((l): l is ProviderLead => !!l && !seen.has(l.sourceRef) && !!seen.add(l.sourceRef));
    return { leads, nextPageToken: null };
  },
  async test() {
    try {
      const r = await this.search({ city: "Campinas", state: "SP", segment: SEGMENTS[0].value, limit: 1 });
      return { ok: true, message: `OpenStreetMap respondendo (${r.leads.length} resultado(s) no teste).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao testar o OpenStreetMap." };
    }
  },
};
