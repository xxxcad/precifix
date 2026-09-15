import { describe, expect, it } from "vitest";
import { calculateSupplierAverage, type ScenarioMetric } from "./supplier-analytics";

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
