import type { LucideIcon } from "lucide-react";
import { Boxes, Building2, Calculator, Clock3, Database, Gauge, Landmark, RefreshCcw, ReceiptText, Settings2, ShieldCheck, Users } from "lucide-react";

export type NavigationRole = "viewer" | "analyst" | "admin";
export type NavigationItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; roles?: readonly NavigationRole[] };
export type NavigationGroup = { id: "pricing" | "registrations" | "admin"; label: string; icon: LucideIcon; items: readonly NavigationItem[]; roles?: readonly NavigationRole[] };

export const navigationGroups: readonly NavigationGroup[] = [
  { id: "pricing", label: "Precificação", icon: Calculator, items: [
    { href: "/", label: "Dashboard", icon: Gauge, exact: true },
    { href: "/precificar", label: "Precificar", icon: Calculator },
    { href: "/marketplaces", label: "Marketplaces", icon: Landmark },
    { href: "/regras-fiscais", label: "Regras Fiscais", icon: ReceiptText },
    { href: "/historico", label: "Histórico", icon: Clock3 },
    { href: "/reprecificacao", label: "Reprecificação", icon: RefreshCcw },
    { href: "/configuracoes", label: "Configurações", icon: Settings2, exact: true },
  ] },
  { id: "registrations", label: "Cadastros", icon: Database, items: [
    { href: "/produtos", label: "Produtos", icon: Boxes },
    { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  ] },
  { id: "admin", label: "Admin", icon: ShieldCheck, roles: ["admin"], items: [
    { href: "/admin/usuarios", label: "Usuários", icon: Users, roles: ["admin"] },
  ] },
];

export function isNavigationItemActive(pathname: string, item: NavigationItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function canSeeNavigationEntry(roles: readonly NavigationRole[] | undefined, role: string | undefined) {
  return !roles || (role != null && roles.includes(role as NavigationRole));
}
