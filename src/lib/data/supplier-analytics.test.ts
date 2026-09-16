import { describe, expect, it } from "vitest";
import { calculateProductScenarioAverage, calculateSupplierAverage, type ScenarioMetric, type SupplierProductAnalytics } from "./supplier-analytics";

const metric = (price: number, marginValue: number, marginPercent: number): ScenarioMetric => ({
  price,
  marginValue,
  marginPercent,
  shipping: 0,
  createdAt: "2026-09-15T12:00:00Z",
  commission: 0,
  fixedFee: 0,
  rebate: 0,
});

describe("calculateSupplierAverage", () => {
  it("calcula margem e ticket médio pelas precificações mais recentes", () => {
    expect(calculateSupplierAverage([metric(100, 10, .1), metric(200, 30, .15)])).toEqual({
      value: 20,
      percent: .125,
      ticket: 150,
      count: 2,
    });
  });

  it("não cria médias sem precificações", () => {
    expect(calculateSupplierAverage([])).toBeUndefined();
  });
});

describe("calculateProductScenarioAverage", () => {
  const product = (scenarios: SupplierProductAnalytics["scenarios"]): SupplierProductAnalytics => ({
    id: "produto-1",
    sku: "100",
    childSkus: [],
    name: "Produto",
    manufacturerCode: null,
    active: true,
    cost: 10,
    pending: false,
    scenarios,
    pricingHistory: [],
  });

  it("calcula a média em reais e percentual das quatro modalidades", () => {
    const item = product({
      ML_CLASSICO: metric(100, 10, .1),
      ML_PREMIUM: metric(100, 20, .2),
      SHOPEE: metric(100, 30, .3),
      AMAZON: metric(100, 40, .4),
    });

    expect(calculateProductScenarioAverage(item)).toMatchObject({
      product: item,
      averageValue: 25,
      averagePercent: .25,
    });
  });

  it("calcula a média usando somente os canais disponíveis", () => {
    expect(calculateProductScenarioAverage(product({
      ML_CLASSICO: metric(100, 10, .1),
      SHOPEE: metric(100, 30, .3),
      AMAZON: metric(100, 40, .4),
    }))).toMatchObject({ averageValue: 80 / 3, averagePercent: .8 / 3 });
  });
});
