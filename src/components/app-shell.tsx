"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProfileMenu, type ShellProfile } from "@/components/profile-menu";
import { canSeeNavigationEntry, isNavigationItemActive, navigationGroups } from "@/components/navigation-config";

const STORAGE_KEY = "precifix:open-navigation-groups";

export function AppShell({ children, profile }: { children: ReactNode; profile: ShellProfile | null }) {
  const pathname = usePathname();
  const role = profile?.role;
  const visibleGroups = useMemo(() => navigationGroups
    .filter((group) => canSeeNavigationEntry(group.roles, role))
    .map((group) => ({ ...group, items: group.items.filter((item) => canSeeNavigationEntry(item.roles, role)) }))
    .filter((group) => group.items.length > 0), [role]);
  const activeGroupIds = visibleGroups
    .filter((group) => group.items.some((item) => isNavigationItemActive(pathname, item)))
    .map((group) => group.id);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroupIds));
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        // Hydrate the user preference after mount; localStorage is unavailable during SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenGroups((current) => new Set([...current, ...saved.filter((value): value is string => typeof value === "string")]));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);

  if (pathname.startsWith("/login")) return children;

  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="app-shell">
      <header className="mobile-shell-header">
        <div className="brand mobile-brand"><span className="brand-mark">P</span><strong>Precifix</strong></div>
        <button ref={menuButtonRef} className="mobile-menu-button" type="button" aria-label="Abrir menu principal" aria-controls="primary-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
      </header>
      {mobileOpen ? <button className="mobile-sidebar-backdrop" type="button" aria-label="Fechar menu principal" onClick={() => setMobileOpen(false)} /> : null}
      <aside ref={sidebarRef} id="primary-sidebar" className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Menu principal">
        <div className="sidebar-brand-row">
          <div className="brand"><span className="brand-mark">P</span><div><strong>Precifix</strong></div></div>
          <button ref={closeButtonRef} className="mobile-menu-close" type="button" aria-label="Fechar menu principal" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav aria-label="Navegação principal" className="grouped-navigation">
          {visibleGroups.map((group) => {
            const groupActive = group.items.some((item) => isNavigationItemActive(pathname, item));
            const expanded = openGroups.has(group.id) || groupActive;
            const GroupIcon = group.icon;
            const regionId = `navigation-group-${group.id}`;
            return <section className={`navigation-group ${groupActive ? "active" : ""}`} key={group.id}>
              <button className="navigation-group-toggle" type="button" aria-expanded={expanded} aria-controls={regionId} onClick={() => toggleGroup(group.id)}>
                <GroupIcon size={17} strokeWidth={1.8} />
                <span>{group.label}</span>
                <ChevronDown className="navigation-group-chevron" size={16} />
              </button>
              <div id={regionId} className="navigation-group-items" hidden={!expanded}>
                {group.items.map((item) => {
                  const active = isNavigationItemActive(pathname, item);
                  const Icon = item.icon;
                  return <Link className={`nav-item ${active ? "active" : ""}`} href={item.href as Route} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} key={item.href}>
                    <Icon size={16} strokeWidth={1.8} /><span>{item.label}</span>
                  </Link>;
                })}
              </div>
            </section>;
          })}
        </nav>
        <div className="sidebar-foot"><ProfileMenu profile={profile} /></div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
