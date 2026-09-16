import { NextResponse } from "next/server";
import { loadSupplierAnalytics, type AnalyticsRegion, type ScenarioKey, type SupplierProductAnalytics } from "@/lib/data/supplier-analytics";
import { sortSupplierProducts, type SupplierProductSortKey } from "@/lib/supplier-product-sorting";
import { createClient } from "@/lib/supabase/server";

const keys: ScenarioKey[] = ["ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"];
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, url = new URL(request.url), search = url.searchParams;
  const rawRegion = search.get("region") ?? "SP", region = (["SP", "SUL_SUDESTE", "NORTE_NORDESTE"].includes(rawRegion) ? rawRegion : "SP") as AnalyticsRegion;
  const supabase = await createClient(), { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [{ data: supplier }, analytics] = await Promise.all([supabase.from("suppliers").select("name").eq("id", id).maybeSingle(), loadSupplierAnalytics(id, region)]);
  if (!supplier || !analytics) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  const query = (search.get("query") ?? "").toLowerCase(), includeInactive = search.get("inactive") === "1", scenario = (keys.includes(search.get("scenario") as ScenarioKey) ? search.get("scenario") : "ALL") as "ALL" | ScenarioKey;
  const coverage = search.get("coverage") ?? "ALL", pending = search.get("pending") ?? "ALL", margin = search.get("margin") ?? "ALL", period = search.get("period") ?? "ALL";
  const now = analytics.generatedAt, from = period === "CUSTOM" ? (search.get("from") ? new Date(`${search.get("from")}T00:00:00-03:00`).getTime() : null) : period !== "ALL" ? now - Number(period) * 86400000 : null;
  const to = period === "CUSTOM" && search.get("to") ? new Date(`${search.get("to")}T23:59:59.999-03:00`).getTime() : now;
  let products = analytics.products.flatMap((product) => {
    if (!includeInactive && !product.active || query && !`${product.sku} ${product.childSkus.join(" ")} ${product.name} ${product.manufacturerCode ?? ""}`.toLowerCase().includes(query) || pending === "YES" && !product.pending || pending === "NO" && product.pending) return [];
    const entries = keys.flatMap((key) => { const metric = product.scenarios[key], time = metric ? new Date(metric.createdAt).getTime() : 0; return metric && (scenario === "ALL" || scenario === key) && (!from || time >= from) && (!to || time <= to) ? [[key, metric] as const] : []; });
    const projected = { ...product, scenarios: Object.fromEntries(entries) } as SupplierProductAnalytics, metrics = Object.values(projected.scenarios);
    if (coverage === "WITH" && !metrics.length || coverage === "WITHOUT" && metrics.length || margin === "BAD" && (!metrics.length || Math.min(...metrics.map((item) => item.marginPercent)) >= .09) || margin === "ACCEPTABLE" && (!metrics.length || Math.max(...metrics.map((item) => item.marginPercent)) < .09)) return [];
    return [projected];
  });
  const sort = (["product", "cost", "price", "marginValue", "marginPercent", "date", "status"].includes(search.get("sort") ?? "") ? search.get("sort") : "product") as SupplierProductSortKey;
  products = sortSupplierProducts(products, sort, search.get("direction") === "desc" ? "desc" : "asc", scenario);
  const header = ["SKU pai", "SKUs filhos", "Produto", "Status", "Custo", ...keys.flatMap((key) => [`${key} preço`, `${key} margem R$`, `${key} margem %`, `${key} frete`, `${key} data`]), "Reprecificação pendente"];
  const rows = products.map((item) => [item.sku, item.childSkus.join(", "), item.name, item.active ? "Ativo" : "Extinto", item.cost, ...keys.flatMap((key) => { const metric = item.scenarios[key]; return metric ? [metric.price, metric.marginValue, metric.marginPercent, metric.shipping, metric.createdAt] : ["", "", "", "", ""]; }), item.pending ? "Sim" : "Não"]);
  const body = `\uFEFF${[header, ...rows].map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fornecedor-${supplier.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${region}.csv"` } });
}
