export interface Stage {
  id: string;
  key: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  is_suppressed: boolean;
}

export interface Lead {
  id: string;
  organization_id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cnpj: string | null;
  website: string | null;
  instagram: string | null;
  socials: Record<string, string>;
  segment: string | null;
  category: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  source_id: string | null;
  source_ref: string | null;
  source_url: string | null;
  discovered_at: string;
  data_updated_at: string;
  owner_id: string | null;
  stage_id: string | null;
  score: number;
  score_priority: "high" | "medium" | "low";
  score_breakdown: import("./scoring").BreakdownItem[];
  next_action: string | null;
  follow_up_at: string | null;
  estimated_value: number | null;
  favorite: boolean;
  lawful_basis: "legitimate_interest" | "consent" | "contract" | "other" | null;
  do_not_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  user_id: string;
  role: string;
  profile: { full_name: string | null; email: string | null } | null;
}

export interface Evidence {
  id: string;
  lead_id: string;
  signal_key: string;
  title: string;
  evidence: string;
  source: string;
  service: string | null;
  confidence: "low" | "medium" | "high";
  recommended_action: string | null;
  verified: boolean;
  checked_at: string;
}
