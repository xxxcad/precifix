import { HistoryPage } from "@/components/entity-pages";
import { loadCostChangeHistory, loadNewProductHistory } from "@/lib/data/catalog";

const pageNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const direction = (value: string | undefined) => value === "asc" ? "asc" as const : "desc" as const;
const sortValue = (value: string | undefined, allowed: string[], fallback: string) => value && allowed.includes(value) ? value : fallback;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const search = {
    costQuery: String(params.costQuery ?? "").trim(),
    productQuery: String(params.productQuery ?? "").trim(),
    costPage: pageNumber(params.costPage),
    productPage: pageNumber(params.productPage),
    costSort: sortValue(params.costSort, ["product", "oldCost", "newCost", "difference", "changedBy", "date"], "date"),
    costDirection: direction(params.costDirection),
    productSort: sortValue(params.productSort, ["product", "supplier", "status", "date"], "date"),
    productDirection: direction(params.productDirection),
  };
  const [costHistory, productHistory] = await Promise.all([
    loadCostChangeHistory({ query: search.costQuery, page: search.costPage, pageSize: 20, sort: search.costSort, direction: search.costDirection }),
    loadNewProductHistory({ query: search.productQuery, page: search.productPage, pageSize: 20, sort: search.productSort, direction: search.productDirection }),
  ]);
  return <HistoryPage costHistory={costHistory} productHistory={productHistory} search={search} />;
}
