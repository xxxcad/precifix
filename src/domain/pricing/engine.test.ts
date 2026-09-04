import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateLegacyAmazonEffectiveCost, calculatePricing, calculateTargetPrice, classifyMargin, resolveFeeBand } from "./engine";
import type { FiscalRuleKey, PricingInput } from "./types";
import { marginClassifications } from "@/data/demo-data";

const closeTo = (actual: string, expected: string) => expect(new Decimal(actual).minus(expected).abs().lessThan("0.00000001")).toBe(true);

function input({
  marketplace, rule, cost, st = "0", icmsIn = "0", pis = "0.0165", cofins = "0.076", ipi = "0", sale, rate, fixed = "0", freight = "0", icmsOut = "0",
}: {
  marketplace: "MERCADO_LIVRE" | "SHOPEE" | "AMAZON"; rule: FiscalRuleKey; cost: string; st?: string; icmsIn?: string; pis?: string; cofins?: string; ipi?: string; sale: string; rate: string; fixed?: string; freight?: string; icmsOut?: string;
}): PricingInput {
  return {
    salePrice: sale,
    shippingCost: freight,
    marketplaceRebateType: "VALUE",
    marketplaceRebateValue: "0",
    classifications: marginClassifications,
    product: { productId: "fixture", sku: "fixture", productName: "Fixture Excel", supplierName: "Excel", cost, fiscalRule: rule, stAmount: st, inputIcmsRate: icmsIn, inputPisRate: pis, inputCofinsRate: cofins, inputIpiRate: ipi, outputIcmsRates: { SP: icmsOut, SUL_SUDESTE: icmsOut, NORTE_NORDESTE: icmsOut } },
    marketplaceRule: { marketplace, marketplaceName: marketplace, listingType: "PADRAO", version: 1, shippingRequired: marketplace !== "SHOPEE", feeBands: [{ id: "fixture", label: "Fixture Excel", minPrice: "0", maxPrice: null, percentageRate: rate, fixedFee: fixed, effectiveFrom: "2026-01-01", effectiveTo: null }] },
  };
}

describe("regressão contra PLANILHA DE CUSTO MARKETPLACE.xlsx", () => {
  const fixtures = [
    ["ML Nacional", input({ marketplace:"MERCADO_LIVRE", rule:"NACIONAL", cost:"10.25", icmsIn:"0.18", sale:"26.88", rate:"0.14", freight:"6.85", icmsOut:"0.18" }), "7.6275375", "3.8008625"],
    ["ML Nacional ST", input({ marketplace:"MERCADO_LIVRE", rule:"NACIONAL_ST", cost:"8.93", st:"0.88", sale:"23.49", rate:"0.115", freight:"6.5" }), "8.983975", "5.304675"],
    ["ML Importado", input({ marketplace:"MERCADO_LIVRE", rule:"IMPORTADO", cost:"54", icmsIn:"0.18", sale:"74.21", rate:"0.11", freight:"8.75", icmsOut:"0.18" }), "40.1841", "3.755"],
    ["ML Importado ST", input({ marketplace:"MERCADO_LIVRE", rule:"IMPORTADO_ST", cost:"89", st:"32.7", ipi:"0.065", sale:"175.42", rate:"0.115", freight:"28.45" }), "119.2525", "7.5442"],
    ["ML Isento", input({ marketplace:"MERCADO_LIVRE", rule:"ISENTO", cost:"32.6", pis:"0", cofins:"0", sale:"47.21", rate:"0.12", freight:"6.75" }), "32.6", "2.1948"],
    ["Shopee Nacional", input({ marketplace:"SHOPEE", rule:"NACIONAL", cost:"5.5", icmsIn:"0", sale:"15.9", rate:"0.2", fixed:"4", icmsOut:"0.18" }), "4.99125", "0.86675"],
    ["Shopee Nacional ST", input({ marketplace:"SHOPEE", rule:"NACIONAL_ST", cost:"89", st:"2.72", ipi:"0.065", sale:"119.9", rate:"0.14", fixed:"20" }), "89.2725", "-6.1585"],
    ["Shopee Importado", input({ marketplace:"SHOPEE", rule:"IMPORTADO", cost:"20.4", icmsIn:"0.18", ipi:"0.085", sale:"43.9", rate:"0.2", fixed:"4", icmsOut:"0.18" }), "16.91466", "6.30334"],
    ["Shopee Importado ST", input({ marketplace:"SHOPEE", rule:"IMPORTADO_ST", cost:"18", st:"2.01", ipi:"0.13", sale:"18.9", rate:"0.2", fixed:"4" }), "20.685", "-9.565"],
    ["Shopee Isento", input({ marketplace:"SHOPEE", rule:"ISENTO", cost:"66.99", pis:"0", cofins:"0", sale:"100", rate:"0.14", fixed:"20" }), "66.99", "-0.99"],
    ["Amazon Nacional ST", input({ marketplace:"AMAZON", rule:"NACIONAL_ST", cost:"21.79", st:"2.15", sale:"39.9", rate:"0.13" }), "21.924425", "12.788575"],
    ["Amazon Importado ST", input({ marketplace:"AMAZON", rule:"IMPORTADO_ST", cost:"44.5", st:"16.35", ipi:"0.065", sale:"78.9", rate:"0.115" }), "59.62625", "10.20025"],
    ["Amazon Isento", input({ marketplace:"AMAZON", rule:"ISENTO", cost:"78.37", pis:"0", cofins:"0", sale:"119.96", rate:"0.12", freight:"16.05" }), "78.37", "11.1448"],
  ] as const;

  for (const [name, fixture, expectedCost, expectedMargin] of fixtures) {
    it(name, () => {
      const result = calculatePricing(fixture).regions.SP;
      closeTo(result.effectiveCost, expectedCost);
      closeTo(result.contributionMarginValue, expectedMargin);
    });
  }

  it("isola a base legada incorreta da Amazon sem ST", () => {
    const national = input({ marketplace:"AMAZON", rule:"NACIONAL", cost:"20", icmsIn:"0.18", sale:"29.9", rate:"0.13", icmsOut:"0.18" });
    closeTo(calculateLegacyAmazonEffectiveCost(national), "14.55");
    closeTo(calculatePricing(national).regions.SP.effectiveCost, "14.883");
    const imported = input({ marketplace:"AMAZON", rule:"IMPORTADO", cost:"23.8", icmsIn:"0.04", sale:"44.9", rate:"0.12", freight:"6.05", icmsOut:"0.18" });
    closeTo(calculateLegacyAmazonEffectiveCost(imported), "20.6465");
    closeTo(calculatePricing(imported).regions.SP.effectiveCost, "20.73456");
  });
});

