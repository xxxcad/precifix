import type { PricingHistoryItem } from "@/lib/data/catalog";
import type { Route } from "next";
import type { SortDirection } from "@/lib/data/catalog";
import { formatMoney, formatPercent } from "@/lib/format";
import { SortableColumn } from "./sortable-column";

export function PricingHistoryList({ databaseItems, sort, direction, links }: { databaseItems: PricingHistoryItem[]; sort: string; direction: SortDirection; links: Record<string, Route> }) {
  if (!databaseItems.length) return <div className="empty-inline">Nenhuma precificação encontrada para esta busca.</div>;
  return <div className="data-table">
    <div className="table-row history-list table-head">
      <SortableColumn label="Produto" active={sort === "product"} direction={direction} href={links.product} />
      <SortableColumn label="Marketplace" active={sort === "marketplace"} direction={direction} href={links.marketplace} />
      <SortableColumn label="Preço" active={sort === "price"} direction={direction} href={links.price} />
      <SortableColumn label="Frete" active={sort === "shipping"} direction={direction} href={links.shipping} />
      <SortableColumn label="Margem" active={sort === "margin"} direction={direction} href={links.margin} />
      <SortableColumn label="Data" active={sort === "date"} direction={direction} href={links.date} />
    </div>
    {databaseItems.map((item) => <div className="table-row history-list" key={item.id}>
      <span><strong>{item.sku}</strong><small>{item.productName}</small></span>
      <span>{item.marketplace} · {item.listingType}</span>
      <span>{formatMoney(item.salePrice)}</span>
      <span>{formatMoney(item.shippingCost)}</span>
      <span className="history-margin"><strong>{formatMoney(item.marginValue)}</strong><small>{formatPercent(item.marginPercent)}</small></span>
      <span>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
    </div>)}
  </div>;
}
