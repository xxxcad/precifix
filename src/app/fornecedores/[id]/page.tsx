import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SupplierAnalyticsView, type SupplierAnalyticsFilters } from "@/components/supplier-analytics";
import { loadSupplierAnalytics, type AnalyticsRegion } from "@/lib/data/supplier-analytics";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const region = (["SP", "SUL_SUDESTE", "NORTE_NORDESTE"].includes(search.region ?? "") ? search.region : "SP") as AnalyticsRegion;
  const filters: SupplierAnalyticsFilters = {
    region, query: search.query ?? "", includeInactive: search.inactive === "1",
    scenario: (["ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"].includes(search.scenario ?? "") ? search.scenario : "ALL") as SupplierAnalyticsFilters["scenario"],
    coverage: (["WITH", "WITHOUT"].includes(search.coverage ?? "") ? search.coverage : "ALL") as SupplierAnalyticsFilters["coverage"],
    pending: (["YES", "NO"].includes(search.pending ?? "") ? search.pending : "ALL") as SupplierAnalyticsFilters["pending"],
    period: (["7", "30", "60", "90", "CUSTOM"].includes(search.period ?? "") ? search.period : "ALL") as SupplierAnalyticsFilters["period"],
    dateFrom: search.from ?? "", dateTo: search.to ?? "",
    margin: (["BAD", "ACCEPTABLE"].includes(search.margin ?? "") ? search.margin : "ALL") as SupplierAnalyticsFilters["margin"],
    sort: (["product", "cost", "price", "marginValue", "marginPercent", "date", "status"].includes(search.sort ?? "") ? search.sort : "product") as SupplierAnalyticsFilters["sort"],
    direction: search.direction === "desc" ? "desc" : "asc", page: Math.max(1, Number(search.page) || 1),
  };
  const supabase = await createClient();
  const [{ data: supplier }, analytics] = await Promise.all([supabase.from("suppliers").select("id,name").eq("id", id).maybeSingle(), loadSupplierAnalytics(id, region)]);
  if (!supplier || !analytics) notFound();
  return <><PageHeader eyebrow="Análise de fornecedor" title={supplier.name} description="Margens calculadas pelas últimas precificações salvas." /><SupplierAnalyticsView key={region} supplier={supplier} analytics={analytics} filters={filters} /></>;
}
