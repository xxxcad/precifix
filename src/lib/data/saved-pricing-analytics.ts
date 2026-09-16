import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { storedPricingToHistory, type SavedPricing, type StoredPricingHistoryRow } from "@/domain/pricing/history";

export type PricingRegion = "SP" | "SUL_SUDESTE" | "NORTE_NORDESTE";
export type PricingScenario = "ML_CLASSICO" | "ML_PREMIUM" | "SHOPEE" | "AMAZON";
export type SavedPricingMetric = {
  id: string; scenario: PricingScenario; marketplace: string; listingType: string; region: PricingRegion;
  price: number; shipping: number; rebate: number; marginValue: number; marginPercent: number;
  createdAt: string; createdBy: string; createdByName: string;
};
export type SavedPricingProduct = {
  id: string; sku: string; childSkus: string[]; name: string; manufacturerCode: string | null; active: boolean; cost: number;
  supplierId: string; supplierName: string; pending: boolean; scenarios: Partial<Record<PricingScenario, SavedPricingMetric>>;
  averageValue: number | null; averagePercent: number | null; averageTicket: number | null; scenarioCount: number; latestAt: string | null;
};
export type SavedPricingAverage = { value: number; percent: number; ticket: number; count: number };
export type SavedPricingRanking = { productId: string; sku: string; name: string; value: number; channels: number };
export type SavedPricingMetrics = {
  overall: SavedPricingAverage; eligibleProducts: number; pricedProducts: number; completeProducts: number; pendingProducts: number;
  belowAcceptable: number; staleProducts: number; byScenario: Partial<Record<PricingScenario, SavedPricingAverage>>;
  topValue: SavedPricingRanking | null; topPercent: SavedPricingRanking | null; lowestPercent: SavedPricingRanking | null;
};
export type SavedPricingFilters = {
  query: string; supplierId: string; status: "ACTIVE" | "INACTIVE" | "ALL"; scenario: "ALL" | PricingScenario;
  coverage: "ALL" | "WITH" | "WITHOUT" | "COMPLETE"; margin: "ALL" | "BELOW" | "ACCEPTABLE";
  pending: "ALL" | "YES" | "NO"; creatorId: string; region: PricingRegion;
  period: "ALL" | "7" | "30" | "60" | "90" | "CUSTOM"; dateFrom: string; dateTo: string;
  sort: "product" | "supplier" | "status" | "channels" | "ticket" | "marginValue" | "marginPercent" | "date";
  direction: "asc" | "desc"; page: number;
};
export type SavedPricingAnalytics = {
  products: SavedPricingProduct[]; total: number; page: number; pageSize: number; metrics: SavedPricingMetrics;
  suppliers: Array<{ id: string; name: string }>; creators: Array<{ id: string; name: string }>; generatedAt: string;
};
export type ProductPricingHistoryFilters = {
  scenario: "ALL" | PricingScenario; region: "ALL" | PricingRegion; creatorId: string;
  period: "ALL" | "7" | "30" | "60" | "90" | "CUSTOM"; dateFrom: string; dateTo: string;
  sort: "date" | "channel" | "price" | "shipping" | "marginValue" | "marginPercent" | "creator"; direction: "asc" | "desc"; page: number;
};
export type ProductPricingHistoryResult = { items: SavedPricing[]; total: number; page: number; pageSize: number; creators: Array<{ id: string; name: string }> };

type CalculationRow = StoredPricingHistoryRow & { product_id: string; created_by: string };
const scenarios = ["ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"] as const;
const asObject = (value: Json | undefined): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const scenarioFor = (code: string, listing: string): PricingScenario | null => code === "MERCADO_LIVRE" ? (listing === "PREMIUM" ? "ML_PREMIUM" : "ML_CLASSICO") : code === "SHOPEE" ? "SHOPEE" : code === "AMAZON" ? "AMAZON" : null;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const average = (items: SavedPricingMetric[]): SavedPricingAverage => items.length ? {
  value: items.reduce((sum, item) => sum + item.marginValue, 0) / items.length,
  percent: items.reduce((sum, item) => sum + item.marginPercent, 0) / items.length,
  ticket: items.reduce((sum, item) => sum + item.price, 0) / items.length,
  count: items.length,
} : { value: 0, percent: 0, ticket: 0, count: 0 };

