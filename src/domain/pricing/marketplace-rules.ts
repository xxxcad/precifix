import { getMarketplaceRule, type DemoProduct } from "@/data/demo-data";
import type { ListingType, MarketplaceKey, MarketplaceRuleSnapshot } from "./types";

export type MarketplaceRuleMap = Partial<Record<`${MarketplaceKey}:${ListingType}`, MarketplaceRuleSnapshot>>;

export function resolveMarketplaceRule(product: DemoProduct, marketplace: MarketplaceKey, premium: boolean, rules: MarketplaceRuleMap) {
  const listingType: ListingType = marketplace === "MERCADO_LIVRE" ? (premium ? "PREMIUM" : "CLASSICO") : "PADRAO";
  const base = rules[`${marketplace}:${listingType}`] ?? getMarketplaceRule(product, marketplace, premium);
  if (marketplace === "SHOPEE") return base;
  const productRate = premium ? product.marketplace[marketplace].premiumPercentageRate ?? product.marketplace[marketplace].percentageRate : product.marketplace[marketplace].percentageRate;
  return { ...base, feeBands: base.feeBands.map((band) => ({ ...band, percentageRate: productRate })) };
}
