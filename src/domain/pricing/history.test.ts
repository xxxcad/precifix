import { describe, expect, it } from "vitest";
import { storedPricingToHistory } from "./history";

describe("storedPricingToHistory", () => {
  it("reconstrói o snapshot compartilhado usando a região salva", () => {
    const item = storedPricingToHistory({
      id: "history-1", created_at: "2026-09-15T12:00:00Z", marketplace_id: "marketplace-1", listing_type: "PREMIUM", sale_price: 100, shipping_cost: 12,
      input_snapshot: { marketplaceRebateType: "PERCENT", marketplaceRebateValue: "0.1", product: { sku: "123", productName: "Produto" } },
      rule_snapshot: { calculationVersion: "recommended-v2", selectedRegion: "SUL_SUDESTE", feeBand: { percentageRate: "0.17" } },
      results: { SUL_SUDESTE: { contributionMarginValue: "20", contributionMarginPercent: "0.2", marketplaceRebate: "10" } },
    }, "Mercado Livre", "Caio");
    expect(item).toMatchObject({ sku: "123", marketplace: "Mercado Livre", listingType: "PREMIUM", region: "SUL_SUDESTE", marginValue: "20", marginPercent: "0.2", rebateType: "PERCENT", rebateValue: "0.1", appliedRebate: "10", practicedRate: "0.17", createdByName: "Caio" });
  });

  it("usa os rótulos seguros para uma simulação manual", () => {
    const item = storedPricingToHistory({
      id: "history-2", created_at: "2026-09-15T12:00:00Z", marketplace_id: "marketplace-2", listing_type: "PADRAO", sale_price: 50, shipping_cost: 0,
      input_snapshot: {}, rule_snapshot: { feeBand: { percentageRate: "0.14" } }, results: {},
    }, "Shopee", "Usuário");
    expect(item).toMatchObject({ sku: "MANUAL", productName: "Produto manual", region: "SP", marginValue: "0", marginPercent: "0" });
  });
});
