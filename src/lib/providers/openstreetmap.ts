import "server-only";
import { UF_NAMES } from "../constants";
import { SEGMENTS } from "../segments";
import { classifySegment } from "./osm-filters";
import { ProviderRequestError, type LeadProvider, type ProviderLead, type SearchParams } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "LeadFinderPro/1.0 (prospecção B2B; contato do operador na política de privacidade)";
const MAX_PER_CITY = 250;
const MAX_CITIES = 5;

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

export function mapElement(el: OsmElement, ctx: { city?: string | null; state?: string | null; country?: string | null; segment?: string | null }, fetchedAt = new Date().toISOString()): ProviderLead | null {
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
    phone: tag(t, "phone", "contact:phone", "mobile", "contact:mobile"),
    whatsapp: tag(t, "contact:whatsapp"),
    email: tag(t, "email", "contact:email")?.toLowerCase() ?? null,
    segment: ctx.segment ?? null,
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

/** Monta a consulta Overpass QL para uma área e um ou mais nichos (união dos filtros). */
export function buildOverpassQuery(areaId: number, segments: string[] | undefined, name?: string) {
  const chosen = SEGMENTS.filter((x) => segments?.includes(x.value));
  const filters = chosen.length ? chosen.flatMap((x) => x.osm) : ['["shop"]', '["office"]', '["amenity"]'];
  const nameFilter = name ? `["name"~"${name.replace(/["\\]/g, "").slice(0, 60)}",i]` : '["name"]';
  const blocks = filters.map((f) => `nwr(area.a)${f}${nameFilter};`).join("\n  ");
  return `[out:json][timeout:40];\narea(${areaId})->.a;\n(\n  ${blocks}\n);\nout center tags ${MAX_PER_CITY};`;
}

/** Quanto mais canais de contato públicos, melhor o lead para prospecção. */
export function completeness(l: Pick<ProviderLead, "phone" | "whatsapp" | "email" | "website" | "instagram">) {
  return (l.whatsapp ? 3 : 0) + (l.phone ? 2 : 0) + (l.email ? 2 : 0) + (l.website ? 1 : 0) + (l.instagram ? 1 : 0);
}

export function areaIdFor(osmType: string, osmId: number) {
  return osmType === "relation" ? 3_600_000_000 + osmId : osmType === "way" ? 2_400_000_000 + osmId : null;
}

async function resolveArea(p: SearchParams, city: string) {
  const params = new URLSearchParams({ format: "jsonv2", limit: "5", addressdetails: "1", "accept-language": "pt-BR", city, country: p.country === "BR" || !p.country ? "Brasil" : p.country });
  if (p.state) params.set("state", UF_NAMES[p.state] ?? p.state);
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new ProviderRequestError("OpenStreetMap", `Nominatim respondeu HTTP ${res.status}.`, res.status);
  const rows = (await res.json()) as { osm_type: string; osm_id: number; address?: Record<string, string> }[];
  const hit = rows.map((r) => ({ r, id: areaIdFor(r.osm_type, r.osm_id) })).find((x) => x.id !== null);
  if (!hit) throw new ProviderRequestError("OpenStreetMap", `Não encontrei a cidade “${city}”${p.state ? `/${p.state}` : ""} no OpenStreetMap. Confira o nome.`);
  const a = hit.r.address ?? {};
  return { areaId: hit.id!, city: a.city ?? a.town ?? a.municipality ?? city, state: p.state ?? null, country: (a.country_code ?? "br").toUpperCase() };
}

/** Falhas de rede/timeout viram uma mensagem compreensível (erros já tratados passam direto). */
function friendlyError(e: unknown) {
  if (e instanceof ProviderRequestError) return e.message;
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return "O OpenStreetMap demorou demais para responder. Tente com menos cidades ou nichos.";
  return "Não foi possível acessar o OpenStreetMap agora (serviço fora do ar ou sem conexão). Tente novamente em instantes.";
}

export const openStreetMap: LeadProvider = {
  key: "openstreetmap",
  name: "OpenStreetMap (gratuito)",
  description: "Estabelecimentos mapeados pela comunidade OpenStreetMap, por cidade e nicho (várias cidades e nichos por pesquisa). Não exige chave de API. Cobertura de telefone/site varia por região.",
  termsNote:
    "Dados © colaboradores do OpenStreetMap, licença ODbL (uso comercial permitido com atribuição). Os dados são colaborativos: podem estar incompletos ou desatualizados — confirme antes de abordar. Respeite os limites de uso dos serviços públicos (Nominatim/Overpass).",
  status: () => ({ configured: true }),
  async search(params) {
    const cities = [...new Set((params.cities ?? []).map((c) => c.trim()).filter(Boolean))].slice(0, MAX_CITIES);
    if (cities.length === 0) throw new ProviderRequestError(this.name, "Escolha ao menos uma cidade para pesquisar no OpenStreetMap.");
    const chosen = SEGMENTS.filter((x) => params.segments?.includes(x.value));
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const leads: ProviderLead[] = [];
    const errors: string[] = [];

    for (let i = 0; i < cities.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100)); // política do Nominatim: no máximo 1 requisição/segundo
      try {
        const area = await resolveArea(params, cities[i]);
        const q = buildOverpassQuery(area.areaId, chosen.map((x) => x.value), params.query?.trim() || undefined);
        const res = await fetch(OVERPASS, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: q }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) throw new ProviderRequestError(this.name, res.status === 429 || res.status === 504 ? "O serviço Overpass está ocupado. Tente novamente em instantes." : `Overpass respondeu HTTP ${res.status}.`, res.status);
        const data = (await res.json()) as { elements?: OsmElement[] };
        for (const el of data.elements ?? []) {
          const segment = chosen.length ? classifySegment(el.tags ?? {}, chosen) : null;
          const lead = mapElement(el, { ...area, segment }, fetchedAt);
          if (lead && !seen.has(lead.sourceRef)) { seen.add(lead.sourceRef); leads.push(lead); }
        }
      } catch (e) {
        errors.push(friendlyError(e));
      }
    }
    if (leads.length === 0 && errors.length) throw new ProviderRequestError(this.name, errors[0]);
    // Melhores primeiro: quem tem mais canais públicos de contato.
    leads.sort((a, b) => completeness(b) - completeness(a) || a.companyName.localeCompare(b.companyName, "pt-BR"));
    return { leads, nextPageToken: null };
  },
  async test() {
    try {
      const r = await this.search({ cities: ["Campinas"], state: "SP", segments: [SEGMENTS[0].value], limit: 1 });
      return { ok: true, message: `OpenStreetMap respondendo (${r.leads.length} resultado(s) no teste).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao testar o OpenStreetMap." };
    }
  },
};
