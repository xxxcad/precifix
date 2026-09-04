import type { PricingHistoryItem } from "@/lib/data/catalog";
import { formatMoney, formatPercent } from "@/lib/format";

export function PricingHistoryList({ databaseItems }: { databaseItems: PricingHistoryItem[] }) {
  if (!databaseItems.length) return <div className="empty-inline">Nenhuma precificação encontrada para esta busca.</div>;
  return <div className="data-table"><div className="table-row history-list table-head"><span>Produto</span><span>Marketplace</span><span>Preço</span><span>Frete</span><span>Margem</span><span>Data</span></div>{databaseItems.map((item) => <div className="table-row history-list" key={item.id}><span><strong>{item.sku}</strong><small>{item.productName}</small></span><span>{item.marketplace} · {item.listingType}</span><span>{formatMoney(item.salePrice)}</span><span>{formatMoney(item.shippingCost)}</span><span className="history-margin"><strong>{formatMoney(item.marginValue)}</strong><small>{formatPercent(item.marginPercent)}</small></span><span>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>)}</div>;
}
