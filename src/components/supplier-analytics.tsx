"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MarketplaceBrand } from "./marketplace-brand";
import { formatMoney, formatPercent } from "@/lib/format";
import type { AnalyticsRegion, ScenarioKey, SupplierAnalytics } from "@/lib/data/supplier-analytics";
import type { MarketplaceKey } from "@/domain/pricing/types";
import { PrintButton } from "./print-button";
import { SupplierProductTable } from "./supplier-product-history";
import { sortSupplierProducts, type SupplierProductSortDirection, type SupplierProductSortKey } from "@/lib/supplier-product-sorting";

const labels: Record<ScenarioKey, string> = { ML_CLASSICO: "ML Clássico", ML_PREMIUM: "ML Premium", SHOPEE: "Shopee", AMAZON: "Amazon" };
const scenarios = Object.keys(labels) as ScenarioKey[];
const brand = (key: ScenarioKey): MarketplaceKey => key.startsWith("ML_") ? "MERCADO_LIVRE" : key as MarketplaceKey;
const reportUrl = (supplierId: string, values: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== false && value !== "") params.set(key, String(value === true ? 1 : value));
  return `/fornecedores/${supplierId}?${params}` as Route;
};

export type SupplierAnalyticsFilters = {
  query: string;
  includeInactive: boolean;
  region: AnalyticsRegion;
  scenario: "ALL" | ScenarioKey;
  coverage: "ALL" | "WITH" | "WITHOUT";
  pending: "ALL" | "YES" | "NO";
  age: "ALL" | "30" | "60" | "90";
  margin: "ALL" | "BAD" | "ACCEPTABLE";
  sort: SupplierProductSortKey;
  direction: SupplierProductSortDirection;
  page: number;
};

const filterUrlValues = (filters: SupplierAnalyticsFilters) => ({
  query: filters.query,
  region: filters.region,
  inactive: filters.includeInactive,
  scenario: filters.scenario,
  coverage: filters.coverage,
  pending: filters.pending,
  age: filters.age,
  margin: filters.margin,
  sort: filters.sort,
  direction: filters.direction,
  page: filters.page,
});

