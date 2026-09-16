"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MarketplaceBrand } from "./marketplace-brand";
import { formatMoney, formatPercent } from "@/lib/format";
import type { AnalyticsRegion, ScenarioKey, ScenarioMetric, SupplierAnalytics, SupplierProductAnalytics, SupplierProductRanking } from "@/lib/data/supplier-analytics";
import type { MarketplaceKey } from "@/domain/pricing/types";
import { PrintButton } from "./print-button";
import { SupplierProductTable } from "./supplier-product-history";
import { sortSupplierProducts, type SupplierProductSortDirection, type SupplierProductSortKey } from "@/lib/supplier-product-sorting";

const labels: Record<ScenarioKey, string> = { ML_CLASSICO: "ML Clássico", ML_PREMIUM: "ML Premium", SHOPEE: "Shopee", AMAZON: "Amazon" };
const scenarios = Object.keys(labels) as ScenarioKey[];
const brand = (key: ScenarioKey): MarketplaceKey => key.startsWith("ML_") ? "MERCADO_LIVRE" : key as MarketplaceKey;
const calculateAverage = (items: ScenarioMetric[]) => items.length ? { value: items.reduce((sum, item) => sum + item.marginValue, 0) / items.length, percent: items.reduce((sum, item) => sum + item.marginPercent, 0) / items.length, ticket: items.reduce((sum, item) => sum + item.price, 0) / items.length, count: items.length } : undefined;
const calculateProductAverage = (product: SupplierProductAnalytics): SupplierProductRanking | undefined => { const items = Object.values(product.scenarios); return items.length ? { product, averageValue: items.reduce((sum, item) => sum + item.marginValue, 0) / items.length, averagePercent: items.reduce((sum, item) => sum + item.marginPercent, 0) / items.length } : undefined; };
const reportUrl = (supplierId: string, values: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== false && value !== "" && value !== "ALL") params.set(key, String(value === true ? 1 : value));
  return `/fornecedores/${supplierId}?${params}` as Route;
};

export type SupplierAnalyticsFilters = {
  query: string; includeInactive: boolean; region: AnalyticsRegion; scenario: "ALL" | ScenarioKey;
  coverage: "ALL" | "WITH" | "WITHOUT"; pending: "ALL" | "YES" | "NO";
  period: "ALL" | "7" | "30" | "60" | "90" | "CUSTOM"; dateFrom: string; dateTo: string;
  margin: "ALL" | "BAD" | "ACCEPTABLE"; sort: SupplierProductSortKey; direction: SupplierProductSortDirection; page: number;
};

const filterUrlValues = (filters: SupplierAnalyticsFilters) => ({ query: filters.query, region: filters.region, inactive: filters.includeInactive, scenario: filters.scenario, coverage: filters.coverage, pending: filters.pending, period: filters.period, from: filters.dateFrom, to: filters.dateTo, margin: filters.margin, sort: filters.sort, direction: filters.direction, page: filters.page });
const rangeFor = (filters: SupplierAnalyticsFilters, now: number) => filters.period === "ALL" ? { from: null, to: null } : filters.period === "CUSTOM" ? { from: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00-03:00`).getTime() : null, to: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999-03:00`).getTime() : null } : { from: now - Number(filters.period) * 86400000, to: now };

