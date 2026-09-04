import { marginClassifications as demoMarginClassifications, products as demoProducts, type DemoProduct } from "@/data/demo-data";
import type { FiscalRuleKey, ListingType, MarginClassificationRule, MarketplaceKey, MarketplaceRuleSnapshot, MarketplaceShippingRule } from "@/domain/pricing/types";
import type { MarketplaceRuleMap } from "@/domain/pricing/marketplace-rules";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string; supplier_id: string; fiscal_rule_id: string; sku: string; manufacturer_code: string | null;
  name: string; cost: number; st_amount: number | null; input_icms_rate: number; input_pis_rate: number;
  input_cofins_rate: number; input_ipi_rate: number; output_icms_sp_rate: number;
  output_icms_south_southeast_rate: number; output_icms_north_northeast_rate: number;
  active: boolean; has_fixed_price: boolean; fixed_price: number | null; updated_at: string;
  package_weight_kg: number | null; package_height_cm: number | null; package_width_cm: number | null; package_length_cm: number | null; cubic_weight_kg: number | null;
};
type ConfigRow = { product_id: string; marketplace_id: string; listing_type: string; current_sale_price: number | null; commission_rate_override: number | null; freight_cost: number | null };

const value = (input: number | null | undefined, fallback = 0) => String(input ?? fallback);
const marketplaceDefaults: Record<MarketplaceKey, string> = { MERCADO_LIVRE: "0.115", SHOPEE: "0.14", AMAZON: "0.12" };

export async function loadMarginClassifications(): Promise<MarginClassificationRule[]> {
  const supabase = await createClient();
  if (!supabase) return demoMarginClassifications;
  const { data, error } = await supabase.from("margin_classifications").select("id,label,tone,min_percent,max_percent").eq("active", true).order("min_percent", { ascending: true, nullsFirst: true });
  if (error || !data?.length) return demoMarginClassifications;
  return (data ?? []).map((item) => ({ id: item.id, label: item.label as MarginClassificationRule["label"], tone: item.tone as MarginClassificationRule["tone"], minPercent: item.min_percent == null ? null : value(item.min_percent), maxPercent: item.max_percent == null ? null : value(item.max_percent) }));
}

