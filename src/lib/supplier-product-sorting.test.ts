import { describe, expect, it } from "vitest";
import type { ScenarioMetric, SupplierProductAnalytics } from "./data/supplier-analytics";
import { sortSupplierProducts } from "./supplier-product-sorting";

const metric = (price: number, marginPercent: number, createdAt: string): ScenarioMetric => ({
  price,
  marginPercent,
  createdAt,
  marginValue: price * marginPercent,
  shipping: 0,
  commission: 0,
  fixedFee: 0,
  rebate: 0,
});

const product = (sku: string, scenarios: SupplierProductAnalytics["scenarios"]): SupplierProductAnalytics => ({
  id: sku,
  sku,
  childSkus: [],
  name: `Produto ${sku}`,
  manufacturerCode: null,
  active: true,
  cost: Number(sku),
  pending: false,
  scenarios,
  pricingHistory: [],
});

describe("sortSupplierProducts", () => {
  it("ordena pelos valores do canal selecionado, não pelo cenário mais recente de outro canal", () => {
    const products = [
      product("100", {
        SHOPEE: metric(200, 0.2, "2026-01-01T00:00:00Z"),
        AMAZON: metric(50, 0.05, "2026-09-01T00:00:00Z"),
      }),
      product("200", {
        SHOPEE: metric(100, 0.1, "2026-01-02T00:00:00Z"),
        AMAZON: metric(300, 0.3, "2026-09-02T00:00:00Z"),
      }),
    ];

    expect(sortSupplierProducts(products, "price", "asc", "SHOPEE").map((item) => item.sku)).toEqual(["200", "100"]);
    expect(sortSupplierProducts(products, "marginPercent", "desc", "SHOPEE").map((item) => item.sku)).toEqual(["100", "200"]);
  });

  it("mantém produtos sem dados do canal no fim nas duas direções", () => {
    const products = [
      product("100", {}),
      product("200", { AMAZON: metric(100, 0.1, "2026-01-01T00:00:00Z") }),
      product("300", { AMAZON: metric(200, 0.2, "2026-01-02T00:00:00Z") }),
    ];

    expect(sortSupplierProducts(products, "price", "asc", "AMAZON").map((item) => item.sku)).toEqual(["200", "300", "100"]);
    expect(sortSupplierProducts(products, "price", "desc", "AMAZON").map((item) => item.sku)).toEqual(["300", "200", "100"]);
  });

  it("ordena texto, números, datas e status conforme a direção informada", () => {
    const inactive = { ...product("20", { SHOPEE: metric(80, 0.08, "2026-01-01T00:00:00Z") }), active: false };
    const products = [product("100", { SHOPEE: metric(100, 0.1, "2026-02-01T00:00:00Z") }), inactive];

    expect(sortSupplierProducts(products, "product", "asc", "ALL").map((item) => item.sku)).toEqual(["20", "100"]);
    expect(sortSupplierProducts(products, "cost", "desc", "ALL").map((item) => item.sku)).toEqual(["100", "20"]);
    expect(sortSupplierProducts(products, "date", "asc", "SHOPEE").map((item) => item.sku)).toEqual(["20", "100"]);
    expect(sortSupplierProducts(products, "status", "asc", "ALL").map((item) => item.sku)).toEqual(["100", "20"]);
  });
});
