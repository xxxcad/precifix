import type {
  MarginClassificationRule,
  MarketplaceKey,
  MarketplaceRuleSnapshot,
  ProductFiscalSnapshot,
} from "@/domain/pricing/types";

export interface DemoProduct extends ProductFiscalSnapshot {
  manufacturerCode: string;
  active: boolean;
  hasFixedPrice?: boolean;
  fixedPrice?: string | null;
  marketplace: Record<MarketplaceKey, { percentageRate: string; premiumPercentageRate?: string; freight: string; currentPrice: string; usesCommissionOverride?: boolean; usesPremiumCommissionOverride?: boolean }>;
  updatedAt: string;
}

export const marginClassifications: MarginClassificationRule[] = [
  { id: "bad", label: "RUIM", minPercent: null, maxPercent: "0.05", tone: "danger" },
  { id: "attention", label: "ATENÇÃO", minPercent: "0.05", maxPercent: "0.09", tone: "warning" },
  { id: "acceptable", label: "ACEITÁVEL", minPercent: "0.09", maxPercent: "0.10", tone: "acceptable" },
  { id: "ok", label: "OK", minPercent: "0.10", maxPercent: null, tone: "success" },
];

export const products: DemoProduct[] = [
  {
    productId: "1190",
    sku: "1190",
    manufacturerCode: "6604",
    productName: "Varal Aço Branco",
    supplierName: "Maxeb",
    cost: "65.43",
    fiscalRule: "NACIONAL",
    stAmount: "0",
    inputIcmsRate: "0.18",
    inputPisRate: "0.0165",
    inputCofinsRate: "0.076",
    inputIpiRate: "0.065",
    outputIcmsRates: { SP: "0.18", SUL_SUDESTE: "0.12", NORTE_NORDESTE: "0.07" },
    marketplace: {
      MERCADO_LIVRE: { percentageRate: "0.115", freight: "20.75", currentPrice: "119.90" },
      SHOPEE: { percentageRate: "0.14", freight: "0", currentPrice: "119.90" },
      AMAZON: { percentageRate: "0.12", freight: "20.75", currentPrice: "119.90" },
    },
    active: true,
    updatedAt: "2026-08-28T14:35:00-03:00",
  },
  {
    productId: "1711",
    sku: "1711",
    manufacturerCode: "—",
    productName: "Garfo + Faca Continental",
    supplierName: "Fratelli",
    cost: "14.64",
    fiscalRule: "IMPORTADO",
    stAmount: "0",
    inputIcmsRate: "0.04",
    inputPisRate: "0.0165",
    inputCofinsRate: "0.076",
    inputIpiRate: "0.078",
    outputIcmsRates: { SP: "0.18", SUL_SUDESTE: "0.04", NORTE_NORDESTE: "0.04" },
    marketplace: {
      MERCADO_LIVRE: { percentageRate: "0.115", freight: "7.15", currentPrice: "35.49" },
      SHOPEE: { percentageRate: "0.20", freight: "0", currentPrice: "31.90" },
      AMAZON: { percentageRate: "0.12", freight: "7.15", currentPrice: "35.49" },
    },
    active: true,
    updatedAt: "2026-08-28T14:35:00-03:00",
  },
  {
    productId: "1887",
    sku: "1887",
    manufacturerCode: "VDA 04225",
    productName: "Marmita Pote Hermético 630 ml",
    supplierName: "Inga",
    cost: "8.90",
    fiscalRule: "IMPORTADO_ST",
    stAmount: "0.50",
    inputIcmsRate: "0",
    inputPisRate: "0.0165",
    inputCofinsRate: "0.076",
    inputIpiRate: "0.065",
    outputIcmsRates: { SP: "0", SUL_SUDESTE: "0.04", NORTE_NORDESTE: "0.04" },
    marketplace: {
      MERCADO_LIVRE: { percentageRate: "0.115", freight: "6.55", currentPrice: "19.90" },
      SHOPEE: { percentageRate: "0.20", freight: "0", currentPrice: "19.90" },
      AMAZON: { percentageRate: "0.12", freight: "5.65", currentPrice: "19.90" },
    },
    active: true,
    updatedAt: "2026-08-29T10:15:00-03:00",
  },
  {
    productId: "1931",
    sku: "1931",
    manufacturerCode: "SC600",
    productName: "Muleta Canadense Fix",
    supplierName: "Hidrolight",
    cost: "66.99",
    fiscalRule: "ISENTO",
    stAmount: "0",
    inputIcmsRate: "0",
    inputPisRate: "0",
    inputCofinsRate: "0",
    inputIpiRate: "0",
    outputIcmsRates: { SP: "0", SUL_SUDESTE: "0", NORTE_NORDESTE: "0" },
    marketplace: {
      MERCADO_LIVRE: { percentageRate: "0.12", freight: "28.55", currentPrice: "109.90" },
      SHOPEE: { percentageRate: "0.14", freight: "0", currentPrice: "96.99" },
      AMAZON: { percentageRate: "0.12", freight: "17.05", currentPrice: "100.00" },
    },
    active: true,
    updatedAt: "2026-08-30T09:42:00-03:00",
  },
  {
    productId: "1757",
    sku: "1757",
    manufacturerCode: "108602",
    productName: "Bibliocanto Transparente",
    supplierName: "Maxcril",
    cost: "7.07",
    fiscalRule: "NACIONAL",
    stAmount: "0",
    inputIcmsRate: "0.18",
    inputPisRate: "0.0165",
    inputCofinsRate: "0.076",
    inputIpiRate: "0.0975",
    outputIcmsRates: { SP: "0.18", SUL_SUDESTE: "0.12", NORTE_NORDESTE: "0.07" },
    marketplace: {
      MERCADO_LIVRE: { percentageRate: "0.115", freight: "6.95", currentPrice: "21.90" },
      SHOPEE: { percentageRate: "0.20", freight: "0", currentPrice: "20.49" },
      AMAZON: { percentageRate: "0.13", freight: "5.65", currentPrice: "19.90" },
    },
    active: true,
    updatedAt: "2026-08-31T08:10:00-03:00",
  },
];