export async function loadCatalogProducts({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<{ products: DemoProduct[]; source: "database" | "demo" }> {
  const supabase = await createClient();
  if (!supabase) return { products: demoProducts, source: "demo" };
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { products: demoProducts, source: "demo" };

  let productsQuery = supabase.from("products").select("*").order("sku").limit(1000);
  if (!includeInactive) productsQuery = productsQuery.eq("active", true);
  const [productsResult, suppliersResult, rulesResult, configsResult, marketplacesResult] = await Promise.all([
    productsQuery,
    supabase.from("suppliers").select("id,name"),
    supabase.from("fiscal_rules").select("id,code"),
    (async () => {
      const rows: ConfigRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const page = await supabase.from("product_marketplace_configs").select("product_id,marketplace_id,listing_type,current_sale_price,commission_rate_override,freight_cost").eq("active", true).order("id").range(from, from + pageSize - 1);
        if (page.error) return { data: null, error: page.error };
        rows.push(...(page.data as ConfigRow[]));
        if ((page.data?.length ?? 0) < pageSize) return { data: rows, error: null };
      }
    })(),
    supabase.from("marketplaces").select("id,code").eq("active", true),
  ]);
  if (productsResult.error || suppliersResult.error || rulesResult.error || configsResult.error || marketplacesResult.error || !productsResult.data?.length) {
    return { products: demoProducts, source: "demo" };
  }

  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));
  const rules = new Map((rulesResult.data ?? []).map((row) => [row.id, row.code as FiscalRuleKey]));
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row.code as MarketplaceKey]));
  const configs = new Map<string, Record<string, ConfigRow>>();
  for (const config of configsResult.data ?? []) {
    const marketplace = marketplaces.get(config.marketplace_id);
    if (!marketplace) continue;
    configs.set(config.product_id, { ...(configs.get(config.product_id) ?? {}), [`${marketplace}:${config.listing_type}`]: config });
  }

  return {
    source: "database",
    products: (productsResult.data as ProductRow[]).map((row) => {
      const productConfigs = configs.get(row.id) ?? {};
      const marketplace = Object.fromEntries((Object.keys(marketplaceDefaults) as MarketplaceKey[]).map((key) => {
        const listingType = key === "MERCADO_LIVRE" ? "CLASSICO" : "PADRAO";
        const config = productConfigs[`${key}:${listingType}`];
        const premiumConfig = key === "MERCADO_LIVRE" ? productConfigs["MERCADO_LIVRE:PREMIUM"] : undefined;
        const suggested = Math.max(Number(row.cost) * 2, 0.01).toFixed(2);
        return [key, {
          percentageRate: value(config?.commission_rate_override, Number(marketplaceDefaults[key])),
          premiumPercentageRate: key === "MERCADO_LIVRE" ? value(premiumConfig?.commission_rate_override, Number(config?.commission_rate_override ?? marketplaceDefaults[key]) + 0.05) : undefined,
          usesCommissionOverride: config?.commission_rate_override != null,
          usesPremiumCommissionOverride: premiumConfig?.commission_rate_override != null,
          freight: value(config?.freight_cost),
          currentPrice: value(config?.current_sale_price, Number(suggested)),
        }];
      })) as DemoProduct["marketplace"];
      return {
        productId: row.id, sku: row.sku, manufacturerCode: row.manufacturer_code ?? "—", productName: row.name,
        supplierName: suppliers.get(row.supplier_id) ?? "Fornecedor não encontrado", cost: value(row.cost),
        fiscalRule: rules.get(row.fiscal_rule_id) ?? "ISENTO", stAmount: value(row.st_amount),
        inputIcmsRate: value(row.input_icms_rate), inputPisRate: value(row.input_pis_rate),
        inputCofinsRate: value(row.input_cofins_rate), inputIpiRate: value(row.input_ipi_rate),
        outputIcmsRates: { SP: value(row.output_icms_sp_rate), SUL_SUDESTE: value(row.output_icms_south_southeast_rate), NORTE_NORDESTE: value(row.output_icms_north_northeast_rate) },
        packageWeightKg: row.package_weight_kg == null ? null : value(row.package_weight_kg), packageHeightCm: row.package_height_cm == null ? null : value(row.package_height_cm),
        packageWidthCm: row.package_width_cm == null ? null : value(row.package_width_cm), packageLengthCm: row.package_length_cm == null ? null : value(row.package_length_cm), cubicWeightKg: row.cubic_weight_kg == null ? null : value(row.cubic_weight_kg),
        marketplace, active: row.active, hasFixedPrice: row.has_fixed_price, fixedPrice: row.fixed_price == null ? null : value(row.fixed_price), updatedAt: row.updated_at,
      };
    }),
  };
}

export async function loadMarketplaceShippingRule(code: "MERCADO_LIVRE" | "AMAZON"): Promise<MarketplaceShippingRule | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: marketplace } = await supabase.from("marketplaces").select("id").eq("code", code).single();
  if (!marketplace) return null;
  const { data: rule } = await supabase.from("marketplace_shipping_rule_sets").select("id,version,source_url,effective_from").eq("marketplace_id", marketplace.id).eq("status", "PUBLISHED").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!rule) return null;
  const [prices, weights, rates, additional] = await Promise.all([
    supabase.from("shipping_price_bands").select("id,label,max_price,sort_order").eq("rule_set_id", rule.id).order("sort_order"),
    supabase.from("shipping_weight_bands").select("id,label,max_weight_kg,sort_order").eq("rule_set_id", rule.id).order("sort_order"),
    supabase.from("shipping_rates").select("id,price_band_id,weight_band_id,cost").eq("rule_set_id", rule.id),
    code === "AMAZON" ? supabase.from("shipping_additional_kg_rates").select("id,price_band_id,cost_per_kg").eq("rule_set_id", rule.id) : Promise.resolve({ data: [], error: null }),
  ]);
  if (prices.error || weights.error || rates.error || additional.error) return null;
  return {
    id: rule.id, version: rule.version, sourceUrl: rule.source_url, effectiveFrom: rule.effective_from, marketplace: code,
    priceBands: (prices.data ?? []).map((item) => ({ id: item.id, label: item.label, maxPrice: item.max_price == null ? null : value(item.max_price), sortOrder: item.sort_order })),
    weightBands: (weights.data ?? []).map((item) => ({ id: item.id, label: item.label, maxWeightKg: item.max_weight_kg == null ? null : value(item.max_weight_kg), sortOrder: item.sort_order })),
    rates: (rates.data ?? []).map((item) => ({ id: item.id, priceBandId: item.price_band_id, weightBandId: item.weight_band_id, cost: value(item.cost) })),
    additionalKgRates: (additional.data ?? []).map((item) => ({ id: item.id, priceBandId: item.price_band_id, costPerKg: value(item.cost_per_kg) })),
  };
}

