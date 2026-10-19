import "server-only";
import { SEGMENTS } from "../segments";
import { ProviderNotConfiguredError, ProviderRequestError, type LeadProvider, type ProviderLead, type SearchParams } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}
interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
}

function component(place: Place, type: string, short = false) {
  const c = place.addressComponents?.find((a) => a.types?.includes(type));
  return (short ? c?.shortText : c?.longText) ?? null;
}

function isSocial(url: string, host: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").endsWith(host);
  } catch {
    return false;
  }
}

export function mapPlace(place: Place, fetchedAt = new Date().toISOString()): ProviderLead {
  const website = place.websiteUri ?? null;
  const instagram = website && isSocial(website, "instagram.com") ? website : null;
  return {
    sourceRef: place.id,
    providerKey: "google_places",
    companyName: place.displayName?.text ?? "Sem nome",
    category: place.primaryTypeDisplayName?.text ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: instagram ? null : website,
    instagram,
    address: place.formattedAddress ?? null,
    neighborhood: component(place, "sublocality_level_1") ?? component(place, "sublocality"),
    city: component(place, "administrative_area_level_2") ?? component(place, "locality"),
    state: component(place, "administrative_area_level_1", true),
    country: component(place, "country", true),
    rating: place.rating ?? null,
    reviewsCount: place.userRatingCount ?? null,
    sourceUrl: place.googleMapsUri ?? null,
    businessStatus: place.businessStatus ?? null,
    fetchedAt,
  };
}

function buildQuery(p: SearchParams, segmentValue: string | undefined, city: string | undefined) {
  const seg = SEGMENTS.find((s) => s.value === segmentValue)?.query;
  const where = [city, p.state, p.country].filter(Boolean).join(", ");
  return [p.query || seg, where && `em ${where}`].filter(Boolean).join(" ");
}

export const googlePlaces: LeadProvider = {
  key: "google_places",
  name: "Google Places API",
  description: "Pesquisa de estabelecimentos comerciais via Places API (New) — Text Search.",
  termsNote:
    "Respeite os Termos de Serviço da Google Maps Platform: o conteúdo dos resultados tem restrições de armazenamento e uso. Salve somente o que for necessário para sua prospecção e mantenha a atribuição quando exigida.",
  status() {
    return process.env.GOOGLE_PLACES_API_KEY
      ? { configured: true }
      : {
          configured: false,
          missing: ["GOOGLE_PLACES_API_KEY"],
          instructions:
            "No Google Cloud, ative a “Places API (New)”, crie uma chave de API restrita a essa API e defina GOOGLE_PLACES_API_KEY nas variáveis de ambiente (Vercel e .env.local).",
        };
  },
  async search(params) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.name, ["GOOGLE_PLACES_API_KEY"]);
    const segs = (params.segments ?? []).slice(0, 3);
    const cities = (params.cities ?? []).slice(0, 2);
    const combos = (segs.length ? segs : [undefined]).flatMap((sg) => (cities.length ? cities : [undefined]).map((c) => ({ sg, c })));
    const fetchedAt = new Date().toISOString();
    const seen = new Set<string>();
    const leads: ProviderLead[] = [];
    let next: string | null = null;
    for (const { sg, c } of combos) {
      const textQuery = buildQuery(params, sg, c);
      if (!textQuery.trim()) throw new ProviderRequestError(this.name, "Informe um nicho, termo de busca ou localização.");
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify({
          textQuery, languageCode: "pt-BR", regionCode: (params.country ?? "BR").slice(0, 2).toUpperCase(), pageSize: 20,
          ...(params.pageToken && combos.length === 1 ? { pageToken: params.pageToken } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new ProviderRequestError(this.name, body?.error?.message ?? `Google Places respondeu HTTP ${res.status}.`, res.status);
      }
      const data = (await res.json()) as { places?: Place[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        const lead = { ...mapPlace(p, fetchedAt), segment: sg ?? null };
        if (!seen.has(lead.sourceRef)) { seen.add(lead.sourceRef); leads.push(lead); }
      }
      if (combos.length === 1) next = data.nextPageToken ?? null;
    }
    return { leads, nextPageToken: next };
  },
  async test() {
    try {
      await this.search({ query: "padaria", cities: ["São Paulo"] });
      return { ok: true, message: "Conexão com a Google Places API funcionando." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao testar a Google Places API." };
    }
  },
};
