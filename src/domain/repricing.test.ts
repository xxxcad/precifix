import { describe, expect, it } from "vitest";
import { repricingTypeLabel } from "./repricing";

describe("repricingTypeLabel", () => {
  it.each([
    ["PRODUCT_COST_CHANGE", "Custo"],
    ["PRODUCT_FIXED_PRICE_CHANGE", "Preço tabelado"],
    ["PRODUCT_TAX_CHANGE", "Fiscal"],
    ["PRODUCT_MARKETPLACE_COMMISSION_CHANGE", "Comissão/Tarifa"],
    ["PRODUCT_PACKAGING_CHANGE", "Frete/Embalagem"],
    ["PRODUCT_CHANGE", "Cadastro/Status"],
    ["UNRECOGNIZED_SOURCE", "Outros"],
  ])("maps %s to %s", (sourceType, expected) => {
    expect(repricingTypeLabel(sourceType)).toBe(expected);
  });
});