export const loadMercadoLivreShippingRule = () => loadMarketplaceShippingRule("MERCADO_LIVRE");
export const loadAmazonShippingRule = () => loadMarketplaceShippingRule("AMAZON");

export interface MarketplaceRuleCard {
  marketplace: MarketplaceKey; marketplaceName: string; listingType: ListingType; version: number;
  effectiveFrom: string; bands: MarketplaceRuleSnapshot["feeBands"];
}

export async function loadMarketplaceRules(): Promise<MarketplaceRuleMap> {
  const supabase = await createClient();
  if (!supabase) return {};
  const [marketplacesResult, ruleSetsResult, bandsResult] = await Promise.all([
    supabase.from("marketplaces").select("id,code,name,shipping_mode").eq("active", true),
    supabase.from("marketplace_fee_rule_sets").select("id,marketplace_id,listing_type,version,effective_from,effective_to").eq("status", "PUBLISHED"),
    supabase.from("marketplace_fee_bands").select("id,rule_set_id,label,min_price,max_price,percentage_rate,fixed_fee,sort_order").order("sort_order"),
  ]);
  if (marketplacesResult.error || ruleSetsResult.error || bandsResult.error) return {};
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row]));
  const output: MarketplaceRuleMap = {};
  for (const set of ruleSetsResult.data ?? []) {
    const marketplace = marketplaces.get(set.marketplace_id);
    if (!marketplace) continue;
    const key = `${marketplace.code as MarketplaceKey}:${set.listing_type as ListingType}` as const;
    const current = output[key];
    if (current && current.version > set.version) continue;
    output[key] = {
      marketplace: marketplace.code as MarketplaceKey,
      marketplaceName: marketplace.name,
      listingType: set.listing_type as ListingType,
      version: set.version,
      shippingRequired: marketplace.shipping_mode !== "NONE",
      feeBands: (bandsResult.data ?? []).filter((band) => band.rule_set_id === set.id).map((band) => ({
        id: band.id, label: band.label, minPrice: value(band.min_price), maxPrice: band.max_price == null ? null : value(band.max_price),
        percentageRate: value(band.percentage_rate), fixedFee: value(band.fixed_fee), effectiveFrom: set.effective_from, effectiveTo: set.effective_to,
      })),
    };
  }
  return output;
}

export async function loadMarketplaceRuleCards(): Promise<MarketplaceRuleCard[]> {
  const rules = await loadMarketplaceRules();
  return Object.values(rules).filter((rule): rule is MarketplaceRuleSnapshot => Boolean(rule) && rule?.marketplace === "SHOPEE").map((rule) => ({
    marketplace: rule.marketplace, marketplaceName: rule.marketplaceName, listingType: rule.listingType,
    version: rule.version, effectiveFrom: rule.feeBands[0]?.effectiveFrom ?? "2026-01-01", bands: rule.feeBands,
  })).sort((a, b) => a.marketplace.localeCompare(b.marketplace) || a.listingType.localeCompare(b.listingType));
}


