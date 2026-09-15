import type { Json } from "@/lib/supabase/database.types";
import type { PricingResult, RegionKey } from "./types";

export interface SavedPricing {
  id: string;
  createdAt: string;
  sku: string;
  productName: string;
  marketplace: string;
  listingType: string;
  price: string;
  freight: string;
  marginValue: string;
  marginPercent: string;
  snapshot: PricingResult;
  region: RegionKey;
  rebateType: "VALUE" | "PERCENT";
  rebateValue: string;
  appliedRebate: string;
  practicedRate: string;
  createdByName: string;
}

export type SharedPricingHistoryResult =
  | { loaded: true; items: SavedPricing[] }
  | { loaded: false; items: []; message: string };

export type SavePricingResult =
  | { saved: true; message: string; item: SavedPricing }
  | { saved: false; message: string };

export interface StoredPricingHistoryRow {
  id: string;
  created_at: string;
  marketplace_id: string;
  product_name?: string | null;
  listing_type: string;
  sale_price: number;
  shipping_cost: number;
  results: Json;
  input_snapshot: Json;
  rule_snapshot: Json;
}

const asObject = (value: Json): Record<string, Json | undefined> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json | undefined> : {};
const validRegion = (value: unknown): RegionKey => value === "SUL_SUDESTE" || value === "NORTE_NORDESTE" ? value : "SP";

export function storedPricingToHistory(row: StoredPricingHistoryRow, marketplace: string, createdByName: string): SavedPricing {
  const input = asObject(row.input_snapshot);
  const product = asObject(input.product ?? null);
  const rule = asObject(row.rule_snapshot);
  const region = validRegion(rule.selectedRegion);
  const regions = row.results as unknown as PricingResult["regions"];
  const regional = regions[region];
  const feeBand = rule.feeBand as unknown as PricingResult["feeBand"];
  return {
    id: row.id, createdAt: row.created_at, sku: String(product.sku ?? "MANUAL"), productName: row.product_name?.trim() || String(product.productName ?? "Produto manual"), marketplace,
    listingType: row.listing_type, price: String(row.sale_price), freight: String(row.shipping_cost), marginValue: String(regional?.contributionMarginValue ?? "0"), marginPercent: String(regional?.contributionMarginPercent ?? "0"),
    snapshot: { calculationVersion: String(rule.calculationVersion ?? "recommended-v2") as PricingResult["calculationVersion"], feeBand, regions, snapshot: row.input_snapshot as unknown as PricingResult["snapshot"] },
    region, rebateType: input.marketplaceRebateType === "PERCENT" ? "PERCENT" : "VALUE", rebateValue: String(input.marketplaceRebateValue ?? "0"), appliedRebate: String(regional?.marketplaceRebate ?? "0"),
    practicedRate: String(feeBand?.percentageRate ?? "0"), createdByName,
  };
}
