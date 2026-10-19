export interface WebsiteCheck {
  url: string;
  checkedAt: string;
  ok: boolean;
  status: number | null;
  https: boolean;
  responseMs: number | null;
  error?: string;
}

export interface OpportunityLead {
  segment: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  phone: string | null;
  source_name: string | null;
}

export interface OpportunityDraft {
  signal_key: string;
  title: string;
  evidence: string;
  source: string;
  service: string;
  confidence: "low" | "medium" | "high";
  recommended_action: string;
  verified: boolean;
  checked_at: string;
}

const APPOINTMENT_SEGMENTS: Record<string, string> = {
  clinica_odontologica: "sistema_clinica",
  salao_beleza: "sistema_beleza",
  nail_designer: "sistema_beleza",
  academia: "sistema_gestao",
};

/**
 * Gera sinais de oportunidade a partir de dados públicos já coletados e, opcionalmente,
 * do resultado de uma verificação do site. Ausência de dados NUNCA é tratada como prova:
 * sinais sem verificação saem com `verified=false` e confiança baixa.
 */
export function analyzeOpportunities(
  lead: OpportunityLead,
  check: WebsiteCheck | null = null,
  now = new Date(),
): OpportunityDraft[] {
  const out: OpportunityDraft[] = [];
  const at = (check?.checkedAt ?? now.toISOString());
  const src = lead.source_name ?? "dados da fonte";
  const hasSocialOnly = !lead.website && !!lead.instagram;

  if (!lead.website) {
    out.push({
      signal_key: hasSocialOnly ? "no_own_channel" : "no_website",
      title: hasSocialOnly ? "Canal digital próprio não identificado (apenas rede social)" : "Site não identificado",
      evidence: hasSocialOnly
        ? `A fonte (${src}) não traz site, apenas Instagram. Isso não comprova que não exista um site.`
        : `A fonte (${src}) não informa site. Isso não comprova que a empresa não possua um — status: não identificado.`,
      source: src,
      service: "site",
      confidence: hasSocialOnly ? "medium" : "low",
      recommended_action: "Pesquisar manualmente o nome da empresa (Google/Instagram) para confirmar antes de abordar.",
      verified: false,
      checked_at: at,
    });
  }

  if (lead.website && check) {
    if (!check.ok) {
      out.push({
        signal_key: "site_unreachable",
        title: "Site indisponível durante a verificação",
        evidence: `Verificação em ${check.url}: ${check.error ?? `HTTP ${check.status}`}. Pode ser instabilidade momentânea — repita a verificação.`,
        source: "Verificação técnica automatizada (1 requisição pública à página inicial)",
        service: "site",
        confidence: "medium",
        recommended_action: "Repetir a verificação em outro horário; se persistir, oferecer renovação/hospedagem do site.",
        verified: true,
        checked_at: check.checkedAt,
      });
    } else {
      if (!check.https) {
        out.push({
          signal_key: "site_no_https",
          title: "Site sem HTTPS",
          evidence: `${check.url} respondeu sem conexão segura (HTTP). Navegadores exibem aviso de “não seguro”.`,
          source: "Verificação técnica automatizada",
          service: "site",
          confidence: "high",
          recommended_action: "Mencionar o aviso de segurança e propor modernização do site.",
          verified: true,
          checked_at: check.checkedAt,
        });
      }
      if (check.responseMs && check.responseMs > 4000) {
        out.push({
          signal_key: "site_slow",
          title: "Site lento na verificação",
          evidence: `Resposta da página inicial em ${(check.responseMs / 1000).toFixed(1)}s (uma medição).`,
          source: "Verificação técnica automatizada",
          service: "site",
          confidence: "low",
          recommended_action: "Repetir a medição antes de citar o problema na abordagem.",
          verified: true,
          checked_at: check.checkedAt,
        });
      }
    }
  }

  if (!lead.website) {
    if (lead.segment === "restaurante") {
      out.push({
        signal_key: "no_digital_menu",
        title: "Cardápio digital não identificado",
        evidence: `Restaurante sem site informado em ${src}; não foi identificado cardápio digital próprio (não verificado).`,
        source: src,
        service: "cardapio_digital",
        confidence: "low",
        recommended_action: "Conferir o Instagram/Google para ver como o cardápio é divulgado e propor cardápio digital com pedidos pelo WhatsApp.",
        verified: false,
        checked_at: at,
      });
    }
    if (["loja_roupas", "sublimacao", "grafica"].includes(lead.segment ?? "")) {
      out.push({
        signal_key: "no_catalog",
        title: "Catálogo digital não identificado",
        evidence: `Negócio de produtos sem site informado em ${src}; catálogo digital próprio não identificado (não verificado).`,
        source: src,
        service: "loja_virtual",
        confidence: "low",
        recommended_action: "Verificar como os produtos são divulgados e propor catálogo/loja virtual.",
        verified: false,
        checked_at: at,
      });
    }
  }

  if (lead.whatsapp) {
    out.push({
      signal_key: "whatsapp_service",
      title: "Atendimento por WhatsApp divulgado",
      evidence: `WhatsApp comercial público informado em ${src}. Pode se beneficiar de automação de atendimento e catálogo.`,
      source: src,
      service: "automacao",
      confidence: "medium",
      recommended_action: "Abordar pelo WhatsApp oficial (wa.me) com mensagem personalizada, respeitando o consentimento.",
      verified: false,
      checked_at: at,
    });
  }

  const sched = APPOINTMENT_SEGMENTS[lead.segment ?? ""];
  if (sched) {
    out.push({
      signal_key: "scheduling_need",
      title: "Possível necessidade de agendamento/gestão",
      evidence: "Hipótese baseada no segmento (atendimento por horário). Não há evidência direta sobre como a empresa gerencia a agenda.",
      source: "Inferência por segmento",
      service: sched,
      confidence: "low",
      recommended_action: "Perguntar na conversa como a agenda é controlada hoje antes de apresentar a solução.",
      verified: false,
      checked_at: at,
    });
  }

  if (lead.segment === "oficina_mecanica" || lead.segment === "grafica") {
    out.push({
      signal_key: "service_orders_need",
      title: "Possível necessidade de ordens de serviço",
      evidence: "Hipótese baseada no segmento (serviços sob ordem/pedido). Não verificado.",
      source: "Inferência por segmento",
      service: "ordens_servico",
      confidence: "low",
      recommended_action: "Questionar como orçamentos e ordens são controlados hoje.",
      verified: false,
      checked_at: at,
    });
  }
  if (["loja_roupas", "sublimacao"].includes(lead.segment ?? "")) {
    out.push({
      signal_key: "stock_need",
      title: "Possível necessidade de controle de estoque",
      evidence: "Hipótese baseada no segmento (revenda de produtos). Não verificado.",
      source: "Inferência por segmento",
      service: "sistema_gestao",
      confidence: "low",
      recommended_action: "Questionar como o estoque e as vendas são controlados.",
      verified: false,
      checked_at: at,
    });
  }

  return out;
}
