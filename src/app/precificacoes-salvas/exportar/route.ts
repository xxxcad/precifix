import { NextRequest, NextResponse } from "next/server";
import { loadSavedPricingAnalytics, type SavedPricingFilters } from "@/lib/data/saved-pricing-analytics";

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const filters: SavedPricingFilters = {
    query: search.get("query")?.trim() ?? "", supplierId: search.get("supplier") ?? "", status: oneOf(search.get("status"), ["ACTIVE", "INACTIVE", "ALL"] as const, "ACTIVE"),
    scenario: oneOf(search.get("scenario"), ["ALL", "ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"] as const, "ALL"), coverage: oneOf(search.get("coverage"), ["ALL", "WITH", "WITHOUT", "COMPLETE"] as const, "ALL"),
    margin: oneOf(search.get("margin"), ["ALL", "BELOW", "ACCEPTABLE"] as const, "ALL"), pending: oneOf(search.get("pending"), ["ALL", "YES", "NO"] as const, "ALL"), creatorId: search.get("creator") ?? "",
    region: oneOf(search.get("region"), ["SP", "SUL_SUDESTE", "NORTE_NORDESTE"] as const, "SP"), period: oneOf(search.get("period"), ["ALL", "7", "30", "60", "90", "CUSTOM"] as const, "ALL"),
    dateFrom: search.get("from") ?? "", dateTo: search.get("to") ?? "", sort: oneOf(search.get("sort"), ["product", "supplier", "status", "channels", "ticket", "marginValue", "marginPercent", "date"] as const, "product"),
    direction: search.get("direction") === "desc" ? "desc" : "asc", page: 1,
  };
  const analytics = await loadSavedPricingAnalytics(filters, 5000);
  const scenarios = ["ML_CLASSICO", "ML_PREMIUM", "SHOPEE", "AMAZON"] as const;
  const header = ["SKU", "Produto", "Fornecedor", "Status", ...scenarios.flatMap((scenario) => [`${scenario} preço`, `${scenario} margem R$`, `${scenario} margem %`, `${scenario} frete`, `${scenario} data`, `${scenario} responsável`]), "Canais", "Ticket médio", "Margem média R$", "Margem média %", "Última precificação", "Pendência"];
  const rows = analytics.products.map((product) => [product.sku, product.name, product.supplierName, product.active ? "Ativo" : "Extinto", ...scenarios.flatMap((scenario) => { const item = product.scenarios[scenario]; return item ? [item.price, item.marginValue, item.marginPercent, item.shipping, item.createdAt, item.createdByName] : ["", "", "", "", "", ""]; }), `${product.scenarioCount} de 4`, product.averageTicket ?? "", product.averageValue ?? "", product.averagePercent ?? "", product.latestAt ?? "", product.pending ? "Sim" : "Não"]);
  const body = `\uFEFF${[header, ...rows].map((row) => row.map(csv).join(";")).join("\r\n")}`;
  return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="precificacoes-salvas-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
