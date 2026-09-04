"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Building2,
  Calculator,
  ChevronRight,
  Clock3,
  Gauge,
  Landmark,
  LogOut,
  PanelLeftClose,
  RefreshCcw,
  ReceiptText,
  Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/app/auth/actions";

const navigation = [
  { href: "/", label: "Início", icon: Gauge },
  { href: "/precificar", label: "Precificar", icon: Calculator },
  { href: "/produtos", label: "Produtos", icon: Boxes },
  { href: "/fornecedores", label: "Fornecedores", icon: Building2 },
  { href: "/marketplaces", label: "Marketplaces", icon: Landmark },
  { href: "/regras-fiscais", label: "Regras Fiscais", icon: ReceiptText },
  { href: "/historico", label: "Histórico", icon: Clock3 },
  { href: "/reprecificacao", label: "Reprecificação", icon: RefreshCcw },
  { href: "/configuracoes", label: "Configurações", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return children;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div><strong>Precifix</strong></div>
        </div>
        <nav aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link className={`nav-item ${active ? "active" : ""}`} href={href as Route} key={href}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <ChevronRight className="nav-arrow" size={15} />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <PanelLeftClose size={16} />
          <span>Ambiente interno</span>
          <form action={logout}><button aria-label="Sair" title="Sair" type="submit"><LogOut size={15} /></button></form>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
