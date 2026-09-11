import type { DemoProduct } from "@/data/demo-data";
import { redirect } from "next/navigation";
import type { FiscalRuleKey, ListingType, MarginClassificationRule, MarketplaceKey, MarketplaceRuleSnapshot, MarketplaceShippingRule } from "@/domain/pricing/types";
import type { MarketplaceRuleMap } from "@/domain/pricing/marketplace-rules";
import { repricingTypeLabel, type RepricingTypeLabel } from "@/domain/repricing";
export type { RepricingTypeLabel } from "@/domain/repricing";
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

const value = (input: unknown, fallback = 0) => String(typeof input === "number" || typeof input === "string" ? input : fallback);
const marketplaceDefaults: Record<MarketplaceKey, string> = { MERCADO_LIVRE: "0.115", SHOPEE: "0.14", AMAZON: "0.12" };

export async function loadMarginClassifications(): Promise<MarginClassificationRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("margin_classifications").select("id,label,tone,min_percent,max_percent").eq("active", true).order("min_percent", { ascending: true, nullsFirst: true });
  if (error || !data?.length) throw new Error("Não foi possível carregar as faixas de margem cadastradas.");
  return (data ?? []).map((item) => ({ id: item.id, label: item.label as MarginClassificationRule["label"], tone: item.tone as MarginClassificationRule["tone"], minPercent: item.min_percent == null ? null : value(item.min_percent), maxPercent: item.max_percent == null ? null : value(item.max_percent) }));
}

