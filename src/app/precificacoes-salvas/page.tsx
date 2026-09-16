import { PageHeader } from "@/components/page-header";
import { SavedPricingAnalyticsView } from "@/components/saved-pricing-analytics";
import { loadSavedPricingAnalytics, type SavedPricingFilters } from "@/lib/data/saved-pricing-analytics";

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

export default async function SavedPricingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const search = await searchParams;
  const filters: SavedPricingFilters = {
    query: search.query?.trim() ?? "", supplierId: search.supplier ?? "", status: oneOf(search.status, ["ACTIVE", "INACTIVE", "ALL"] as const, "ACTIVE"),
    scenario: oneOf(search.scenario, ["ALL", "ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"] as const, "ALL"), coverage: oneOf(search.coverage, ["ALL", "WITH", "WITHOUT", "COMPLETE"] as const, "ALL"),
    margin: oneOf(search.margin, ["ALL", "BELOW", "ACCEPTABLE"] as const, "ALL"), pending: oneOf(search.pending, ["ALL", "YES", "NO"] as const, "ALL"), creatorId: search.creator ?? "",
    region: oneOf(search.region, ["SP", "SUL_SUDESTE", "NORTE_NORDESTE"] as const, "SP"), period: oneOf(search.period, ["ALL", "7", "30", "60", "90", "CUSTOM"] as const, "ALL"),
    dateFrom: search.from ?? "", dateTo: search.to ?? "", sort: oneOf(search.sort, ["product", "supplier", "status", "channels", "ticket", "marginValue", "marginPercent", "date"] as const, "product"),
    direction: search.direction === "desc" ? "desc" : "asc", page: Math.max(1, Number(search.page) || 1),
  };
  const analytics = await loadSavedPricingAnalytics(filters);
  return <><PageHeader eyebrow="Análise geral" title="Precificações salvas" description="Visão consolidada das últimas precificações compartilhadas por produto e canal." /><SavedPricingAnalyticsView analytics={analytics} filters={filters} /></>;
}
