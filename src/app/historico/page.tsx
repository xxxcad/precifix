import { HistoryPage } from "@/components/entity-pages";
import { loadCostChangeHistory, loadNewProductHistory, loadPricingHistory } from "@/lib/data/catalog";

const pageNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ costQuery?: string; productQuery?: string; pricingQuery?: string; costPage?: string; productPage?: string; pricingPage?: string }> }) {
  const params = await searchParams;
  const search = { costQuery: String(params.costQuery ?? "").trim(), productQuery: String(params.productQuery ?? "").trim(), pricingQuery: String(params.pricingQuery ?? "").trim(), costPage: pageNumber(params.costPage), productPage: pageNumber(params.productPage), pricingPage: pageNumber(params.pricingPage) };
  const [costHistory, productHistory, pricingHistory] = await Promise.all([
    loadCostChangeHistory({ query: search.costQuery, page: search.costPage, pageSize: 20 }),
    loadNewProductHistory({ query: search.productQuery, page: search.productPage, pageSize: 20 }),
    loadPricingHistory({ query: search.pricingQuery, page: search.pricingPage, pageSize: 20 }),
  ]);
  return <HistoryPage costHistory={costHistory} productHistory={productHistory} pricingHistory={pricingHistory} search={search} />;
}
