import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { PageHeader } from "@/components/page-header";
import { ProductPricingHistory } from "@/components/product-pricing-history";
import { createClient } from "@/lib/supabase/server";
import { loadProductPricingHistoryPage, type PricingRegion, type PricingScenario, type ProductPricingHistoryFilters } from "@/lib/data/saved-pricing-analytics";

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

export default async function ProductPricingHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id,sku,name").eq("id", id).maybeSingle();
  if (!product) notFound();
  const filters: ProductPricingHistoryFilters = {
    scenario: oneOf(search.scenario, ["ALL", "ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"] as const, "ALL") as "ALL" | PricingScenario,
    region: oneOf(search.region, ["ALL", "SP", "SUL_SUDESTE", "NORTE_NORDESTE"] as const, "ALL") as "ALL" | PricingRegion,
    creatorId: search.creator ?? "", period: oneOf(search.period, ["ALL", "7", "30", "60", "90", "CUSTOM"] as const, "ALL"), dateFrom: search.from ?? "", dateTo: search.to ?? "",
    sort: oneOf(search.sort, ["date", "channel", "price", "shipping", "marginValue", "marginPercent", "creator"] as const, "date"), direction: search.direction === "asc" ? "asc" : "desc", page: Math.max(1, Number(search.page) || 1),
  };
  const result = await loadProductPricingHistoryPage(id, filters);
  return <>
    <BackButton />
    <PageHeader eyebrow="Produto" title={`${product.sku} · ${product.name}`} description="Histórico compartilhado de todas as precificações salvas." actions={<div className="page-action-row"><Link className="secondary-button" href={`/produtos/${id}/historico` as Route}>Histórico de custo</Link><Link className="secondary-button" href={`/produtos/${id}/editar` as Route}>Editar produto</Link><Link className="primary-button" href={`/precificar?produto=${id}` as Route}>Precificar</Link></div>} />
    <ProductPricingHistory result={result} filters={filters} />
  </>;
}