export function SupplierAnalyticsView({ supplier, analytics, filters: initialFilters }: { supplier: { id: string; name: string }; analytics: SupplierAnalytics; filters: SupplierAnalyticsFilters }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const reportTime = analytics.generatedAt;
  useEffect(() => { window.history.replaceState(window.history.state, "", reportUrl(supplier.id, filterUrlValues(filters))); }, [filters, supplier.id]);
  const updateFilters = (patch: Partial<SupplierAnalyticsFilters>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const effectiveFilters = { ...filters, query: deferredQuery }, range = rangeFor(effectiveFilters, reportTime);
  let filtered = analytics.products.flatMap((product) => {
    if (!effectiveFilters.includeInactive && !product.active) return [];
    if (effectiveFilters.query && !`${product.sku} ${product.childSkus.join(" ")} ${product.name} ${product.manufacturerCode ?? ""}`.toLowerCase().includes(effectiveFilters.query.toLowerCase())) return [];
    if (effectiveFilters.pending === "YES" && !product.pending || effectiveFilters.pending === "NO" && product.pending) return [];
    const entries = scenarios.flatMap((key) => { const metric = product.scenarios[key], time = metric ? new Date(metric.createdAt).getTime() : 0; return metric && (effectiveFilters.scenario === "ALL" || effectiveFilters.scenario === key) && (!range.from || time >= range.from) && (!range.to || time <= range.to) ? [[key, metric] as const] : []; });
    const projected = { ...product, scenarios: Object.fromEntries(entries) } as SupplierProductAnalytics;
    const metrics = Object.values(projected.scenarios);
    if (effectiveFilters.coverage === "WITH" && !metrics.length || effectiveFilters.coverage === "WITHOUT" && metrics.length) return [];
    if (effectiveFilters.margin === "BAD" && (!metrics.length || Math.min(...metrics.map((metric) => metric.marginPercent)) >= .09)) return [];
    if (effectiveFilters.margin === "ACCEPTABLE" && (!metrics.length || Math.max(...metrics.map((metric) => metric.marginPercent)) < .09)) return [];
    return [projected];
  });
  const observations = filtered.flatMap((product) => Object.values(product.scenarios));
  const overall = calculateAverage(observations) ?? { value: 0, percent: 0, ticket: 0, count: 0 };
  const averages = Object.fromEntries(scenarios.flatMap((key) => { const metric = calculateAverage(filtered.flatMap((product) => product.scenarios[key] ? [product.scenarios[key]!] : [])); return metric ? [[key, metric]] : []; })) as SupplierAnalytics["averages"];
  const ranked = filtered.flatMap((product) => { const item = calculateProductAverage(product); return item ? [item] : []; });
  const topValue = ranked.toSorted((a, b) => b.averageValue - a.averageValue)[0] ?? null, topPercent = ranked.toSorted((a, b) => b.averagePercent - a.averagePercent)[0] ?? null, lowest = ranked.toSorted((a, b) => a.averagePercent - b.averagePercent)[0] ?? null;
  const pricedProducts = filtered.filter((product) => Object.keys(product.scenarios).length).length;
  const pendingProducts = filtered.filter((product) => product.pending).length;
  const below = filtered.filter((product) => Object.values(product.scenarios).some((metric) => metric.marginPercent < .09)).length;
  const stale = filtered.filter((product) => Object.values(product.scenarios).some((metric) => reportTime - new Date(metric.createdAt).getTime() > 90 * 86400000)).length;
  filtered = sortSupplierProducts(filtered, effectiveFilters.sort, effectiveFilters.direction, effectiveFilters.scenario);
  const pageSize = 20, total = filtered.length, pages = Math.max(1, Math.ceil(total / pageSize)), page = Math.min(filters.page, pages), products = filtered.slice((page - 1) * pageSize, page * pageSize);
  const exportParams = new URLSearchParams(Object.entries(filterUrlValues(filters)).flatMap(([key, value]) => value === "" || value === false || value === "ALL" ? [] : [[key, String(value === true ? 1 : value)]]));
  const rankingCard = (label: string, ranking: typeof topValue, percent: boolean) => <article className="wide-card"><div><span>{label}</span><strong>{ranking?.product.sku ?? "Sem dados"}</strong><small>{ranking ? `${ranking.product.name} · ${Object.keys(ranking.product.scenarios).length} de 4 canais` : "Nenhum produto precificado"}</small></div>{ranking && <b>{percent ? formatPercent(String(ranking.averagePercent)) : formatMoney(String(ranking.averageValue))}</b>}</article>;
  return <>
    <div className="supplier-report-actions no-print"><Link className="secondary-button" href={`/fornecedores/${supplier.id}/editar`}>Editar fornecedor</Link><a className="secondary-button" href={`/fornecedores/${supplier.id}/exportar?${exportParams}`}>Exportar CSV</a><PrintButton /></div>
    <section className="metric-grid supplier-metrics">
      <article className="metric-card"><span>Margem média geral</span><strong>{overall.count ? formatPercent(String(overall.percent)) : "Sem dados"}</strong><small>{overall.count ? formatMoney(String(overall.value)) : "Nenhuma precificação"}</small></article>
      <article className="metric-card"><span>Ticket médio geral</span><strong>{overall.count ? formatMoney(String(overall.ticket)) : "Sem dados"}</strong><small>{overall.count} precificações consideradas</small></article>
      <article className="metric-card"><span>Cobertura</span><strong>{pricedProducts} de {filtered.length}</strong><small>{filtered.length ? formatPercent(String(pricedProducts / filtered.length)) : "0%"} dos produtos filtrados</small></article>
      <article className="metric-card"><span>Revisão necessária</span><strong>{pendingProducts}</strong><small>produtos pendentes</small></article>
      <article className="metric-card"><span>Atenção</span><strong>{below}</strong><small>abaixo de 9% · {stale} desatualizados</small></article>
    </section>
    <h2 className="supplier-section-title">Margem média por canal</h2>
    <section className="scenario-summary">{scenarios.map((key) => { const metric = averages[key]; return <article className="wide-card" key={key}><h3><MarketplaceBrand marketplace={brand(key)} compact />{labels[key]}</h3><strong>{metric ? formatPercent(String(metric.percent)) : "Sem dados"}</strong><small>{metric ? `${formatMoney(String(metric.value))} · ${metric.count} precificações` : "Nenhuma precificação"}</small><div className="scenario-ticket"><span>Ticket médio</span><b>{metric ? formatMoney(String(metric.ticket)) : "—"}</b></div></article>; })}</section>
    <section className="supplier-rankings">{rankingCard("Maior margem média em R$", topValue, false)}{rankingCard("Maior margem média percentual", topPercent, true)}{rankingCard("Menor margem média percentual", lowest, true)}</section>
    <section className="wide-card supplier-filter-section no-print" aria-labelledby="supplier-filters-title"><div className="card-heading"><div><h2 id="supplier-filters-title">Filtros da listagem</h2><p>Indicadores e resultados são atualizados automaticamente.</p></div></div><div className="supplier-filter-group">
      <input aria-label="Buscar produtos do fornecedor" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Buscar SKU pai, SKU filho, código ou nome" />
      <select aria-label="Região" value={filters.region} onChange={(event) => { const next = { ...filters, region: event.target.value as AnalyticsRegion, page: 1 }; setFilters(next); router.replace(reportUrl(supplier.id, filterUrlValues(next))); }}><option value="SP">São Paulo</option><option value="SUL_SUDESTE">Sul / Sudeste</option><option value="NORTE_NORDESTE">Norte / Nordeste</option></select>
      <select aria-label="Canal" value={filters.scenario} onChange={(event) => updateFilters({ scenario: event.target.value as SupplierAnalyticsFilters["scenario"] })}><option value="ALL">Todos os cenários</option>{scenarios.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select>
      <select aria-label="Cobertura" value={filters.coverage} onChange={(event) => updateFilters({ coverage: event.target.value as SupplierAnalyticsFilters["coverage"] })}><option value="ALL">Com e sem precificação</option><option value="WITH">Com precificação</option><option value="WITHOUT">Sem precificação</option></select>
      <select aria-label="Pendência" value={filters.pending} onChange={(event) => updateFilters({ pending: event.target.value as SupplierAnalyticsFilters["pending"] })}><option value="ALL">Todas as pendências</option><option value="YES">Com pendência</option><option value="NO">Sem pendência</option></select>
      <select aria-label="Período" value={filters.period} onChange={(event) => updateFilters({ period: event.target.value as SupplierAnalyticsFilters["period"] })}><option value="ALL">Qualquer período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="60">Últimos 60 dias</option><option value="90">Últimos 90 dias</option><option value="CUSTOM">Personalizado</option></select>
      {filters.period === "CUSTOM" && <><label>Data inicial<input type="date" value={filters.dateFrom} onChange={(event) => updateFilters({ dateFrom: event.target.value })} /></label><label>Data final<input type="date" value={filters.dateTo} onChange={(event) => updateFilters({ dateTo: event.target.value })} /></label></>}
      <select aria-label="Classificação da margem" value={filters.margin} onChange={(event) => updateFilters({ margin: event.target.value as SupplierAnalyticsFilters["margin"] })}><option value="ALL">Todas as margens</option><option value="BAD">Abaixo de 9%</option><option value="ACCEPTABLE">9% ou mais</option></select>
      <label><input type="checkbox" checked={filters.includeInactive} onChange={(event) => updateFilters({ includeInactive: event.target.checked })} /> Incluir extintos</label>
    </div><div className="supplier-order-group"><strong>Ordenação</strong><select aria-label="Ordenar produtos por" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as SupplierAnalyticsFilters["sort"] })}><option value="product">Produto</option><option value="cost">Custo</option><option value="price">Preço</option><option value="marginValue">Margem R$</option><option value="marginPercent">Margem %</option><option value="date">Data</option><option value="status">Status</option></select><select aria-label="Direção" value={filters.direction} onChange={(event) => updateFilters({ direction: event.target.value as SupplierAnalyticsFilters["direction"] })}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></div></section>
    <section className="wide-card supplier-products"><div className="card-heading"><div><h2>Produtos e últimas precificações</h2><p>{total} produto{total === 1 ? "" : "s"} nos filtros atuais. Clique no produto para consultar o histórico salvo.</p></div></div><SupplierProductTable products={products} region={filters.region} />{!products.length && <div className="empty-inline">Nenhum produto corresponde aos filtros.</div>}<nav className="history-pagination no-print" aria-label="Paginação dos produtos"><button type="button" disabled={page === 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, page - 1) }))}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page === pages} onClick={() => setFilters((current) => ({ ...current, page: Math.min(pages, page + 1) }))}>Próxima</button></nav></section>
  </>;
}
