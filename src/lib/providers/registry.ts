import "server-only";
import { googlePlaces } from "./google-places";
import { openStreetMap } from "./openstreetmap";
import type { LeadProvider } from "./types";

/**
 * Adaptadores de fonte externa. Para adicionar uma nova fonte (API empresarial licenciada,
 * CRM etc.) implemente `LeadProvider` em um arquivo próprio e registre aqui — nenhuma outra
 * parte do sistema precisa mudar.
 */
export const PROVIDERS: LeadProvider[] = [openStreetMap, googlePlaces];

export function getProvider(key: string) {
  return PROVIDERS.find((p) => p.key === key) ?? null;
}
