import type { ProviderLead } from "./types";

export interface SearchInput {
  provider: string; // "google_places" | "internal"
  name?: string;
  segment?: string;
  category?: string;
  country?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  site?: "yes" | "no" | "";
  insta?: "yes" | "no" | "";
  wa?: "yes" | "";
  minRating?: number;
  minReviews?: number;
  updatedSince?: string;
  pageToken?: string | null;
}

export interface ResultRow extends ProviderLead {
  savedLeadId?: string | null;
  score?: number | null;
  scorePriority?: string | null;
  stageName?: string | null;
  whatsapp?: string | null;
  doNotContact?: boolean;
  updatedAt?: string | null;
}

export interface SearchOutput {
  results: ResultRow[];
  nextPageToken: string | null;
  note?: string;
}

/** Filtros de presença digital aplicados no servidor sobre resultados externos. */
export function matchesPresence(r: Pick<ProviderLead, "website" | "instagram" | "phone" | "rating" | "reviewsCount"> & { whatsapp?: string | null }, f: SearchInput) {
  if (f.site === "yes" && !r.website) return false;
  if (f.site === "no" && r.website) return false;
  if (f.insta === "yes" && !r.instagram) return false;
  if (f.insta === "no" && r.instagram) return false;
  if (f.wa === "yes" && !(r.whatsapp || r.phone)) return false;
  if (f.minRating && (r.rating ?? 0) < f.minRating) return false;
  if (f.minReviews && (r.reviewsCount ?? 0) < f.minReviews) return false;
  return true;
}
