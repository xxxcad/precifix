export type FiscalRuleKey =
  | "NACIONAL"
  | "NACIONAL_ST"
  | "IMPORTADO"
  | "IMPORTADO_ST"
  | "ISENTO";

export type MarketplaceKey = "MERCADO_LIVRE" | "SHOPEE" | "AMAZON";
export type ListingType = "CLASSICO" | "PREMIUM" | "PADRAO";
export type RegionKey = "SP" | "SUL_SUDESTE" | "NORTE_NORDESTE";

export interface ProductFiscalSnapshot {
  productId: string;
  sku: string;
  productName: string;
  supplierName: string;
  cost: string;
  fiscalRule: FiscalRuleKey;
  stAmount: string;
  inputIcmsRate: string;
  inputPisRate: string;
  inputCofinsRate: string;
  inputIpiRate: string;
  outputIcmsRates: Record<RegionKey, string>;
  packageWeightKg?: string | null;
  packageHeightCm?: string | null;
  packageWidthCm?: string | null;
  packageLengthCm?: string | null;
  cubicWeightKg?: string | null;
}

export interface ShippingPriceBand { id: string; label: string; maxPrice: string | null; sortOrder: number }
export interface ShippingWeightBand { id: string; label: string; maxWeightKg: string | null; sortOrder: number }
export interface ShippingRate { id: string; priceBandId: string; weightBandId: string; cost: string }
export interface ShippingAdditionalKgRate { id: string; priceBandId: string; costPerKg: string }
export interface MarketplaceShippingRule {
  id: string; version: number; sourceUrl: string; effectiveFrom: string; marketplace: MarketplaceKey;
  priceBands: ShippingPriceBand[]; weightBands: ShippingWeightBand[]; rates: ShippingRate[];
  additionalKgRates?: ShippingAdditionalKgRate[];
}
export interface ShippingResolution {
  source: "AUTOMATIC" | "MANUAL" | "MANUAL_OVERRIDE";
  cost: string; calculatedCost: string | null; ruleSetId: string | null; version: number | null;
  priceBandId: string | null; priceBandLabel: string | null; weightBandId: string | null; weightBandLabel: string | null;
  billableWeightKg: string | null; weightBasis: "REAL" | "CUBIC" | null;
}

export interface FeeBand {
  id: string;
  label: string;
  minPrice: string;
  maxPrice: string | null;
  percentageRate: string;
  fixedFee: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface MarketplaceRuleSnapshot {
  marketplace: MarketplaceKey;
  marketplaceName: string;
  listingType: ListingType;
  version: number;
  shippingRequired: boolean;
  feeBands: FeeBand[];
}

export interface MarginClassificationRule {
  id: string;
  label: "RUIM" | "ATENÇÃO" | "ACEITÁVEL" | "OK";
  minPercent: string | null;
  maxPercent: string | null;
  tone: "danger" | "warning" | "acceptable" | "success";
}

export interface PricingInput {
  salePrice: string;
  shippingCost: string;
  marketplaceRebateType: "VALUE" | "PERCENT";
  marketplaceRebateValue: string;
  product: ProductFiscalSnapshot;
  marketplaceRule: MarketplaceRuleSnapshot;
  classifications: MarginClassificationRule[];
  shippingResolution?: ShippingResolution;
}

export interface CalculationLine {
  key: string;
  label: string;
  category: "revenue" | "fee" | "shipping" | "tax" | "cost" | "margin" | "credit";
  value: string;
  rate?: string;
  explanation: string;
}

export interface RegionPricingResult {
  region: RegionKey;
  salePrice: string;
  productCost: string;
  effectiveCost: string;
  inputIcmsCredit: string;
  inputPisCredit: string;
  inputCofinsCredit: string;
  inputIpiValue: string;
  marketplacePercentageFee: string;
  marketplaceRebate: string;
  marketplaceFixedFee: string;
  shippingCost: string;
  outputIcms: string;
  netRevenue: string;
  contributionMarginValue: string;
  contributionMarginPercent: string;
  classification: MarginClassificationRule;
  breakdown: CalculationLine[];
}

export interface PricingResult {
  calculationVersion: "recommended-v2";
  feeBand: FeeBand;
  regions: Record<RegionKey, RegionPricingResult>;
  snapshot: PricingInput;
}
