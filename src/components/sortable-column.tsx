import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDirection } from "@/lib/data/catalog";

export function SortableColumn({ label, href, active, direction }: { label: string; href: Route; active: boolean; direction: SortDirection }) {
  const Icon = active ? direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  const nextDescription = active ? direction === "asc" ? "decrescente" : "crescente" : "ordenar";
  return <span role="columnheader" aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
    <Link className={`sort-column ${active ? "active" : ""}`} href={href} title={`${label}: ${nextDescription}`}>
      <span>{label}</span><Icon size={13} aria-hidden="true" />
    </Link>
  </span>;
}