export function SupplierAnalyticsView({ supplier, analytics, filters: initialFilters }: {
  supplier: { id: string; name: string };
  analytics: SupplierAnalytics;
  filters: SupplierAnalyticsFilters;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const reportTime = analytics.generatedAt;

  useEffect(() => {
    window.history.replaceState(window.history.state, "", reportUrl(supplier.id, filterUrlValues(filters)));
  }, [filters, supplier.id]);

  const updateFilters = (patch: Partial<SupplierAnalyticsFilters>) => setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const effectiveFilters = { ...filters, query: deferredQuery };
  let filtered = analytics.products.filter((product) => {
    if (!effectiveFilters.includeInactive && !product.active) return false;
    if (effectiveFilters.query && !`${product.sku} ${product.childSkus.join(" ")} ${product.name} ${product.manufacturerCode ?? ""}`.toLowerCase().includes(effectiveFilters.query.toLowerCase())) return false;
    const metrics = effectiveFilters.scenario === "ALL" ? Object.values(product.scenarios) : product.scenarios[effectiveFilters.scenario] ? [product.scenarios[effectiveFilters.scenario]!] : [];
    if (effectiveFilters.coverage === "WITH" && !metrics.length) return false;
    if (effectiveFilters.coverage === "WITHOUT" && metrics.length) return false;
    if (effectiveFilters.pending === "YES" && !product.pending) return false;
    if (effectiveFilters.pending === "NO" && product.pending) return false;
    if (effectiveFilters.age !== "ALL" && (!metrics.length || metrics.every((metric) => reportTime - new Date(metric.createdAt).getTime() <= Number(effectiveFilters.age) * 86400000))) return false;
    if (effectiveFilters.margin === "BAD" && (!metrics.length || Math.min(...metrics.map((metric) => metric.marginPercent)) >= .09)) return false;
    if (effectiveFilters.margin === "ACCEPTABLE" && (!metrics.length || Math.max(...metrics.map((metric) => metric.marginPercent)) < .09)) return false;
    return true;
  });

  filtered = sortSupplierProducts(filtered, effectiveFilters.sort, effectiveFilters.direction, effectiveFilters.scenario);

  const pageSize = 20;
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(filters.page, pages);
  const products = filtered.slice((page - 1) * pageSize, page * pageSize);
  const below = analytics.products.filter((product) => product.active && Object.values(product.scenarios).some((metric) => metric.marginPercent < .09)).length;
  const stale = analytics.products.filter((product) => product.active && Object.values(product.scenarios).some((metric) => reportTime - new Date(metric.createdAt).getTime() > 90 * 86400000)).length;
  return <>
    <div className="supplier-report-actions">
      <Link className="secondary-button" href={`/fornecedores/${supplier.id}/editar`}>Editar fornecedor</Link>
      <a className="secondary-button" href={`/fornecedores/${supplier.id}/exportar?region=${filters.region}&inactive=${filters.includeInactive ? 1 : 0}`}>Exportar CSV</a>
      <PrintButton />
    </div>

    <section className="metric-grid supplier-metrics">
      <article className="metric-card"><span>Margem média geral</span><strong>{analytics.overall.count ? formatPercent(String(analytics.overall.percent)) : "Sem dados"}</strong><small>{analytics.overall.count ? formatMoney(String(analytics.overall.value)) : "Nenhuma precificação"}</small></article>
      <article className="metric-card"><span>Ticket médio geral</span><strong>{analytics.overall.count ? formatMoney(String(analytics.overall.ticket)) : "Sem dados"}</strong><small>{analytics.overall.count} precificaç{analytics.overall.count === 1 ? "ão" : "ões"} consideradas</small></article>
      <article className="metric-card"><span>Cobertura</span><strong>{analytics.pricedProducts} de {analytics.activeProducts}</strong><small>{analytics.activeProducts ? formatPercent(String(analytics.pricedProducts / analytics.activeProducts)) : "0%"} dos produtos ativos</small></article>
      <article className="metric-card"><span>Revisão necessária</span><strong>{analytics.pendingProducts}</strong><small>produtos pendentes</small></article>
      <article className="metric-card"><span>Atenção</span><strong>{below}</strong><small>abaixo de 9% · {stale} desatualizados</small></article>
    </section>

    <h2 className="supplier-section-title">Margem média por canal</h2>
    <section className="scenario-summary">
      {scenarios.map((key) => {
        const metric = analytics.averages[key];
        return <article className="wide-card" key={key}>
          <h3><MarketplaceBrand marketplace={brand(key)} compact />{labels[key]}</h3>
          <strong>{metric ? formatPercent(String(metric.percent)) : "Sem dados"}</strong>
          <small>{metric ? `${formatMoney(String(metric.value))} · ${metric.count} precificaç${metric.count === 1 ? "ão" : "ões"}` : "Nenhuma precificação"}</small>
          <div className="scenario-ticket"><span>Ticket médio</span><b>{metric ? formatMoney(String(metric.ticket)) : "—"}</b></div>
        </article>;
      })}
    </section>

    <section className="supplier-rankings">
      <article className="wide-card"><div><span>Maior margem média em R$</span><strong>{analytics.topValue?.product.sku ?? "Sem dados"}</strong><small>{analytics.topValue?.product.name ?? "É necessário ter os quatro canais precificados"}</small></div>{analytics.topValue && <b>{formatMoney(String(analytics.topValue.averageValue))}</b>}</article>
      <article className="wide-card"><div><span>Maior margem média percentual</span><strong>{analytics.topPercent?.product.sku ?? "Sem dados"}</strong><small>{analytics.topPercent?.product.name ?? "É necessário ter os quatro canais precificados"}</small></div>{analytics.topPercent && <b>{formatPercent(String(analytics.topPercent.averagePercent))}</b>}</article>
      <article className="wide-card"><div><span>Menor margem média percentual</span><strong>{analytics.lowest?.product.sku ?? "Sem dados"}</strong><small>{analytics.lowest?.product.name ?? "É necessário ter os quatro canais precificados"}</small></div>{analytics.lowest && <b>{formatPercent(String(analytics.lowest.averagePercent))}</b>}</article>
    </section>

    <section className="wide-card supplier-filter-section" aria-labelledby="supplier-filters-title">
      <div className="card-heading"><div><h2 id="supplier-filters-title">Filtros da listagem</h2><p>Os resultados são atualizados automaticamente.</p></div></div>
      <div className="supplier-filter-group">
        <input aria-label="Buscar produtos do fornecedor" value={filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Buscar SKU pai, SKU filho, código ou nome" />
        <select aria-label="Região" value={filters.region} onChange={(event) => { const next = { ...filters, region: event.target.value as AnalyticsRegion, page: 1 }; setFilters(next); router.replace(reportUrl(supplier.id, filterUrlValues(next))); }}><option value="SP">São Paulo</option><option value="SUL_SUDESTE">Sul / Sudeste</option><option value="NORTE_NORDESTE">Norte / Nordeste</option></select>
        <select aria-label="Canal" value={filters.scenario} onChange={(event) => updateFilters({ scenario: event.target.value as SupplierAnalyticsFilters["scenario"] })}><option value="ALL">Todos os cenários</option>{scenarios.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select>
        <select aria-label="Cobertura de precificação" value={filters.coverage} onChange={(event) => updateFilters({ coverage: event.target.value as SupplierAnalyticsFilters["coverage"] })}><option value="ALL">Com e sem precificação</option><option value="WITH">Com precificação</option><option value="WITHOUT">Sem precificação</option></select>
        <select aria-label="Pendência de reprecificação" value={filters.pending} onChange={(event) => updateFilters({ pending: event.target.value as SupplierAnalyticsFilters["pending"] })}><option value="ALL">Todas as pendências</option><option value="YES">Com pendência</option><option value="NO">Sem pendência</option></select>
        <select aria-label="Idade da precificação" value={filters.age} onChange={(event) => updateFilters({ age: event.target.value as SupplierAnalyticsFilters["age"] })}><option value="ALL">Qualquer data</option><option value="30">Mais de 30 dias</option><option value="60">Mais de 60 dias</option><option value="90">Mais de 90 dias</option></select>
        <select aria-label="Classificação da margem" value={filters.margin} onChange={(event) => updateFilters({ margin: event.target.value as SupplierAnalyticsFilters["margin"] })}><option value="ALL">Todas as margens</option><option value="BAD">Abaixo de 9%</option><option value="ACCEPTABLE">9% ou mais</option></select>
        <label><input type="checkbox" checked={filters.includeInactive} onChange={(event) => updateFilters({ includeInactive: event.target.checked })} /> Incluir extintos</label>
      </div>
      <div className="supplier-order-group">
        <strong>Ordenação</strong>
        <select aria-label="Ordenar produtos por" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as SupplierAnalyticsFilters["sort"] })}><option value="product">Produto</option><option value="cost">Custo</option><option value="price">Preço</option><option value="marginValue">Margem R$</option><option value="marginPercent">Margem %</option><option value="date">Data</option><option value="status">Status</option></select>
        <select aria-label="Direção da ordenação" value={filters.direction} onChange={(event) => updateFilters({ direction: event.target.value as SupplierAnalyticsFilters["direction"] })}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select>
      </div>
    </section>

    <section className="wide-card supplier-products">
      <div className="card-heading"><div><h2>Produtos e últimas precificações</h2><p>{total} produto{total === 1 ? "" : "s"} nos filtros atuais. Clique no produto para consultar todo o histórico salvo.</p></div></div>
      <SupplierProductTable products={products} region={filters.region} />
      {!products.length && <div className="empty-inline">Nenhum produto corresponde aos filtros.</div>}
      <nav className="history-pagination" aria-label="Paginação dos produtos">
        <button type="button" disabled={page === 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, page - 1) }))}>Anterior</button>
        <span>Página {page} de {pages}</span>
        <button type="button" disabled={page === pages} onClick={() => setFilters((current) => ({ ...current, page: Math.min(pages, page + 1) }))}>Próxima</button>
      </nav>
    </section>
  </>;
}