export interface SupplierItem { id: string; name: string; active: boolean; logoUrl: string | null; productCount: number }
export async function loadSuppliers(): Promise<SupplierItem[]> {
  const supabase = await createClient();
  if (!supabase) return Array.from(new Set(demoProducts.map((item) => item.supplierName))).sort().map((name) => ({ id: name, name, active: true, logoUrl: null, productCount: demoProducts.filter((item) => item.supplierName === name).length }));
  const [supplierResult, productResult] = await Promise.all([supabase.from("suppliers").select("id,name,active,logo_path").order("name"), supabase.from("products").select("supplier_id")]);
  if (supplierResult.error) return [];
  return Promise.all((supplierResult.data ?? []).map(async (row) => {
    const signed = row.logo_path ? await supabase.storage.from("supplier-logos").createSignedUrl(row.logo_path, 3600) : null;
    return { id: row.id, name: row.name, active: row.active, logoUrl: signed?.data?.signedUrl ?? null, productCount: (productResult.data ?? []).filter((product) => product.supplier_id === row.id).length };
  }));
}

export interface CostHistoryItem { id: string; oldCost: string; newCost: string; changedAt: string; changedBy: string; reason: string | null }
export async function loadProductCostHistory(productId: string): Promise<CostHistoryItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [history, profiles] = await Promise.all([supabase.from("product_cost_history").select("*").eq("product_id", productId).order("changed_at", { ascending: false }), supabase.from("profiles").select("id,display_name")]);
  if (history.error) return [];
  const names = new Map((profiles.data ?? []).map((item) => [item.id, item.display_name ?? "Usuário"]));
  return (history.data ?? []).map((item) => ({ id: item.id, oldCost: value(item.old_cost), newCost: value(item.new_cost), changedAt: item.changed_at, changedBy: item.changed_by ? names.get(item.changed_by) ?? "Usuário" : "Sistema", reason: item.change_reason }));
}

export interface HistoryPageResult<T> { items: T[]; page: number; pageSize: number; total: number }
export interface PricingHistoryItem { id: string; createdAt: string; sku: string; productName: string; marketplace: string; listingType: string; salePrice: string; shippingCost: string; marginValue: string; marginPercent: string }
export interface CostChangeHistoryItem { id: string; changedAt: string; sku: string; productName: string; oldCost: string; newCost: string; changedBy: string }
export interface NewProductHistoryItem { id: string; createdAt: string; sku: string; productName: string; supplierName: string; active: boolean }
type HistoryOptions = { query?: string; page?: number; pageSize?: number };

async function matchingHistoryProducts(query: string) {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, products: [] as { id: string; sku: string; name: string }[] };
  const { data } = await supabase.from("products").select("id,sku,name").order("sku");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const products = normalized ? (data ?? []).filter((item) => `${item.sku} ${item.name}`.toLocaleLowerCase("pt-BR").includes(normalized)) : data ?? [];
  return { supabase, products };
}

export async function loadPricingHistory({ query = "", page = 1, pageSize = 20 }: HistoryOptions = {}): Promise<HistoryPageResult<PricingHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const { supabase, products: matchingProducts } = await matchingHistoryProducts(query);
  if (!supabase || !matchingProducts.length) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const from = (safePage - 1) * safePageSize;
  const [history, productsResult, marketplacesResult] = await Promise.all([
    supabase.from("pricing_calculations").select("id,created_at,product_id,marketplace_id,listing_type,sale_price,shipping_cost,results,rule_snapshot", { count: "exact" }).in("product_id", matchingProducts.map((item) => item.id)).order("created_at", { ascending: false }).range(from, from + safePageSize - 1),
    Promise.resolve({ data: matchingProducts }), supabase.from("marketplaces").select("id,name"),
  ]);
  if (history.error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const products = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row.name]));
  const object = (input: Json | undefined): { [key: string]: Json | undefined } => input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const text = (input: Json | undefined) => typeof input === "number" || typeof input === "string" ? String(input) : "0";
  const items = (history.data ?? []).map((row) => {
    const snapshot = object(row.rule_snapshot);
    const selectedRegion = snapshot.selectedRegion === "SUL_SUDESTE" || snapshot.selectedRegion === "NORTE_NORDESTE" ? snapshot.selectedRegion : "SP";
    const regionalResult = object(object(row.results)[selectedRegion]);
    return {
      id: row.id, createdAt: row.created_at, sku: products.get(row.product_id)?.sku ?? "—",
      productName: products.get(row.product_id)?.name ?? "Produto removido", marketplace: marketplaces.get(row.marketplace_id) ?? "—",
      listingType: row.listing_type, salePrice: value(row.sale_price), shippingCost: value(row.shipping_cost),
      marginValue: text(regionalResult.contributionMarginValue), marginPercent: text(regionalResult.contributionMarginPercent),
    };
  });
  return { items, page: safePage, pageSize: safePageSize, total: history.count ?? 0 };
}

