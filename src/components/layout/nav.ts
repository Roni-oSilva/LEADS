import { BarChart3, Kanban, LayoutDashboard, ListChecks, Megaphone, Plug, ScanSearch, Search, Settings, FileSpreadsheet, ClipboardList, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/encontrar-leads", label: "Encontrar Leads", icon: Search },
  { href: "/oportunidades", label: "Oportunidades Digitais", icon: ScanSearch },
  { href: "/crm", label: "Meu CRM", icon: Users },
  { href: "/funil", label: "Funil de Vendas", icon: Kanban },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/formularios", label: "Formulários", icon: ClipboardList },
  { href: "/tarefas", label: "Tarefas e Retornos", icon: ListChecks },
  { href: "/importar-exportar", label: "Importar e Exportar", icon: FileSpreadsheet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

/** Itens exibidos na barra inferior do celular; o restante fica em "Mais". */
export const MOBILE_PRIMARY = ["/dashboard", "/encontrar-leads", "/crm", "/funil"];