function dateRange(filters: Pick<SavedPricingFilters, "period" | "dateFrom" | "dateTo">) {
  const now = new Date();
  if (filters.period !== "ALL" && filters.period !== "CUSTOM") return { from: new Date(now.getTime() - Number(filters.period) * 86400000), to: now };
  if (filters.period === "CUSTOM") return {
    from: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00-03:00`) : null,
    to: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999-03:00`) : null,
  };
  return { from: null, to: null };
}

function inRange(createdAt: string, filters: Pick<SavedPricingFilters, "period" | "dateFrom" | "dateTo">) {
  const range = dateRange(filters), value = new Date(createdAt);
  return (!range.from || value >= range.from) && (!range.to || value <= range.to);
}

async function allCalculations(productIds?: string[]): Promise<CalculationRow[]> {
  if (productIds && !productIds.length) return [];
  const supabase = await createClient(), rows: CalculationRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase.from("pricing_calculations").select("id,product_id,created_at,created_by,marketplace_id,listing_type,sale_price,shipping_cost,results,input_snapshot,rule_snapshot").order("created_at", { ascending: false }).range(from, from + 999);
    if (productIds) query = query.in("product_id", productIds);
    const { data, error } = await query;
    if (error) break;
    rows.push(...(data as CalculationRow[] ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}

async function displayNames(ids: string[]) {
  const supabase = await createClient();
  if (!ids.length) return new Map<string, string>();
  const { data } = await supabase.rpc("profile_display_names", { target_ids: Array.from(new Set(ids)) });
  return new Map((data ?? []).map((item) => [item.id, item.display_name ?? "Usuário"]));
}

function metricFrom(row: CalculationRow, scenario: PricingScenario, marketplace: string, region: PricingRegion, creatorName: string): SavedPricingMetric {
  const regional = asObject(asObject(row.results)[region] as Json | undefined);
  const input = asObject(row.input_snapshot);
  return { id: row.id, scenario, marketplace, listingType: row.listing_type, region, price: Number(row.sale_price), shipping: Number(row.shipping_cost),
    rebate: Number(regional.marketplaceRebate ?? input.marketplaceRebateValue ?? 0), marginValue: Number(regional.contributionMarginValue ?? 0), marginPercent: Number(regional.contributionMarginPercent ?? 0),
    createdAt: row.created_at, createdBy: row.created_by, createdByName: creatorName };
}

export async function loadSavedPricingAnalytics(filters: SavedPricingFilters, pageSize = 20): Promise<SavedPricingAnalytics> {
  const supabase = await createClient();
  const [{ data: productRows }, { data: supplierRows }, { data: marketRows }, { data: pendingRows }, { data: marginRows }] = await Promise.all([
    supabase.from("products").select("id,sku,name,manufacturer_code,active,cost,supplier_id"),
    supabase.from("suppliers").select("id,name").order("name"),
    supabase.from("marketplaces").select("id,code,name"),
    supabase.from("repricing_queue").select("product_id").in("status", ["OPEN", "IN_PROGRESS"]),
    supabase.from("margin_classifications").select("label,min_percent").eq("active", true),
  ]);
  const products = productRows ?? [], ids = products.map((product) => product.id);
  const [{ data: childRows }, calculations] = await Promise.all([
    ids.length ? supabase.from("product_child_skus").select("product_id,sku").in("product_id", ids) : Promise.resolve({ data: [] }),
    allCalculations(ids),
  ]);
  const names = await displayNames(calculations.map((row) => row.created_by));
  const suppliers = supplierRows ?? [], supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const marketMap = new Map((marketRows ?? []).map((market) => [market.id, market]));
  const pending = new Set((pendingRows ?? []).map((row) => row.product_id));
  const children = new Map<string, string[]>();
  for (const child of childRows ?? []) children.set(child.product_id, [...(children.get(child.product_id) ?? []), child.sku]);
  const latest = new Map<string, SavedPricingMetric>();
  for (const row of calculations) {
    if (!inRange(row.created_at, filters) || (filters.creatorId && row.created_by !== filters.creatorId)) continue;
    const market = marketMap.get(row.marketplace_id), key = market ? scenarioFor(market.code, row.listing_type) : null;
    if (!key || (filters.scenario !== "ALL" && filters.scenario !== key)) continue;
    const unique = `${row.product_id}:${key}`;
    if (!latest.has(unique)) latest.set(unique, metricFrom(row, key, market?.name ?? "Marketplace", filters.region, names.get(row.created_by) ?? "Usuário"));
  }
  const acceptable = Number((marginRows ?? []).find((row) => String(row.label).toUpperCase().includes("ACEIT"))?.min_percent ?? .09);
  const term = normalize(filters.query);
  const result: SavedPricingProduct[] = products.map((product) => {
    const productScenarios = Object.fromEntries(scenarios.flatMap((key) => { const item = latest.get(`${product.id}:${key}`); return item ? [[key, item]] : []; })) as Partial<Record<PricingScenario, SavedPricingMetric>>;
    const observations = Object.values(productScenarios), summary = average(observations);
    return { id: product.id, sku: product.sku, childSkus: children.get(product.id) ?? [], name: product.name, manufacturerCode: product.manufacturer_code,
      active: product.active, cost: Number(product.cost), supplierId: product.supplier_id, supplierName: supplierMap.get(product.supplier_id) ?? "Fornecedor",
      pending: pending.has(product.id), scenarios: productScenarios, averageValue: observations.length ? summary.value : null, averagePercent: observations.length ? summary.percent : null,
      averageTicket: observations.length ? summary.ticket : null, scenarioCount: observations.length, latestAt: observations.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ?? null };
  }).filter((product) => {
    if (filters.status === "ACTIVE" && !product.active || filters.status === "INACTIVE" && product.active) return false;
    if (filters.supplierId && product.supplierId !== filters.supplierId) return false;
    if (term && !normalize(`${product.sku} ${product.childSkus.join(" ")} ${product.manufacturerCode ?? ""} ${product.name} ${product.supplierName}`).includes(term)) return false;
    if (filters.coverage === "WITH" && !product.scenarioCount || filters.coverage === "WITHOUT" && product.scenarioCount > 0 || filters.coverage === "COMPLETE" && product.scenarioCount < 4) return false;
    if (filters.pending === "YES" && !product.pending || filters.pending === "NO" && product.pending) return false;
    if (filters.margin === "BELOW" && (product.averagePercent == null || product.averagePercent >= acceptable)) return false;
    if (filters.margin === "ACCEPTABLE" && (product.averagePercent == null || product.averagePercent < acceptable)) return false;
    return true;
  });
  const allObservations = result.flatMap((product) => Object.values(product.scenarios));
  const byScenario = Object.fromEntries(scenarios.flatMap((key) => { const items = result.flatMap((product) => product.scenarios[key] ? [product.scenarios[key]!] : []); return items.length ? [[key, average(items)]] : []; }));
  const ranked = result.filter((product) => product.scenarioCount > 0);
  const rank = (product: SavedPricingProduct | undefined, field: "averageValue" | "averagePercent"): SavedPricingRanking | null => product ? { productId: product.id, sku: product.sku, name: product.name, value: Number(product[field]), channels: product.scenarioCount } : null;
  const generatedAt = new Date();
  const metrics: SavedPricingMetrics = { overall: average(allObservations), eligibleProducts: result.length, pricedProducts: ranked.length, completeProducts: result.filter((product) => product.scenarioCount === 4).length,
    pendingProducts: result.filter((product) => product.pending).length, belowAcceptable: ranked.filter((product) => Number(product.averagePercent) < acceptable).length,
    staleProducts: ranked.filter((product) => product.latestAt && generatedAt.getTime() - new Date(product.latestAt).getTime() > 90 * 86400000).length,
    byScenario, topValue: rank(ranked.toSorted((a, b) => Number(b.averageValue) - Number(a.averageValue))[0], "averageValue"),
    topPercent: rank(ranked.toSorted((a, b) => Number(b.averagePercent) - Number(a.averagePercent))[0], "averagePercent"),
    lowestPercent: rank(ranked.toSorted((a, b) => Number(a.averagePercent) - Number(b.averagePercent))[0], "averagePercent") };
  const getter = (product: SavedPricingProduct) => filters.sort === "product" ? `${product.sku} ${product.name}` : filters.sort === "supplier" ? product.supplierName : filters.sort === "status" ? Number(product.active) : filters.sort === "channels" ? product.scenarioCount : filters.sort === "ticket" ? product.averageTicket ?? -Infinity : filters.sort === "marginValue" ? product.averageValue ?? -Infinity : filters.sort === "marginPercent" ? product.averagePercent ?? -Infinity : product.latestAt ?? "";
  result.sort((a, b) => { const left = getter(a), right = getter(b), comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR", { numeric: true }); return filters.direction === "asc" ? comparison : -comparison; });
  const safePage = Math.max(1, filters.page), safeSize = Math.min(5000, Math.max(1, pageSize)), offset = (safePage - 1) * safeSize;
  const creators = [...names].map(([id, name]) => ({ id, name })).toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { products: result.slice(offset, offset + safeSize), total: result.length, page: safePage, pageSize: safeSize, metrics, suppliers, creators, generatedAt: generatedAt.toISOString() };
}

export async function loadProductPricingHistoryPage(productId: string, filters: ProductPricingHistoryFilters, pageSize = 20): Promise<ProductPricingHistoryResult> {
  const supabase = await createClient();
  const [{ data: marketRows }, calculations] = await Promise.all([supabase.from("marketplaces").select("id,code,name"), allCalculations([productId])]);
  const names = await displayNames(calculations.map((row) => row.created_by));
  const marketMap = new Map((marketRows ?? []).map((market) => [market.id, market]));
  let rows = calculations.filter((row) => {
    if (!inRange(row.created_at, filters) || filters.creatorId && row.created_by !== filters.creatorId) return false;
    const market = marketMap.get(row.marketplace_id), key = market ? scenarioFor(market.code, row.listing_type) : null;
    if (!key || filters.scenario !== "ALL" && key !== filters.scenario) return false;
    const selectedRegion = String(asObject(row.rule_snapshot).selectedRegion ?? "SP");
    return filters.region === "ALL" || selectedRegion === filters.region;
  });
  const mapped = await Promise.all(rows.map(async (row) => storedPricingToHistory(row, marketMap.get(row.marketplace_id)?.name ?? "Marketplace", names.get(row.created_by) ?? "Usuário")));
  const scenarioLabel = (item: SavedPricing) => `${item.marketplace} ${item.listingType}`;
  const getter = (item: SavedPricing) => filters.sort === "date" ? item.createdAt : filters.sort === "channel" ? scenarioLabel(item) : filters.sort === "price" ? Number(item.price) : filters.sort === "shipping" ? Number(item.freight) : filters.sort === "marginValue" ? Number(item.marginValue) : filters.sort === "marginPercent" ? Number(item.marginPercent) : item.createdByName;
  mapped.sort((a, b) => { const left = getter(a), right = getter(b), comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR", { numeric: true }); return filters.direction === "asc" ? comparison : -comparison; });
  const safePage = Math.max(1, filters.page), safeSize = Math.min(100, Math.max(1, pageSize)), offset = (safePage - 1) * safeSize;
  rows = rows.slice(offset, offset + safeSize);
  return { items: mapped.slice(offset, offset + safeSize), total: mapped.length, page: safePage, pageSize: safeSize, creators: [...names].map(([id, name]) => ({ id, name })).toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
}

export async function loadSavedPricingDetail(id: string): Promise<SavedPricing | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("pricing_calculations").select("id,product_id,created_at,created_by,marketplace_id,listing_type,sale_price,shipping_cost,results,input_snapshot,rule_snapshot").eq("id", id).maybeSingle();
  if (!row) return null;
  const [{ data: market }, names] = await Promise.all([supabase.from("marketplaces").select("name").eq("id", row.marketplace_id).maybeSingle(), displayNames([row.created_by])]);
  return storedPricingToHistory(row, market?.name ?? "Marketplace", names.get(row.created_by) ?? "Usuário");
}
