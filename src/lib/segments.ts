/**
 * Nichos de prospecção. Cada nicho define o termo de busca para provedores de texto (Google Places)
 * e os filtros de tags OpenStreetMap (Overpass QL) para a pesquisa gratuita.
 * `value` é gravado em leads.segment — mantenha estável.
 */
export interface Segment {
  value: string;
  label: string;
  group: string;
  query: string;
  osm: string[];
}

type Row = [value: string, label: string, group: string, query: string, ...osm: string[]];

const ROWS: Row[] = [
  // Automotivo
  ["oficina_mecanica", "Oficinas mecânicas", "Automotivo", "oficina mecânica", '["shop"="car_repair"]'],
  ["auto_eletrica", "Auto elétricas", "Automotivo", "auto elétrica", '["shop"="car_repair"]["name"~"el[eé]tric",i]', '["craft"="electrician"]["name"~"auto",i]'],
  ["funilaria_pintura", "Funilarias e pintura automotiva", "Automotivo", "funilaria e pintura automotiva", '["shop"="car_repair"]["name"~"funilaria|pintura|lanternagem",i]', '["craft"="paint"]'],
  ["borracharia_pneus", "Borracharias e pneus", "Automotivo", "borracharia pneus", '["shop"="tyres"]'],
  ["lava_jato", "Lava-jatos e estética automotiva", "Automotivo", "lava jato estética automotiva", '["amenity"="car_wash"]'],
  ["autopecas", "Autopeças", "Automotivo", "autopeças", '["shop"="car_parts"]'],
  ["concessionaria", "Concessionárias e revendas de veículos", "Automotivo", "revenda de veículos concessionária", '["shop"="car"]'],
  ["moto_oficina", "Oficinas e lojas de motos", "Automotivo", "oficina de motos", '["shop"="motorcycle_repair"]', '["shop"="motorcycle"]'],
  ["auto_escola", "Autoescolas", "Automotivo", "autoescola", '["amenity"="driving_school"]'],
  // Alimentação
  ["restaurante", "Restaurantes e pizzarias", "Alimentação", "restaurante pizzaria", '["amenity"="restaurant"]', '["cuisine"="pizza"]'],
  ["pizzaria", "Pizzarias", "Alimentação", "pizzaria", '["cuisine"="pizza"]', '["name"~"pizz",i]["amenity"~"restaurant|fast_food"]'],
  ["lanchonete_hamburgueria", "Lanchonetes e hamburguerias", "Alimentação", "lanchonete hamburgueria", '["amenity"="fast_food"]', '["cuisine"="burger"]'],
  ["padaria", "Padarias", "Alimentação", "padaria", '["shop"="bakery"]'],
  ["confeitaria_doces", "Confeitarias, doces e chocolates", "Alimentação", "confeitaria doceria", '["shop"~"^(confectionery|pastry|chocolate)$"]'],
  ["cafeteria", "Cafeterias", "Alimentação", "cafeteria", '["amenity"="cafe"]'],
  ["bar_pub", "Bares e pubs", "Alimentação", "bar", '["amenity"~"^(bar|pub)$"]'],
  ["sorveteria_acai", "Sorveterias e açaí", "Alimentação", "sorveteria açaí", '["amenity"="ice_cream"]', '["cuisine"="ice_cream"]', '["name"~"a[cç]a[ií]",i]'],
  ["acougue", "Açougues e casas de carne", "Alimentação", "açougue", '["shop"="butcher"]'],
  ["hortifruti", "Hortifrútis e sacolões", "Alimentação", "hortifruti sacolão", '["shop"="greengrocer"]'],
  ["mercado_supermercado", "Mercados e minimercados", "Alimentação", "mercado supermercado", '["shop"~"^(supermarket|convenience)$"]'],
  ["adega_bebidas", "Adegas e distribuidoras de bebidas", "Alimentação", "adega distribuidora de bebidas", '["shop"~"^(alcohol|beverages|wine)$"]'],
  // Saúde e bem-estar
  ["clinica_odontologica", "Clínicas odontológicas", "Saúde e bem-estar", "clínica odontológica dentista", '["amenity"="dentist"]', '["healthcare"="dentist"]'],
  ["clinica_medica", "Clínicas médicas e consultórios", "Saúde e bem-estar", "clínica médica", '["amenity"~"^(clinic|doctors)$"]'],
  ["veterinaria_petshop", "Veterinárias e pet shops", "Saúde e bem-estar", "veterinária pet shop", '["amenity"="veterinary"]', '["shop"="pet"]'],
  ["farmacia", "Farmácias", "Saúde e bem-estar", "farmácia", '["amenity"="pharmacy"]'],
  ["laboratorio", "Laboratórios de análises", "Saúde e bem-estar", "laboratório de análises clínicas", '["healthcare"="laboratory"]'],
  ["fisioterapia_psicologia", "Fisioterapia, psicologia e terapias", "Saúde e bem-estar", "fisioterapia psicólogo", '["healthcare"~"^(physiotherapist|psychotherapist|psychologist|alternative)$"]'],
  ["otica", "Óticas", "Saúde e bem-estar", "ótica", '["shop"="optician"]'],
  ["academia", "Academias", "Saúde e bem-estar", "academia", '["leisure"="fitness_centre"]'],
  ["pilates_yoga", "Pilates, yoga e estúdios fitness", "Saúde e bem-estar", "estúdio de pilates yoga", '["sport"~"pilates|yoga|crossfit"]', '["leisure"="fitness_centre"]["name"~"pilates|yoga|studio|est[uú]dio",i]'],
  // Beleza
  ["salao_beleza", "Salões de beleza", "Beleza", "salão de beleza", '["shop"~"^(hairdresser|beauty)$"]'],
  ["barbearia", "Barbearias", "Beleza", "barbearia", '["shop"="hairdresser"]["name"~"barbe|barber",i]', '["shop"="hairdresser"]["male"="only"]'],
  ["nail_designer", "Nail designers e manicures", "Beleza", "nail designer manicure unhas", '["shop"="beauty"]["beauty"~"nails"]', '["shop"="beauty"]["name"~"unha|nail|manicure",i]'],
  ["estetica_spa", "Estética, depilação e spas", "Beleza", "clínica de estética spa", '["shop"="beauty"]', '["leisure"="spa"]', '["shop"="massage"]'],
  ["tatuagem_piercing", "Estúdios de tatuagem e piercing", "Beleza", "estúdio de tatuagem", '["shop"="tattoo"]'],
  // Comércio
  ["loja_roupas", "Lojas de roupas", "Comércio", "loja de roupas", '["shop"~"^(clothes|boutique|fashion)$"]'],
  ["loja_calcados", "Lojas de calçados", "Comércio", "loja de calçados", '["shop"="shoes"]'],
  ["joalheria_relojoaria", "Joalherias e relojoarias", "Comércio", "joalheria relojoaria", '["shop"~"^(jewelry|watches)$"]'],
  ["loja_celulares_eletronicos", "Celulares, eletrônicos e informática", "Comércio", "loja de celulares eletrônicos", '["shop"~"^(mobile_phone|electronics|computer)$"]'],
  ["moveis_decoracao", "Móveis e decoração", "Comércio", "loja de móveis decoração", '["shop"~"^(furniture|interior_decoration|kitchen|bed|curtain|carpet)$"]'],
  ["papelaria_livraria", "Papelarias e livrarias", "Comércio", "papelaria livraria", '["shop"~"^(stationery|books)$"]'],
  ["floricultura", "Floriculturas", "Comércio", "floricultura", '["shop"="florist"]'],
  ["loja_presentes_brinquedos", "Presentes, brinquedos e variedades", "Comércio", "loja de presentes brinquedos", '["shop"~"^(gift|toys|variety_store|party)$"]'],
  ["sublimacao", "Lojas de sublimação e personalizados", "Comércio", "sublimação personalizados", '["shop"~"^(gift|copyshop|printing)$"]', '["craft"="printer"]', '["name"~"sublima|personaliz",i]'],
  ["grafica", "Gráficas", "Comércio", "gráfica", '["shop"~"^(copyshop|printing)$"]', '["craft"="printer"]'],
  ["material_construcao", "Materiais de construção e tintas", "Comércio", "material de construção", '["shop"~"^(doityourself|hardware|building_materials|paint|trade)$"]'],
  ["loja_esportes", "Artigos esportivos", "Comércio", "loja de artigos esportivos", '["shop"="sports"]'],
  // Serviços
  ["imobiliaria", "Imobiliárias", "Serviços", "imobiliária", '["office"="estate_agent"]'],
  ["contabilidade", "Escritórios de contabilidade", "Serviços", "escritório de contabilidade", '["office"="accountant"]'],
  ["advocacia", "Escritórios de advocacia", "Serviços", "escritório de advocacia", '["office"="lawyer"]'],
  ["seguros_corretora", "Corretoras de seguros", "Serviços", "corretora de seguros", '["office"="insurance"]'],
  ["arquitetura_engenharia", "Arquitetura, engenharia e construção", "Serviços", "arquitetura engenharia construtora", '["office"~"^(architect|engineer|construction_company)$"]', '["craft"~"^(builder|carpenter|electrician|plumber)$"]'],
  ["ti_software", "Empresas de tecnologia", "Serviços", "empresa de tecnologia software", '["office"~"^(it|software)$"]'],
  ["marketing_publicidade", "Agências de marketing e publicidade", "Serviços", "agência de marketing", '["office"~"^(advertising_agency|marketing)$"]'],
  ["lavanderia", "Lavanderias", "Serviços", "lavanderia", '["shop"="laundry"]'],
  ["chaveiro", "Chaveiros", "Serviços", "chaveiro", '["shop"="locksmith"]', '["craft"="locksmith"]'],
  ["assistencia_tecnica", "Assistência técnica", "Serviços", "assistência técnica", '["shop"="electronics_repair"]', '["craft"="electronics_repair"]'],
  ["costura_ajustes", "Costura e ajustes", "Serviços", "costureira ateliê", '["craft"="tailor"]', '["shop"="tailor"]'],
  ["transporte_mudancas", "Transportadoras e mudanças", "Serviços", "transportadora mudanças", '["office"~"^(logistics|moving_company|courier)$"]'],
  ["fotografia_eventos", "Fotografia, eventos e festas", "Serviços", "fotógrafo buffet eventos", '["craft"="photographer"]', '["shop"="photo"]', '["amenity"="events_venue"]'],
  // Educação, turismo e lazer
  ["escola_cursos", "Escolas e cursos livres", "Educação e lazer", "escola de cursos idiomas", '["amenity"~"^(school|language_school|music_school|training|college)$"]'],
  ["creche", "Creches e educação infantil", "Educação e lazer", "creche escola infantil", '["amenity"="kindergarten"]'],
  ["hotel_pousada", "Hotéis e pousadas", "Educação e lazer", "hotel pousada", '["tourism"~"^(hotel|guest_house|hostel|motel)$"]'],
  ["danca_artes", "Escolas de dança e artes", "Educação e lazer", "escola de dança", '["amenity"="dancing_school"]', '["leisure"="dance"]'],
  ["clube_quadras", "Quadras e centros esportivos", "Educação e lazer", "quadra esportiva", '["leisure"~"^(sports_centre|pitch)$"]'],
  // Geral
  ["prestador_servicos", "Prestadores de serviços", "Geral", "prestador de serviços", '["office"~"^(company|consulting|association|employment_agency)$"]', '["craft"]'],
  ["pme", "Pequenas e médias empresas", "Geral", "empresa", '["shop"]', '["office"]'],
];

