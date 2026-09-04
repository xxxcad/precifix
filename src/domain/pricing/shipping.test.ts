import { describe, expect, it } from "vitest";
import { resolveAmazonShipping, resolveMercadoLivreShipping } from "./shipping";
import type { MarketplaceShippingRule } from "./types";

const rule: MarketplaceShippingRule = {
  id: "rule", version: 1, sourceUrl: "source", effectiveFrom: "2026-09-03", marketplace: "MERCADO_LIVRE",
  priceBands: [{ id: "p1", label: "Até 18,99", maxPrice: "18.99", sortOrder: 1 }, { id: "p2", label: "A partir de 19", maxPrice: null, sortOrder: 2 }],
  weightBands: [{ id: "w1", label: "Até 0,3 kg", maxWeightKg: "0.3", sortOrder: 1 }, { id: "w2", label: "Mais de 0,3 kg", maxWeightKg: null, sortOrder: 2 }],
  rates: [{ id: "r1", priceBandId: "p1", weightBandId: "w1", cost: "5.65" }, { id: "r2", priceBandId: "p2", weightBandId: "w1", cost: "6.85" }, { id: "r3", priceBandId: "p1", weightBandId: "w2", cost: "8" }, { id: "r4", priceBandId: "p2", weightBandId: "w2", cost: "9" }],
};

describe("resolveMercadoLivreShipping", () => {
  it("usa os limites inclusivos de preço e peso", () => expect(resolveMercadoLivreShipping("18.99", "0.3", "0.2", rule).cost).toBe("5.65"));
  it("muda de faixa quando o peso real supera o limite", () => expect(resolveMercadoLivreShipping("19", "0.3001", "0.2", rule).cost).toBe("9"));
  it("usa o peso cubado quando ele é maior que o peso real", () => {
    const result = resolveMercadoLivreShipping("19", "0.2", "0.3001", rule);
    expect(result.cost).toBe("9"); expect(result.billableWeightKg).toBe("0.3001"); expect(result.weightBasis).toBe("CUBIC");
  });
  it("usa o peso real em caso de empate", () => expect(resolveMercadoLivreShipping("19", "0.3", "0.3", rule).weightBasis).toBe("REAL"));
  it("limita produtos abaixo de R$ 19 à metade do preço", () => expect(resolveMercadoLivreShipping("10", "0.3", "0.2", rule).cost).toBe("5"));
  it("resolve todos os limites exatos de uma matriz 30 × 8, incluindo acima de 150 kg e a partir de R$ 200", () => {
    const priceBands = [18.99, 48.99, 78.99, 99.99, 119.99, 149.99, 199.99, null].map((max, index) => ({ id: `p${index}`, label: `Preço ${index}`, maxPrice: max === null ? null : String(max), sortOrder: index + 1 }));
    const limits = [0.3, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, null];
    const weightBands = limits.map((max, index) => ({ id: `w${index}`, label: `Peso ${index}`, maxWeightKg: max === null ? null : String(max), sortOrder: index + 1 }));
    const fullRule: MarketplaceShippingRule = { ...rule, priceBands, weightBands, rates: weightBands.flatMap((weight, wi) => priceBands.map((price, pi) => ({ id: `r${wi}-${pi}`, priceBandId: price.id, weightBandId: weight.id, cost: String(20 + wi * 8 + pi) }))) };
    for (let wi = 0; wi < weightBands.length; wi += 1) for (let pi = 0; pi < priceBands.length; pi += 1) {
      const price = priceBands[pi].maxPrice ?? "200";
      const weight = weightBands[wi].maxWeightKg ?? "150.001";
      const result = resolveMercadoLivreShipping(price, weight, "0.1", fullRule);
      expect(result.priceBandId).toBe(`p${pi}`);
      expect(result.weightBandId).toBe(`w${wi}`);
    }
  });
});

describe("resolveAmazonShipping", () => {
  const amazonRule: MarketplaceShippingRule = {
    ...rule, marketplace: "AMAZON",
    priceBands: [{ id: "p1", label: "Até 29,99", maxPrice: "29.99", sortOrder: 1 }, { id: "p2", label: "A partir de 30", maxPrice: null, sortOrder: 2 }],
    weightBands: [{ id: "w1", label: "Até 0,1 kg", maxWeightKg: "0.1", sortOrder: 1 }, { id: "w2", label: "De 9 a 10 kg", maxWeightKg: "10", sortOrder: 2 }],
    rates: [{ id: "a1", priceBandId: "p1", weightBandId: "w1", cost: "5.65" }, { id: "a2", priceBandId: "p2", weightBandId: "w1", cost: "6" }, { id: "a3", priceBandId: "p1", weightBandId: "w2", cost: "5.65" }, { id: "a4", priceBandId: "p2", weightBandId: "w2", cost: "6" }],
    additionalKgRates: [{ id: "k1", priceBandId: "p1", costPerKg: "1.5" }, { id: "k2", priceBandId: "p2", costPerKg: "2" }],
  };
  it("usa o maior entre peso real e cubado", () => expect(resolveAmazonShipping("30", "0.05", "0.1", amazonRule).weightBasis).toBe("CUBIC"));
  it("seleciona as faixas pelos limites inclusivos", () => expect(resolveAmazonShipping("29.99", "0.1", "0.05", amazonRule).cost).toBe("5.65"));
  it("soma cada quilo adicional, arredondado para cima, acima de 10 kg", () => {
    const result = resolveAmazonShipping("30", "11.01", "1", amazonRule);
    expect(result.cost).toBe("10");
    expect(result.weightBandLabel).toContain("2 kg adicional");
  });
});