export async function loadCostChangeHistory({ query = "", page = 1, pageSize = 20 }: HistoryOptions = {}): Promise<HistoryPageResult<CostChangeHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const { supabase, products } = await matchingHistoryProducts(query);
  if (!supabase || !products.length) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const from = (safePage - 1) * safePageSize;
  const [history, profilesResult] = await Promise.all([
    supabase.from("product_cost_history").select("id,product_id,old_cost,new_cost,changed_by,changed_at", { count: "exact" }).in("product_id", products.map((item) => item.id)).order("changed_at", { ascending: false }).range(from, from + safePageSize - 1),
    supabase.from("profiles").select("id,display_name"),
  ]);
  if (history.error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const productMap = new Map(products.map((item) => [item.id, item]));
  const profileMap = new Map((profilesResult.data ?? []).map((item) => [item.id, item.display_name ?? "Usuário"]));
  return {
    items: (history.data ?? []).map((item) => ({ id: item.id, changedAt: item.changed_at, sku: productMap.get(item.product_id)?.sku ?? "—", productName: productMap.get(item.product_id)?.name ?? "Produto removido", oldCost: value(item.old_cost), newCost: value(item.new_cost), changedBy: item.changed_by ? profileMap.get(item.changed_by) ?? "Usuário" : "Sistema" })),
    page: safePage, pageSize: safePageSize, total: history.count ?? 0,
  };
}

export async function loadNewProductHistory({ query = "", page = 1, pageSize = 20 }: HistoryOptions = {}): Promise<HistoryPageResult<NewProductHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const supabase = await createClient();
  if (!supabase) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const [productsResult, suppliersResult] = await Promise.all([
    supabase.from("products").select("id,sku,name,supplier_id,active,created_at").order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id,name"),
  ]);
  if (productsResult.error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalized ? (productsResult.data ?? []).filter((item) => `${item.sku} ${item.name}`.toLocaleLowerCase("pt-BR").includes(normalized)) : productsResult.data ?? [];
  const from = (safePage - 1) * safePageSize;
  const suppliers = new Map((suppliersResult.data ?? []).map((item) => [item.id, item.name]));
  return {
    items: filtered.slice(from, from + safePageSize).map((item) => ({ id: item.id, createdAt: item.created_at, sku: item.sku, productName: item.name, supplierName: suppliers.get(item.supplier_id) ?? "—", active: item.active })),
    page: safePage, pageSize: safePageSize, total: filtered.length,
  };
}

export interface RepricingItem { id: string; productId: string; createdAt: string; sku: string; productName: string; supplierName: string; cost: string; marketplace: string; reason: string; sourceType: string; status: string }
export async function loadRepricingQueue(): Promise<RepricingItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [queue, productsResult, marketplacesResult, suppliersResult] = await Promise.all([
    supabase.from("repricing_queue").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("products").select("id,sku,name,cost,supplier_id"), supabase.from("marketplaces").select("id,name"),
    supabase.from("suppliers").select("id,name"),
  ]);
  if (queue.error) return [];
  const products = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row.name]));
  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));
  return (queue.data ?? []).map((row) => ({
    id: row.id, productId: row.product_id, createdAt: row.created_at, sku: products.get(row.product_id)?.sku ?? "—",
    productName: products.get(row.product_id)?.name ?? "Produto removido", supplierName: suppliers.get(products.get(row.product_id)?.supplier_id ?? "") ?? "—", cost: value(products.get(row.product_id)?.cost),
    marketplace: row.marketplace_id ? marketplaces.get(row.marketplace_id) ?? "Todos" : "Todos",
    reason: row.reason, sourceType: row.source_type, status: row.status,
  }));
}
