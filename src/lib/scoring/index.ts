import { normalizeWhatsAppNumber } from "../whatsapp/link";
import { normalizePhone } from "../dedupe";

export const CRITERIA = [
  { key: "service_fit", label: "Compatibilidade com o serviço oferecido" },
  { key: "need", label: "Necessidade comercial identificada" },
  { key: "evidence", label: "Evidência pública de oportunidade" },
  { key: "geo", label: "Compatibilidade geográfica" },
  { key: "channel", label: "Canal comercial legítimo disponível" },
  { key: "interest", label: "Interesse demonstrado pelo contato" },
  { key: "recency", label: "Recência das informações" },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];
export type Weights = Record<CriterionKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  service_fit: 20,
  need: 20,
  evidence: 15,
  geo: 10,
  channel: 15,
  interest: 10,
  recency: 10,
};

export interface ScoringConfig {
  weights: Weights;
  /** Segmentos que a organização atende. Vazio = todos. */
  targetSegments: string[];
  targetStates: string[];
  targetCities: string[];
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: DEFAULT_WEIGHTS,
  targetSegments: [],
  targetStates: [],
  targetCities: [],
};

export interface ScoringEvidence {
  confidence: "low" | "medium" | "high";
  verified: boolean;
}

export interface ScoringLead {
  segment: string | null;
  state: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  do_not_contact: boolean;
  data_updated_at: string | null;
  /** Veio de formulário próprio ou registrou resposta. */
  showed_interest: boolean;
  evidence: ScoringEvidence[];
}

export interface BreakdownItem {
  key: CriterionKey;
  label: string;
  weight: number;
  points: number;
  reason: string;
}

export interface ScoreResult {
  score: number;
  priority: "high" | "medium" | "low";
  breakdown: BreakdownItem[];
}

export function priorityFor(score: number): ScoreResult["priority"] {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/** Normaliza pesos arbitrários para somar 100, preservando proporções. */
export function normalizeWeights(input: Partial<Weights> | null | undefined): Weights {
  const merged = { ...DEFAULT_WEIGHTS, ...(input ?? {}) } as Weights;
  const keys = CRITERIA.map((c) => c.key);
  const clean = Object.fromEntries(keys.map((k) => [k, Math.max(0, Number(merged[k]) || 0)])) as Weights;
  const total = keys.reduce((s, k) => s + clean[k], 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const scaled = Object.fromEntries(keys.map((k) => [k, Math.floor((clean[k] / total) * 100)])) as Weights;
  let remainder = 100 - keys.reduce((s, k) => s + scaled[k], 0);
  // Distribui o resto pelos maiores pesos para totalizar exatamente 100.
  for (const k of [...keys].sort((a, b) => clean[b] - clean[a])) {
    if (remainder <= 0) break;
    scaled[k] += 1;
    remainder -= 1;
  }
  return scaled;
}

const CONF_RANK = { low: 0.4, medium: 0.7, high: 1 } as const;

function daysSince(iso: string | null, now: Date) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / 86_400_000;
}

export function scoreLead(lead: ScoringLead, config: ScoringConfig = DEFAULT_CONFIG, now = new Date()): ScoreResult {
  const weights = normalizeWeights(config.weights);
  const ratio: Record<CriterionKey, { r: number; reason: string }> = {} as never;

  // service_fit
  if (!lead.segment) ratio.service_fit = { r: 0.3, reason: "Segmento não informado." };
  else if (config.targetSegments.length === 0) ratio.service_fit = { r: lead.segment === "pme" ? 0.6 : 1, reason: lead.segment === "pme" ? "Segmento genérico (PME)." : "Segmento atendido." };
  else if (config.targetSegments.includes(lead.segment)) ratio.service_fit = { r: 1, reason: "Segmento está entre os segmentos-alvo." };
  else ratio.service_fit = { r: 0.2, reason: "Segmento fora dos segmentos-alvo." };

  // need
  if (lead.evidence.length === 0) ratio.need = { r: 0, reason: "Nenhuma necessidade identificada até agora." };
  else {
    const best = lead.evidence.reduce((m, e) => Math.max(m, CONF_RANK[e.confidence]), 0);
    ratio.need = { r: best, reason: `${lead.evidence.length} sinal(is) de oportunidade; maior confiança: ${best >= 1 ? "alta" : best >= 0.7 ? "média" : "baixa"}.` };
  }

  // evidence
  const verified = lead.evidence.filter((e) => e.verified).length;
  if (verified >= 2) ratio.evidence = { r: 1, reason: `${verified} evidências verificadas.` };
  else if (verified === 1) ratio.evidence = { r: 0.7, reason: "1 evidência verificada." };
  else if (lead.evidence.length > 0) ratio.evidence = { r: 0.3, reason: "Sinais ainda não verificados." };
  else ratio.evidence = { r: 0, reason: "Sem evidências registradas." };

  // geo
  const hasTargets = config.targetStates.length > 0 || config.targetCities.length > 0;
  if (!hasTargets) ratio.geo = { r: 0.5, reason: "Nenhuma região-alvo configurada (valor neutro)." };
  else if (lead.city && config.targetCities.some((c) => c.toLowerCase() === lead.city!.toLowerCase())) ratio.geo = { r: 1, reason: "Cidade-alvo." };
  else if (lead.state && config.targetStates.includes(lead.state.toUpperCase())) ratio.geo = { r: 0.6, reason: "Estado-alvo." };
  else ratio.geo = { r: 0, reason: "Fora da região-alvo." };

  // channel
  const wa = normalizeWhatsAppNumber(lead.whatsapp);
  const phone = normalizePhone(lead.phone);
  if (lead.do_not_contact) ratio.channel = { r: 0, reason: "Contato bloqueado (não contatar)." };
  else if (wa) ratio.channel = { r: 1, reason: "WhatsApp comercial público disponível." };
  else if (phone && lead.email) ratio.channel = { r: 0.8, reason: "Telefone e e-mail comerciais disponíveis." };
  else if (phone || lead.email) ratio.channel = { r: 0.6, reason: phone ? "Telefone comercial disponível." : "E-mail comercial disponível." };
  else ratio.channel = { r: 0, reason: "Nenhum canal comercial identificado." };

  // interest
  ratio.interest = lead.showed_interest
    ? { r: 1, reason: "O contato demonstrou interesse (formulário ou resposta registrada)." }
    : { r: 0, reason: "Sem interesse demonstrado até agora." };

  // recency
  const age = daysSince(lead.data_updated_at, now);
  if (age <= 30) ratio.recency = { r: 1, reason: "Dados atualizados nos últimos 30 dias." };
  else if (age <= 90) ratio.recency = { r: 0.6, reason: "Dados com 31–90 dias." };
  else if (age <= 180) ratio.recency = { r: 0.3, reason: "Dados com 91–180 dias." };
  else ratio.recency = { r: 0, reason: "Dados desatualizados (mais de 180 dias)." };

  const breakdown: BreakdownItem[] = CRITERIA.map((c) => ({
    key: c.key,
    label: c.label,
    weight: weights[c.key],
    points: Math.round(weights[c.key] * ratio[c.key].r),
    reason: ratio[c.key].reason,
  }));

  let score = Math.max(0, Math.min(100, breakdown.reduce((s, b) => s + b.points, 0)));
  if (lead.do_not_contact) score = 0;
  return { score, priority: priorityFor(score), breakdown };
}

export const SCORE_DISCLAIMER =
  "A pontuação é uma estimativa baseada em critérios configuráveis. Ela não garante interesse ou compra.";