export const marketplaceNames: Record<MarketplaceKey, string> = {
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  AMAZON: "Amazon",
};

export function getMarketplaceRule(
  product: DemoProduct,
  marketplace: MarketplaceKey,
  premium = false,
): MarketplaceRuleSnapshot {
  const current = product.marketplace[marketplace];
  if (marketplace === "SHOPEE") {
    return {
      marketplace,
      marketplaceName: marketplaceNames[marketplace],
      listingType: "PADRAO",
      version: 1,
      shippingRequired: false,
      feeBands: [
        { id: "shopee-0-80", label: "Até R$ 79,99", minPrice: "0", maxPrice: "80", percentageRate: "0.20", fixedFee: "4", effectiveFrom: "2026-01-01", effectiveTo: null },
        { id: "shopee-80-100", label: "R$ 80 a R$ 99,99", minPrice: "80", maxPrice: "100", percentageRate: "0.14", fixedFee: "16", effectiveFrom: "2026-01-01", effectiveTo: null },
        { id: "shopee-100-200", label: "R$ 100 a R$ 199,99", minPrice: "100", maxPrice: "200", percentageRate: "0.14", fixedFee: "20", effectiveFrom: "2026-01-01", effectiveTo: null },
        { id: "shopee-200", label: "R$ 200 ou mais", minPrice: "200", maxPrice: null, percentageRate: "0.14", fixedFee: "26", effectiveFrom: "2026-01-01", effectiveTo: null },
      ],
    };
  }

  const rate = premium && marketplace === "MERCADO_LIVRE"
    ? String(Number(current.percentageRate) + 0.05)
    : current.percentageRate;
  return {
    marketplace,
    marketplaceName: marketplaceNames[marketplace],
    listingType: marketplace === "MERCADO_LIVRE" ? (premium ? "PREMIUM" : "CLASSICO") : "PADRAO",
    version: 1,
    shippingRequired: true,
    feeBands: [
      { id: `${marketplace.toLowerCase()}-default`, label: premium ? "Anúncio Premium" : "Regra vigente do produto", minPrice: "0", maxPrice: null, percentageRate: rate, fixedFee: "0", effectiveFrom: "2026-01-01", effectiveTo: null },
    ],
  };
}

export const suppliers = Array.from(new Set(products.map((product) => product.supplierName))).map((name) => ({
  name,
  productCount: products.filter((product) => product.supplierName === name).length,
  active: true,
}));
