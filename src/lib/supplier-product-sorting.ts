import type { ScenarioKey, ScenarioMetric, SupplierProductAnalytics } from "@/lib/data/supplier-analytics";

export type SupplierProductSortKey = "product" | "cost" | "price" | "marginValue" | "marginPercent" | "date" | "status";
export type SupplierProductSortDirection = "asc" | "desc";
export type SupplierProductScenario = "ALL" | ScenarioKey;

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function latestMetric(product: SupplierProductAnalytics): ScenarioMetric | undefined {
  return Object.values(product.scenarios).reduce<ScenarioMetric | undefined>((latest, metric) => (
    !latest || metric.createdAt > latest.createdAt ? metric : latest
  ), undefined);
}

function metricForScenario(product: SupplierProductAnalytics, scenario: SupplierProductScenario) {
  return scenario === "ALL" ? latestMetric(product) : product.scenarios[scenario];
}

function compareValues(left: string | number | undefined, right: string | number | undefined, direction: SupplierProductSortDirection) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;

  const result = typeof left === "number"
    ? left - Number(right)
    : collator.compare(left, String(right));

  return result * (direction === "asc" ? 1 : -1);
}

export function sortSupplierProducts(
  products: SupplierProductAnalytics[],
  sort: SupplierProductSortKey,
  direction: SupplierProductSortDirection,
  scenario: SupplierProductScenario,
) {
  return products.toSorted((leftProduct, rightProduct) => {
    const leftMetric = metricForScenario(leftProduct, scenario);
    const rightMetric = metricForScenario(rightProduct, scenario);
    let result = 0;

    switch (sort) {
      case "product":
        result = compareValues(`${leftProduct.sku} ${leftProduct.name}`, `${rightProduct.sku} ${rightProduct.name}`, direction);
        break;
      case "cost":
        result = compareValues(leftProduct.cost, rightProduct.cost, direction);
        break;
      case "price":
        result = compareValues(leftMetric?.price, rightMetric?.price, direction);
        break;
      case "marginValue":
        result = compareValues(leftMetric?.marginValue, rightMetric?.marginValue, direction);
        break;
      case "marginPercent":
        result = compareValues(leftMetric?.marginPercent, rightMetric?.marginPercent, direction);
        break;
      case "date":
        result = compareValues(leftMetric?.createdAt, rightMetric?.createdAt, direction);
        break;
      case "status":
        result = compareValues(leftProduct.active ? "Ativo" : "Extinto", rightProduct.active ? "Ativo" : "Extinto", direction);
        break;
    }

    return result || collator.compare(leftProduct.sku, rightProduct.sku);
  });
}