describe("limites configuráveis", () => {
  const bands = [
    { id:"a",label:"a",minPrice:"0",maxPrice:"80",percentageRate:"0.20",fixedFee:"4",effectiveFrom:"2026-01-01",effectiveTo:null },
    { id:"b",label:"b",minPrice:"80",maxPrice:"100",percentageRate:"0.14",fixedFee:"16",effectiveFrom:"2026-01-01",effectiveTo:null },
    { id:"c",label:"c",minPrice:"100",maxPrice:"200",percentageRate:"0.14",fixedFee:"20",effectiveFrom:"2026-01-01",effectiveTo:null },
    { id:"d",label:"d",minPrice:"200",maxPrice:null,percentageRate:"0.14",fixedFee:"26",effectiveFrom:"2026-01-01",effectiveTo:null },
  ];
  it.each([["79.99","4"],["80","16"],["100","20"],["200","26"]])("resolve Shopee em %s", (price, fixed) => expect(resolveFeeBand(price, bands).fixedFee).toBe(fixed));
  it("classifica exatamente 10% como OK", () => expect(classifyMargin("0.10", marginClassifications).label).toBe("OK"));
  it("calcula o menor preço que garante a margem alvo", () => {
    const fixture = input({ marketplace:"MERCADO_LIVRE", rule:"NACIONAL", cost:"25", icmsIn:"0.18", sale:"50", rate:"0.12", freight:"8", icmsOut:"0.18" });
    const targetPrice = calculateTargetPrice(fixture, "SP", "0.10");
    const reached = calculatePricing({ ...fixture, salePrice: targetPrice }).regions.SP.contributionMarginPercent;
    const below = calculatePricing({ ...fixture, salePrice: new Decimal(targetPrice).minus("0.01").toFixed(2) }).regions.SP.contributionMarginPercent;
    expect(new Decimal(reached).greaterThanOrEqualTo("0.10")).toBe(true);
    expect(new Decimal(below).lessThan("0.10")).toBe(true);
  });
  it("desconta rebate em valor somente da comissão", () => {
    const fixture = input({ marketplace:"MERCADO_LIVRE", rule:"ISENTO", cost:"50", sale:"100", rate:"0.12" });
    const result = calculatePricing({ ...fixture, marketplaceRebateType:"VALUE", marketplaceRebateValue:"10" }).regions.SP;
    closeTo(result.marketplacePercentageFee, "12");
    closeTo(result.marketplaceRebate, "10");
    closeTo(result.contributionMarginValue, "48");
  });
  it("converte rebate percentual pelo preço de venda e limita à comissão", () => {
    const fixture = input({ marketplace:"AMAZON", rule:"ISENTO", cost:"50", sale:"100", rate:"0.12" });
    const result = calculatePricing({ ...fixture, marketplaceRebateType:"PERCENT", marketplaceRebateValue:"0.10" }).regions.SP;
    closeTo(result.marketplaceRebate, "10");
    closeTo(result.contributionMarginValue, "48");
    closeTo(calculatePricing({ ...fixture, marketplaceRebateType:"PERCENT", marketplaceRebateValue:"0.50" }).regions.SP.marketplaceRebate, "12");
  });
  it("considera o rebate percentual ao calcular o preço para margem alvo", () => {
    const fixture = input({ marketplace:"MERCADO_LIVRE", rule:"ISENTO", cost:"50", sale:"100", rate:"0.12" });
    const withRebate = { ...fixture, marketplaceRebateType:"PERCENT" as const, marketplaceRebateValue:"0.10" };
    const targetPrice = calculateTargetPrice(withRebate, "SP", "0.10");
    const reached = calculatePricing({ ...withRebate, salePrice:targetPrice }).regions.SP.contributionMarginPercent;
    expect(new Decimal(reached).greaterThanOrEqualTo("0.10")).toBe(true);
  });
});
