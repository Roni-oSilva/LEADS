export interface SearchParams {
  /** Filtro por nome da empresa. */
  query?: string;
  /** Nichos (valores de src/lib/segments.ts). */
  segments?: string[];
  country?: string;
  state?: string;
  /** Cidades (no máximo 5 por pesquisa). */
  cities?: string[];
  pageToken?: string;
  limit?: number;
}

export interface ProviderLead {
  /** Identificador estável na fonte (ex.: place_id). */
  sourceRef: string;
  providerKey: string;
  companyName: string;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  /** Nicho em que o resultado foi classificado. */
  segment?: string | null;
  website?: string | null;
  instagram?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  sourceUrl?: string | null;
  businessStatus?: string | null;
  fetchedAt: string;
}

export interface SearchResult {
  leads: ProviderLead[];
  nextPageToken?: string | null;
}

export type ProviderStatus =
  | { configured: true }
  | { configured: false; missing: string[]; instructions: string };

export interface LeadProvider {
  key: string;
  name: string;
  description: string;
  /** Termos/observações de uso que devem ser exibidos ao usuário. */
  termsNote?: string;
  status(): ProviderStatus;
  search(params: SearchParams): Promise<SearchResult>;
  /** Teste de conexão leve. */
  test(): Promise<{ ok: boolean; message: string }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(public provider: string, public missing: string[]) {
    super(`A fonte "${provider}" não está configurada. Variáveis ausentes: ${missing.join(", ")}.`);
  }
}

export class ProviderRequestError extends Error {
  constructor(public provider: string, message: string, public status?: number) {
    super(message);
  }
}
