export { SEGMENTS, SEGMENT_GROUPS, segmentLabel, type SegmentValue } from "./segments";

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const SERVICES = [
  { value: "site", label: "Site profissional" },
  { value: "loja_virtual", label: "Loja virtual / catálogo digital" },
  { value: "sistema_gestao", label: "Sistema de gestão empresarial" },
  { value: "sistema_clinica", label: "Sistema para clínicas odontológicas" },
  { value: "sistema_beleza", label: "Sistema para salões e nail designers" },
  { value: "cardapio_digital", label: "Cardápio digital e pedidos pelo WhatsApp" },
  { value: "ordens_servico", label: "Sistema de ordens de serviço" },
  { value: "automacao", label: "Automação de processos comerciais" },
] as const;

export type ServiceValue = (typeof SERVICES)[number]["value"];

export function serviceLabel(value: string | null | undefined) {
  return SERVICES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export const PRIORITY_LABEL = { high: "Alta prioridade", medium: "Prioridade média", low: "Baixa prioridade" } as const;

export const ACTIVITY_LABEL: Record<string, string> = {
  note: "Observação",
  stage_change: "Mudança de etapa",
  call: "Ligação",
  whatsapp_started: "WhatsApp iniciado",
  whatsapp_response: "Resposta recebida",
  email: "E-mail",
  meeting: "Reunião",
  proposal: "Proposta",
  contact_done: "Contato realizado",
  opt_out: "Pedido de não contato",
  system: "Sistema",
};

export const PORTFOLIO_URL = "https://cvx-redirecionador.vercel.app";

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco",
  PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