export type ProductChildSkuMap = Readonly<Record<string, ReadonlyArray<Readonly<{ id: string; sku: string; description: string | null }>>>>;
export async function loadCatalogProducts({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<{ products: DemoProduct[]; childSkusByProduct: ProductChildSkuMap; source: "database" }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  let productsQuery = supabase.from("products").select("*").order("sku").limit(1000);
  if (!includeInactive) productsQuery = productsQuery.eq("active", true);
  const [productsResult, suppliersResult, rulesResult, configsResult, marketplacesResult, childSkusResult] = await Promise.all([
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
    supabase.from("product_child_skus").select("id,product_id,sku,description").order("sku"),
  ]);
  if (productsResult.error || suppliersResult.error || rulesResult.error || configsResult.error || marketplacesResult.error || childSkusResult.error) throw new Error("Não foi possível consultar o catálogo. Tente novamente ou contate o administrador.");

  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));
  const rules = new Map((rulesResult.data ?? []).map((row) => [row.id, row.code as FiscalRuleKey]));
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row.code as MarketplaceKey]));
  const configs = new Map<string, Record<string, ConfigRow>>();
  const childSkus = new Map<string, Array<{ id: string; sku: string; description: string | null }>>();
  for (const child of childSkusResult.data ?? []) childSkus.set(child.product_id, [...(childSkus.get(child.product_id) ?? []), { id: child.id, sku: child.sku, description: child.description }]);
  for (const config of configsResult.data ?? []) {
    const marketplace = marketplaces.get(config.marketplace_id);
    if (!marketplace) continue;
    configs.set(config.product_id, { ...(configs.get(config.product_id) ?? {}), [`${marketplace}:${config.listing_type}`]: config });
  }

  return {
    source: "database",
    childSkusByProduct: Object.fromEntries(childSkus),
    products: ((productsResult.data ?? []) as ProductRow[]).map((row) => {
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
  const [supplierResult, productResult] = await Promise.all([supabase.from("suppliers").select("id,name,active,logo_path").order("name"), supabase.from("products").select("supplier_id")]);
  if (supplierResult.error || productResult.error) throw new Error("Não foi possível consultar os fornecedores.");
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
export interface CostChangeHistoryItem { id: string; changedAt: string; sku: string; productName: string; oldCost: string; newCost: string; costDifference: string; differencePercent: string | null; changedBy: string }
export interface NewProductHistoryItem { id: string; createdAt: string; sku: string; productName: string; supplierName: string; active: boolean }
export type SortDirection = "asc" | "desc";
type HistoryOptions = { query?: string; page?: number; pageSize?: number; sort?: string; direction?: SortDirection };

type RpcHistoryPayload = { total?: number; items?: Array<Record<string, unknown>> };
const rpcPayload = (data: Json | null): RpcHistoryPayload => data && typeof data === "object" && !Array.isArray(data) ? data as unknown as RpcHistoryPayload : {};
const pageResult = <T>(payload: RpcHistoryPayload, page: number, pageSize: number, items: T[]): HistoryPageResult<T> => ({ items, page, pageSize, total: Number(payload.total ?? 0) });

async function resolveChildSkuQuery(supabase: Awaited<ReturnType<typeof createClient>>, query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return query;
  const { data: child } = await supabase.from("product_child_skus").select("product_id").eq("normalized_sku", normalized).maybeSingle();
  if (!child) return query;
  const { data: product } = await supabase.from("products").select("sku").eq("id", child.product_id).single();
  return product?.sku ?? query;
}

export async function loadPricingHistory({ query = "", page = 1, pageSize = 20, sort = "date", direction = "desc" }: HistoryOptions = {}): Promise<HistoryPageResult<PricingHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(20, Math.max(1, Math.trunc(pageSize)));
  const supabase = await createClient();
  if (!supabase) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const resolvedQuery = await resolveChildSkuQuery(supabase, query);
  const { data, error } = await supabase.rpc("list_operational_history", { p_kind: "pricing", p_query: resolvedQuery, p_page: safePage, p_page_size: safePageSize, p_sort: sort, p_direction: direction });
  if (error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const payload = rpcPayload(data);
  const items = (payload.items ?? []).map((row) => ({ id: String(row.id), createdAt: String(row.created_at), sku: String(row.sku), productName: String(row.product_name), marketplace: String(row.marketplace_name), listingType: String(row.listing_type), salePrice: value(row.sale_price), shippingCost: value(row.shipping_cost), marginValue: value(row.margin_value), marginPercent: value(row.margin_percent) }));
  return pageResult(payload, safePage, safePageSize, items);
}

export async function loadCostChangeHistory({ query = "", page = 1, pageSize = 20, sort = "date", direction = "desc" }: HistoryOptions = {}): Promise<HistoryPageResult<CostChangeHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(20, Math.max(1, Math.trunc(pageSize)));
  const supabase = await createClient();
  if (!supabase) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const resolvedQuery = await resolveChildSkuQuery(supabase, query);
  const { data, error } = await supabase.rpc("list_operational_history", { p_kind: "cost", p_query: resolvedQuery, p_page: safePage, p_page_size: safePageSize, p_sort: sort, p_direction: direction });
  if (error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const payload = rpcPayload(data);
  const items = (payload.items ?? []).map((row) => ({ id: String(row.id), changedAt: String(row.changed_at), sku: String(row.sku), productName: String(row.product_name), oldCost: value(row.old_cost), newCost: value(row.new_cost), costDifference: value(row.cost_difference), differencePercent: row.difference_percent == null ? null : value(row.difference_percent), changedBy: String(row.changed_by_name) }));
  return pageResult(payload, safePage, safePageSize, items);
}

export async function loadNewProductHistory({ query = "", page = 1, pageSize = 20, sort = "date", direction = "desc" }: HistoryOptions = {}): Promise<HistoryPageResult<NewProductHistoryItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(20, Math.max(1, Math.trunc(pageSize)));
  const supabase = await createClient();
  if (!supabase) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const resolvedQuery = await resolveChildSkuQuery(supabase, query);
  const { data, error } = await supabase.rpc("list_operational_history", { p_kind: "products", p_query: resolvedQuery, p_page: safePage, p_page_size: safePageSize, p_sort: sort, p_direction: direction });
  if (error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const payload = rpcPayload(data);
  const items = (payload.items ?? []).map((row) => ({ id: String(row.id), createdAt: String(row.created_at), sku: String(row.sku), productName: String(row.product_name), supplierName: String(row.supplier_name), active: Boolean(row.active) }));
  return pageResult(payload, safePage, safePageSize, items);
}

export interface RepricingItem { id: string; productId: string; createdAt: string; resolvedAt: string | null; resolvedByName: string | null; sku: string; productName: string; supplierName: string; cost: string; marketplace: string; reason: string; sourceType: string; typeLabel: RepricingTypeLabel; status: string }
export type RepricingPageOptions = { scope: "pending" | "completed"; query?: string; channel?: string; page?: number; pageSize?: number; sort?: string; direction?: SortDirection };

export async function loadActiveMarketplaceNames(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("marketplaces").select("name").eq("active", true).order("name");
  return (data ?? []).map((item) => item.name);
}

export async function loadRepricingPage({ scope, query = "", channel = "", page = 1, pageSize = 20, sort = "date", direction = "desc" }: RepricingPageOptions): Promise<HistoryPageResult<RepricingItem>> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(20, Math.max(1, Math.trunc(pageSize)));
  const supabase = await createClient();
  if (!supabase) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const { data, error } = await supabase.rpc("list_repricing_history_with_query", { p_scope: scope, p_query: query, p_channel: channel, p_page: safePage, p_page_size: safePageSize, p_sort: sort, p_direction: direction });
  if (error) return { items: [], page: safePage, pageSize: safePageSize, total: 0 };
  const payload = rpcPayload(data);
  const items = (payload.items ?? []).map((row) => ({
    id: String(row.id), productId: String(row.product_id), createdAt: String(row.created_at), resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
    resolvedByName: row.resolved_by_name == null ? null : String(row.resolved_by_name), sku: String(row.sku), productName: String(row.product_name), supplierName: String(row.supplier_name),
    cost: value(row.cost), marketplace: String(row.marketplace_name), reason: String(row.reason), sourceType: String(row.source_type), typeLabel: String(row.type_label) as RepricingTypeLabel, status: String(row.status),
  }));
  return pageResult(payload, safePage, safePageSize, items);
}

export async function loadRepricingQueue(): Promise<RepricingItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [queue, productsResult, marketplacesResult, suppliersResult] = await Promise.all([
    supabase.from("repricing_queue").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("products").select("id,sku,name,cost,supplier_id"), supabase.from("marketplaces").select("id,name"),
    supabase.from("suppliers").select("id,name"),
  ]);
  if (queue.error) return [];
  const resolverIds = Array.from(new Set((queue.data ?? []).map((item) => item.resolved_by).filter((id): id is string => Boolean(id))));
  const { data: resolverRows } = resolverIds.length ? await supabase.rpc("profile_display_names", { target_ids: resolverIds }) : { data: [] };
  const resolvers = new Map((resolverRows ?? []).map((item) => [item.id, item.display_name ?? "Usuário"]));
  const products = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const marketplaces = new Map((marketplacesResult.data ?? []).map((row) => [row.id, row.name]));
  const suppliers = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));
  return (queue.data ?? []).map((row) => ({
    id: row.id, productId: row.product_id, createdAt: row.created_at, resolvedAt: row.resolved_at, resolvedByName: row.resolved_by ? resolvers.get(row.resolved_by) ?? "Usuário não identificado" : null, sku: products.get(row.product_id)?.sku ?? "—",
    productName: products.get(row.product_id)?.name ?? "Produto removido", supplierName: suppliers.get(products.get(row.product_id)?.supplier_id ?? "") ?? "—", cost: value(products.get(row.product_id)?.cost),
    marketplace: row.marketplace_id ? marketplaces.get(row.marketplace_id) ?? "Todos" : "Todos",
    reason: row.reason, sourceType: row.source_type, typeLabel: repricingTypeLabel(row.source_type), status: row.status,
  }));
}