export const SEGMENTS: Segment[] = ROWS.map(([value, label, group, query, ...osm]) => ({ value, label, group, query, osm }));
export const SEGMENT_GROUPS = [...new Set(SEGMENTS.map((s) => s.group))];
export type SegmentValue = string;

export function segmentLabel(value: string | null | undefined) {
  return SEGMENTS.find((s) => s.value === value)?.label ?? value ?? "—";
}

/** Características que alimentam o analisador de oportunidades. */
const set = (...v: string[]) => new Set(v);
export const MENU_SEGMENTS = set("restaurante", "pizzaria", "lanchonete_hamburgueria", "padaria", "confeitaria_doces", "cafeteria", "bar_pub", "sorveteria_acai");
export const CATALOG_SEGMENTS = set("loja_roupas", "loja_calcados", "joalheria_relojoaria", "loja_celulares_eletronicos", "moveis_decoracao", "papelaria_livraria", "floricultura", "loja_presentes_brinquedos", "sublimacao", "grafica", "material_construcao", "loja_esportes", "autopecas", "otica", "adega_bebidas");
export const STOCK_SEGMENTS = set("loja_roupas", "loja_calcados", "loja_celulares_eletronicos", "moveis_decoracao", "material_construcao", "autopecas", "mercado_supermercado", "acougue", "hortifruti", "farmacia", "papelaria_livraria", "loja_esportes", "sublimacao", "adega_bebidas");
export const SERVICE_ORDER_SEGMENTS = set("oficina_mecanica", "auto_eletrica", "funilaria_pintura", "borracharia_pneus", "lava_jato", "moto_oficina", "grafica", "assistencia_tecnica", "costura_ajustes", "chaveiro", "arquitetura_engenharia");
/** Segmentos que atendem por horário → serviço sugerido. */
export const APPOINTMENT_SERVICE: Record<string, string> = {
  clinica_odontologica: "sistema_clinica", clinica_medica: "sistema_clinica", fisioterapia_psicologia: "sistema_clinica", laboratorio: "sistema_clinica",
  salao_beleza: "sistema_beleza", barbearia: "sistema_beleza", nail_designer: "sistema_beleza", estetica_spa: "sistema_beleza", tatuagem_piercing: "sistema_beleza",
  academia: "sistema_gestao", pilates_yoga: "sistema_gestao", danca_artes: "sistema_gestao", escola_cursos: "sistema_gestao", auto_escola: "sistema_gestao", veterinaria_petshop: "sistema_gestao",
};
